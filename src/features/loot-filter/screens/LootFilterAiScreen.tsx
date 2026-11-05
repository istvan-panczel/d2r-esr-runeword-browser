import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, ClipboardPaste, Copy, FileArchive, FileText, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import type { RootState } from '@/core/store';
import { selectAuthUserId } from '@/features/auth';
import { useManifest } from '@/features/game-data/hooks/useManifest';
import { downloadBlob } from '@/utils/download';
import { validateLootFilter } from '../engine/validate';
import { AiStarterPicker } from '../components/ai/AiStarterPicker';
import { ExampleRulesDialog } from '../components/rules/ExampleRulesDialog';
import { copyText } from '../components/ai/copyText';
import { ImportAiAnswerDialog } from '../components/ai/ImportAiAnswerDialog';
import { useLootFilterData } from '../hooks/useLootFilterData';
import { importText } from '../store/lootFilterSlice';
import { countDiagnostics, selectLibraryHydrated, selectVisibleDrafts } from '../store/selectors';
import type { AiAnswerSuccess } from '../utils/aiAnswer';
import { aiFilterName } from '../utils/aiFollowUp';
import type { GameDataSize, PromptPackage, PromptPackageInput } from '../utils/aiPrompt/promptPackage';
import {
  readAiOpenFilter,
  starterFromRules,
  starterFromText,
  type AiStarterChoice,
  type ExampleRulesStarter,
  type StarterResult,
} from '../utils/aiStarter';
import type { ExamplePickerState } from '../utils/examplePicker';
import { SHOW_PROBLEMS_STATE } from '../utils/editorRoute';
import { draftPath } from '../utils/library';
import { BUNDLED_TEMPLATES, loadTemplateText, type BundledTemplateId } from '../utils/template';

type PromptModule = typeof import('../utils/aiPrompt/promptPackage');

const REQUEST_KEY = 'loot-filters/ai-request';

/** The description survives a trip to the editor and back (this tab only); storage may be blocked. */
function readStoredRequest(): string {
  try {
    return sessionStorage.getItem(REQUEST_KEY) ?? '';
  } catch {
    return '';
  }
}

function storeRequest(request: string): void {
  try {
    sessionStorage.setItem(REQUEST_KEY, request);
  } catch {
    // Storage blocked: the description just does not survive a reload.
  }
}

const PLACEHOLDER = `For example: I play a Hammerdin, now in Hell (level 85), and start farming maps. Show runes from Lum up with a sound and a minimap icon, and every unique and set item. Highlight 4-socket Monarchs and jewels with Increased Attack Speed. Hide white, magic and rare gear except rings, amulets, charms and jewels. Three levels: Leveling, Strict (hides more), Maps (hides almost everything). Sounds only for high runes and uniques. Chat lines in English.`;

const SIZE_TEXT: Readonly<Record<GameDataSize, { readonly title: string; readonly text: string }>> = {
  compact: {
    title: 'Compact (recommended)',
    text: 'Every item type and stat, the bases and misc items that drop, uniques and sets by name, areas and class skills. Fits most chats.',
  },
  full: {
    title: 'Full',
    text: 'Every item code, type, stat, unique and set row, area, skill and sounds.txt sound. For LLMs with file upload or a large context.',
  },
};

const thousands = (chars: number) => (chars >= 10_000 ? `${String(Math.round(chars / 1000))}k` : chars.toLocaleString('en-US'));
const sizeLabel = (chars: number, tokens: number) => `about ${thousands(chars)} characters (~${thousands(tokens)} tokens)`;

function StepHeading({ step, title }: { readonly step: number; readonly title: string }) {
  return (
    <h2 className="flex items-center gap-2 text-lg font-semibold">
      <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground" aria-hidden>
        {step}
      </span>
      {title}
    </h2>
  );
}

type StarterStatus =
  { readonly kind: 'ready'; readonly text: string } | { readonly kind: 'loading' } | { readonly kind: 'error'; readonly text: string };

/**
 * "Create a filter with AI help" (`/loot-filters/ai`): the user describes the filter, picks a starter and the game data
 * size, and downloads a prompt package for any LLM (one .md, or a zip of PROMPT.md and reference files) or copies the
 * prompt. The LLM's answer comes back through Import AI answer: here the first import makes a new draft and opens it;
 * in the editor later imports replace the draft's content. Nothing is sent anywhere: the page only builds files.
 */
