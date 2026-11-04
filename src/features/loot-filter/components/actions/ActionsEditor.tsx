import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { resolveText } from '../../engine/text';
import type { LootFilter, RuleActions } from '../../engine/types';
import { effectiveActions, findStyle, previewLabelText } from '../../utils/effectiveActions';
import type { ShallowPatch } from '../../utils/patch';
import { CheckField, Field } from '../Field';
import { LabelPreview } from '../LabelPreview';
import { ColorControl } from './ColorControl';
import { ColorTextField } from './ColorTextField';
import { IconField } from './IconField';
import { LabelSection } from './LabelSection';
import { Section } from './Section';
import { SoundField } from './SoundField';
import { StyleSection } from './StyleSection';

export interface ActionsEditorProps {
  /** The actions being edited (a rule's own actions, or a style's). */
  readonly actions: RuleActions;
  /** Shallow patch: a key with `undefined` removes it. The caller dispatches `patchRule` or `setStyle`. */
  readonly onChange: (patch: ShallowPatch<RuleActions>) => void;
  /** The whole filter, for the style list (`useStyle`), the quality colours and the label preview. */
  readonly filter: LootFilter;
  /** `rule`: offers `useStyle` and previews the style's actions underneath; `style`: no `useStyle`. */
  readonly owner: 'rule' | 'style';
  /** Name of the style being edited (for the preview heading); unused for rules. */
  readonly styleName?: string;
}

const DEFAULT_DROP_FORMAT = '{qualityColor}{name}';

/**
 * Tile columns on wide pages (`/page` container steps, see PageShell): from @8xl every section is a bordered tile and
 * the tiles fill a grid, a tile row as high as its tallest tile. Standard pages never reach @8xl, so they keep the one
 * column of ruled sections. Tiles stay about 480 px or wider (narrower ones squeeze the Prefix / Suffix boxes):
 *
 * - `rule`: the actions card is under the conditions up to @10xl (editor about 1070 to 1870 px wide: two tiles),
 *   beside them from @10xl (about 700 px at 2400: one tile; 1100 px from 2880: two), see RuleEditor;
 * - `style`: the Styles tab editor next to its list (about 1150 px at @8xl up to 3000 px on a 3440 px Full page).
 */
const TILE_COLUMNS = {
  rule: '@8xl/page:grid-cols-2 @10xl/page:grid-cols-1 @11xl/page:grid-cols-2',
  style: '@8xl/page:grid-cols-2 @9xl/page:grid-cols-3 @10xl/page:grid-cols-4 @11xl/page:grid-cols-5',
} as const;

/**
 * Form for every action key of the guide (names, label colours, chat, notify, sound, icon, droplight,
 * useStyle, hide…), shared by the rule editor and the Styles tab. Each control sends a shallow patch;
 * `passthrough` is never touched. A rule's `comment` belongs to the rule editor; a style's is edited here.
 */
