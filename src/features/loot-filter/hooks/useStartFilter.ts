import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { createBlank, importText } from '../store/lootFilterSlice';
import { templateStartInput } from '../utils/basedOn';
import { draftPath } from '../utils/library';
import { checkFilterText, fileBaseName, importDescription } from '../utils/readFilterText';
import { BUNDLED_TEMPLATES, type BundledTemplateId } from '../utils/template';
import { loadTemplate } from '../utils/templateSource';

/**
 * The ways to start a new draft (New, Upload, Start from a bundled template): each adds a library entry and opens it in
 * the editor. Shared by the My filters tab and the pinned template cards on the Shared tab.
 */
export function useStartFilter() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  /** The template whose start is loading its file (one at a time: the start buttons are disabled meanwhile). */
  const [loadingTemplate, setLoadingTemplate] = useState<BundledTemplateId | null>(null);

  /** A blank filter opens on the Rules tab; its Example rules button offers a starter set. */
  const createNew = (name: string) => {
    const action = createBlank(name);
    dispatch(action);
    void navigate(draftPath(action.payload.id));
  };

  const upload = async (file: File) => {
    const text = await file.text();
    const check = checkFilterText(text);
    if (!check.ok) {
      toast.error(`Could not read ${file.name}`, { description: check.message });
      return;
    }
    const action = importText({ name: check.title ?? fileBaseName(file.name), text, source: 'upload' });
    dispatch(action);
    const problems = check.diagnostics.length + check.notes.length;
    toast.success(`Imported ${file.name}`, {
      description: importDescription(problems, check.notes),
    });
    void navigate(draftPath(action.payload.id));
  };

  const startFromTemplate = async (id: BundledTemplateId) => {
    const { name } = BUNDLED_TEMPLATES[id];
    setLoadingTemplate(id);
    try {
      const action = importText(templateStartInput(await loadTemplate(id)));
      dispatch(action);
      void navigate(draftPath(action.payload.id));
    } catch (error) {
      console.error(`[Loot filters] Could not load the template ${id}`, error);
      toast.error(`Could not load ${name}`, { description: error instanceof Error ? error.message : undefined });
    } finally {
      setLoadingTemplate(null);
    }
  };

  return { createNew, upload, startFromTemplate, loadingTemplate };
}