export function LootFilterAiScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const openFilter = readAiOpenFilter(location.state);
  const lootData = useLootFilterData();
  const manifest = useManifest();
  const hydrated = useSelector(selectLibraryHydrated);
  const viewerId = useSelector(selectAuthUserId);
  const visibleDrafts = useSelector((state: RootState) => selectVisibleDrafts(state, viewerId));
  const drafts = [...visibleDrafts].map((draft) => draft.entry).sort((a, b) => b.updatedAt - a.updatedAt);

  const [request, setRequest] = useState(readStoredRequest);
  const [choice, setChoice] = useState<AiStarterChoice>(openFilter === null ? { kind: 'none' } : { kind: 'open' });
  const [upload, setUpload] = useState<{ readonly name: string; readonly text: string } | null>(null);
  const [templateTexts, setTemplateTexts] = useState<Partial<Record<BundledTemplateId, string>>>({});
  const [templateErrors, setTemplateErrors] = useState<Partial<Record<BundledTemplateId, string>>>({});
  // Example rules picked as the starter, with the picker's selection so "Change example rules" reopens on it.
  const [rulesStarter, setRulesStarter] = useState<ExampleRulesStarter | null>(null);
  const [rulesSelection, setRulesSelection] = useState<ExamplePickerState | undefined>(undefined);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [size, setSize] = useState<GameDataSize>('compact');
  const [generator, setGenerator] = useState<PromptModule | null>(null);
  const [generatorFailed, setGeneratorFailed] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  // The prompt builder is a chunk of its own (format text, tables, validator runs): loaded when this page opens.
  useEffect(() => {
    let cancelled = false;
    import('../utils/aiPrompt/promptPackage').then(
      (module) => {
        if (!cancelled) setGenerator(module);
      },
      (error: unknown) => {
        console.error('[Loot filters] Could not load the prompt builder', error);
        if (!cancelled) setGeneratorFailed(true);
      }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  // A bundled template starter: its file, fetched once per page load (shared with the library's start buttons).
  const pendingTemplate =
    choice.kind === 'template' && templateTexts[choice.template] === undefined && templateErrors[choice.template] === undefined
      ? choice.template
      : null;
  useEffect(() => {
    if (pendingTemplate === null) return;
    let cancelled = false;
    loadTemplateText(pendingTemplate).then(
      (text) => {
        if (!cancelled) setTemplateTexts((previous) => ({ ...previous, [pendingTemplate]: text }));
      },
      (error: unknown) => {
        if (!cancelled)
          setTemplateErrors((previous) => ({ ...previous, [pendingTemplate]: error instanceof Error ? error.message : String(error) }));
      }
    );
    return () => {
      cancelled = true;
    };
  }, [pendingTemplate]);

  const resolveStarter = (): StarterResult | 'loading' | null => {
    switch (choice.kind) {
      case 'none':
        return null;
      case 'template': {
        const template = BUNDLED_TEMPLATES[choice.template];
        const text = templateTexts[choice.template];
        const error = templateErrors[choice.template];
        if (error !== undefined) return { ok: false, message: `Could not load ${template.name}: ${error}` };
        return text === undefined ? 'loading' : starterFromText(`${template.name} v${template.version}`, text);
      }
      case 'entry': {
        const entry = drafts.find((draft) => draft.id === choice.entryId);
        return entry === undefined
          ? { ok: false, message: 'This draft is no longer in this browser.' }
          : starterFromText(entry.name, entry.text);
      }
      case 'open':
        return openFilter === null ? null : starterFromText(openFilter.name, openFilter.text);
      case 'upload':
        return upload === null ? null : starterFromText(upload.name, upload.text);
      case 'rules':
        return rulesStarter === null
          ? { ok: false, message: 'Pick example rules first.' }
          : { ok: true, starter: starterFromRules(rulesStarter) };
    }
  };
  const resolved = resolveStarter();
  const starter = resolved !== null && resolved !== 'loading' && resolved.ok ? resolved.starter : null;
  const starterStatus: StarterStatus =
    resolved === 'loading'
      ? { kind: 'loading' }
      : resolved === null
        ? { kind: 'ready', text: 'No starter: the AI writes a new filter.' }
        : resolved.ok
          ? {
              kind: 'ready',
              text: `${String(resolved.starter.ruleCount)} ${resolved.starter.ruleCount === 1 ? 'rule' : 'rules'}, ${thousands(resolved.starter.text.length)} characters.${resolved.starter.ruleCount > 100 ? ' A big starter makes every answer long: if one ends early, ask the AI to continue and paste both parts into Import AI answer.' : ''}`,
            }
          : { kind: 'error', text: `This filter cannot be used: ${resolved.message}` };
  const starterReady = resolved === null || (resolved !== 'loading' && resolved.ok);

  const ready = lootData.status === 'ready' && lootData.data !== null && lootData.types !== null && generator !== null;
  const referenceInput =
    lootData.data === null || lootData.types === null
      ? null
      : { data: lootData.data, types: lootData.types, reference: lootData.reference, esrVersion: manifest?.esrVersion };
  const sizes = generator === null || referenceInput === null ? null : generator.referenceSizes(referenceInput);
  const extra = request.length + (starter?.text.length ?? 0);

  const buildPackage = (): { module: PromptModule; pkg: PromptPackage } | null => {
    if (generator === null || referenceInput === null || !starterReady) return null;
    const input: PromptPackageInput = { ...referenceInput, request, starter, size, date: new Date() };
    return { module: generator, pkg: generator.buildPromptPackage(input) };
  };

  const downloadMarkdown = () => {
    const built = buildPackage();
    if (built === null) return;
    downloadBlob(`${built.pkg.baseName}.md`, new Blob([built.pkg.markdown], { type: 'text/markdown;charset=utf-8' }));
  };

  const downloadZip = () => {
    const built = buildPackage();
    if (built === null) return;
    downloadBlob(`${built.pkg.baseName}.zip`, new Blob([built.module.buildPromptZip(built.pkg)], { type: 'application/zip' }));
  };

  const copyPrompt = () => {
    const built = buildPackage();
    if (built === null) return;
    void copyText(
      built.pkg.prompt,
      'Copied the prompt',
      'Attach the files of the .zip (or the .md) in the same chat: the prompt refers to them.'
    );
  };

  const handleUpload = async (file: File) => {
    const text = await file.text();
    setUpload({ name: file.name.replace(/\.jsonc?$/i, ''), text });
    setChoice({ kind: 'upload' });
  };

  const handleImport = (answer: AiAnswerSuccess) => {
    const name = aiFilterName(request);
    const action = importText({ name, text: answer.text, source: 'upload' });
    dispatch(action);
    setImportOpen(false);
    const { errors, warnings } = countDiagnostics([
      ...answer.notes,
      ...answer.diagnostics,
      ...validateLootFilter(answer.filter, lootData.reference),
    ]);
    const problems = errors + warnings;
    toast.success(`Created “${name}”`, {
      description:
        problems === 0
          ? 'No problems found. Download it from the editor, or keep improving it with the AI.'
          : 'Its problems are listed under the JSON: Copy problems for the AI, paste them into the chat, and import the next answer with Import AI answer.',
    });
    // With problems, open on the JSON tab scrolled to the list (the editor reads SHOW_PROBLEMS_STATE once on mount).
    if (problems === 0) void navigate(draftPath(action.payload.id));
    else void navigate(`${draftPath(action.payload.id)}?tab=json`, { state: SHOW_PROBLEMS_STATE });
  };

  return (
    <div className="space-y-8">
      <div className="space-y-3 border-b pb-4">
        <Button asChild variant="link" size="sm" className="h-auto p-0 text-muted-foreground">
          <Link to="/loot-filters">
            <ArrowLeft />
            Back to library
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Create a filter with AI help</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Describe the filter you want; this page builds a prompt package for the AI chat of your choice, with the filter format and the ESR
          game data it needs. Talk it through with the AI, paste each answer back here, and the app checks it and lists what to fix.
        </p>
        <ol className="grid max-w-5xl gap-3 text-sm sm:grid-cols-3">
          <li className="rounded-md border px-3 py-2">
            <span className="font-medium">1. Describe</span> your class and progress, what to show, highlight and hide, and how strict.
          </li>
          <li className="rounded-md border px-3 py-2">
            <span className="font-medium">2. Download or copy</span> the prompt and give it to the AI with its files; answer its questions.
          </li>
          <li className="rounded-md border px-3 py-2">
            <span className="font-medium">3. Paste the answer back</span> with Import AI answer, then send the problems list to the AI until
            it is clean.
          </li>
        </ol>
      </div>

      <section className="max-w-4xl space-y-4">
        <StepHeading step={1} title="Describe the filter you want" />
        <div className="space-y-2">
          <Label htmlFor="loot-filter-ai-request">Your request (any language; the AI answers in it)</Label>
          <Textarea
            id="loot-filter-ai-request"
            value={request}
            placeholder={PLACEHOLDER}
            className="min-h-40"
            onChange={(event) => {
              setRequest(event.target.value);
              storeRequest(event.target.value);
            }}
          />
          <p className="text-xs text-muted-foreground">
            Worth saying: class and build, difficulty and progress (leveling, Hell, maps), which items to highlight (runes, uniques, sets,
            runeword bases, charms, jewels, maps, coupons), what to hide, how many strictness levels, sounds and minimap icons yes or no,
            languages for chat lines. The AI asks about the rest.
          </p>
        </div>
        <AiStarterPicker
          choice={choice}
          onChoiceChange={setChoice}
          openFilter={openFilter}
          drafts={drafts}
          uploadName={upload?.name ?? null}
          onUpload={(file) => void handleUpload(file)}
          rulesCount={rulesStarter === null ? null : rulesStarter.rules.length}
          onPickRules={() => {
            setRulesOpen(true);
          }}
          status={starterStatus}
        />
        <ExampleRulesDialog
          open={rulesOpen}
          onOpenChange={setRulesOpen}
          title="Pick example rules for the starter"
          confirmLabel="Use as starter"
          initialState={rulesSelection}
          onConfirm={(rules, styles, selection) => {
            setRulesStarter({ rules, styles });
            setRulesSelection(selection);
            setChoice({ kind: 'rules' });
            setRulesOpen(false);
          }}
        />
      </section>

      <section className="max-w-4xl space-y-4">
        <StepHeading step={2} title="Download the prompt package" />
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium">Game data</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(['compact', 'full'] as const).map((option) => (
              <label
                key={option}
                className="flex cursor-pointer gap-3 rounded-md border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5"
              >
                <input
                  type="radio"
                  name="loot-filter-ai-size"
                  checked={size === option}
                  onChange={() => {
                    setSize(option);
                  }}
                  className="mt-1 accent-primary"
                />
                <span className="space-y-1">
                  <span className="block font-medium">{SIZE_TEXT[option].title}</span>
                  <span className="block text-muted-foreground">{SIZE_TEXT[option].text}</span>
                  <span className="block text-xs text-muted-foreground">
                    {sizes === null || generator === null ? 'Measuring…' : sizeLabel(sizes[option], generator.approxTokens(sizes[option]))}
                  </span>
                </span>
              </label>
            ))}
          </div>
          {sizes !== null && generator !== null && (
            <p className="text-xs text-muted-foreground">
              With your description and starter: {sizeLabel(sizes[size] + extra, generator.approxTokens(sizes[size] + extra))}. Tokens are
              an estimate (characters / 4); every model counts a little differently.
            </p>
          )}
        </fieldset>

        {lootData.status === 'error' || generatorFailed ? (
          <p role="alert" className="text-sm text-destructive">
            Could not load the game data or the prompt builder. Check your connection and reload the page.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={downloadMarkdown} disabled={!ready || !starterReady}>
              {ready ? <FileText /> : <Spinner />}
              Download .md (one file)
            </Button>
            <Button variant="outline" onClick={downloadZip} disabled={!ready || !starterReady}>
              <FileArchive />
              Download .zip (prompt + files)
            </Button>
            <Button variant="outline" onClick={copyPrompt} disabled={!ready || !starterReady}>
              <Copy />
              Copy prompt
            </Button>
          </div>
        )}
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">The .md</span> holds everything in one file: attach it to the chat, or paste it if
            the chat takes that much text.
          </li>
          <li>
            <span className="font-medium text-foreground">The .zip</span> has a short PROMPT.md (paste it as your first message) and the
            reference files to attach with it (FORMAT.md, the CSV tables, starter.json).
          </li>
          <li>
            <span className="font-medium text-foreground">Copy prompt</span> copies only the instructions and your request: the reference
            files still have to be attached or pasted.
          </li>
          <li>
            LLMs with file upload or a large context handle Full best; with a small context, take Compact. The AI may still need a code it
            does not have: it should ask you, and the app flags every unknown code.
          </li>
        </ul>
      </section>

      <section className="max-w-4xl space-y-3">
        <StepHeading step={3} title="Paste the AI's answer back" />
        <p className="text-sm text-muted-foreground">
          When the AI sends the filter, copy its whole answer and import it: the first import creates a new draft and opens it in the
          editor. There, the problems list has <span className="font-medium text-foreground">Copy problems for the AI</span>; paste that
          into the chat, and import each new answer with the editor&apos;s{' '}
          <span className="font-medium text-foreground">Import AI answer</span> until no problems are left.
        </p>
        <Button
          onClick={() => {
            setImportOpen(true);
          }}
          disabled={!hydrated}
        >
          <ClipboardPaste />
          Import AI answer
        </Button>
      </section>

      <p className="flex max-w-4xl items-start gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        Nothing is sent anywhere by this page: it only builds files in your browser. What you give the AI is up to you and its own privacy
        terms.
      </p>

      <ImportAiAnswerDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        mode={{ kind: 'create', name: aiFilterName(request) }}
        reference={lootData.reference}
        onImport={handleImport}
      />
    </div>
  );
}