export function ActionsEditor({ actions, onChange, filter, owner, styleName }: ActionsEditorProps) {
  const idPrefix = owner === 'style' ? `loot-filter-style-${(styleName ?? '').replace(/[^A-Za-z0-9_-]/g, '_')}` : 'loot-filter-rule';
  const id = (key: string) => `${idPrefix}-${key}`;
  const flag = (value: boolean) => (value ? true : undefined);

  const effective = owner === 'rule' ? effectiveActions(actions, filter) : actions;
  const style = owner === 'rule' ? findStyle(actions, filter) : undefined;
  const dropFormat = resolveText(filter.notifications?.dropFormat) ?? DEFAULT_DROP_FORMAT;

  return (
    <div className={cn('flex flex-col gap-4 @8xl/page:grid', TILE_COLUMNS[owner])}>
      <div className="flex flex-col gap-1.5 @8xl/page:rounded-lg @8xl/page:border @8xl/page:p-4">
        <span className="text-sm font-medium">
          Label preview
          {owner === 'style' && styleName !== undefined ? ` · ${styleName}` : ''}
          {style !== undefined ? ' (with the style)' : ''}
        </span>
        <LabelPreview
          text={effective.hide === true ? '' : previewLabelText(effective)}
          background={effective.labelBackground}
          border={effective.labelBorder}
          className="min-h-16"
        />
        <p className="text-xs text-muted-foreground">
          {effective.hide === true
            ? 'Hidden: the item shows no label.'
            : '{name} shows as "Item Name"; other placeholders as written. Without a colour code the game colours the name by quality.'}
        </p>
      </div>

      {owner === 'rule' && <StyleSection idPrefix={idPrefix} actions={actions} filter={filter} onChange={onChange} />}

      <Section title="Visibility">
        <div className="grid gap-4 sm:grid-cols-2">
          <CheckField
            id={id('hide')}
            label="Hide"
            hint="Hides the ground label; no later rule runs, and no rule can show it again."
            checked={actions.hide === true}
            onChange={(value) => {
              onChange({ hide: flag(value) });
            }}
          />
          <CheckField
            id={id('hide-if-other-fail')}
            label="Hide if other conditions fail"
            hint="When codes, types and location match but another condition fails, the item is hidden."
            checked={actions.hideIfOtherConditionsFail === true}
            onChange={(value) => {
              onChange({ hideIfOtherConditionsFail: flag(value) });
            }}
          />
        </div>
        <ColorTextField
          id={id('chat-when-hidden')}
          label="Chat line when hidden"
          context="chat"
          defaultColor="0"
          value={actions.chatMessageWhenHidden}
          placeholder="ÿc5Hidden: {name}"
          hint="Printed when this rule hides the item."
          onChange={(chatMessageWhenHidden) => {
            onChange({ chatMessageWhenHidden });
          }}
        />
      </Section>

      <Section title="Name">
        <ColorTextField
          id={id('replace-name')}
          label="Replace name"
          context="names"
          value={actions.replaceName}
          placeholder="{name}"
          hint="A new name; {name} is the game's own."
          onChange={(replaceName) => {
            onChange({ replaceName });
          }}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <ColorTextField
            id={id('name-prefix')}
            label="Prefix"
            context="names"
            value={actions.namePrefix}
            placeholder="ÿc1* "
            onChange={(namePrefix) => {
              onChange({ namePrefix });
            }}
          />
          <ColorTextField
            id={id('name-suffix')}
            label="Suffix"
            context="names"
            value={actions.nameSuffix}
            placeholder=" ({sockets})"
            onChange={(nameSuffix) => {
              onChange({ nameSuffix });
            }}
          />
        </div>
      </Section>

      <LabelSection idPrefix={idPrefix} actions={actions} onChange={onChange} />

      <Section title="Chat">
        <ColorTextField
          id={id('chat-message')}
          label="Chat line"
          context="chat"
          defaultColor="0"
          value={actions.chatMessage}
          placeholder="ÿc4Drop: {link}"
          hint="Printed when the item drops; replaces the drop line of notify."
          onChange={(chatMessage) => {
            onChange({ chatMessage });
          }}
        />
        <CheckField
          id={id('notify')}
          label="Notify"
          hint={
            <>
              Prints the filter&apos;s drop line: <code className="break-all">{dropFormat}</code>
              {effective.chatMessage !== undefined ? ' (the chat line above replaces it).' : '.'}
            </>
          }
          checked={actions.notify === true}
          onChange={(value) => {
            onChange({ notify: flag(value) });
          }}
        />
      </Section>

      <Section title="Sound">
        <SoundField
          idPrefix={idPrefix}
          sound={actions.sound}
          soundVolume={actions.soundVolume}
          filterVolume={filter.soundVolume}
          onSoundChange={(sound) => {
            onChange({ sound });
          }}
          onVolumeChange={(soundVolume) => {
            onChange({ soundVolume });
          }}
        />
      </Section>

      <Section title="Minimap icon">
        <IconField
          idPrefix={idPrefix}
          icon={actions.icon}
          onChange={(icon) => {
            onChange({ icon });
          }}
        />
      </Section>

      <Section title="Droplight">
        <CheckField
          id={id('droplight')}
          label="Droplight"
          hint="A beam of light with a sparkle on the item. HD graphics only."
          checked={actions.droplight !== undefined}
          onChange={(value) => {
            onChange({ droplight: value ? {} : undefined });
          }}
        />
        {actions.droplight !== undefined && (
          <Field id={id('droplight-color')} label="Tint">
            <ColorControl
              id={id('droplight-color')}
              label="droplight tint"
              value={actions.droplight.color}
              noneLabel="the game's white beam"
              onChange={(color) => {
                onChange({ droplight: color === undefined ? {} : { color: [color[0], color[1], color[2]] } });
              }}
            />
          </Field>
        )}
      </Section>

      {owner === 'style' && (
        <Section title="Notes">
          <Field id={id('comment')} label="Comment" hint="A note for yourself; the plugin ignores it.">
            <Input
              id={id('comment')}
              value={actions.comment ?? ''}
              autoComplete="off"
              onChange={(event) => {
                onChange({ comment: event.target.value === '' ? undefined : event.target.value });
              }}
            />
          </Field>
        </Section>
      )}
    </div>
  );
}
