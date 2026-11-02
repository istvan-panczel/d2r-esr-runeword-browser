import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { createBlank, importText } from '../store/lootFilterSlice';
import { templateBasedOn } from '../utils/basedOn';
import { draftPath } from '../utils/library';
import { checkFilterText, fileBaseName, importDescription } from '../utils/readFilterText';
import { TEMPLATE_NAME, loadTemplateText } from '../utils/template';

/**
 * The ways to start a new draft (New, Upload, Start from Sully's): each adds a library entry and opens it in the
 * editor. Shared by the My filters tab and the pinned Sully card on the Shared tab.
 */
export function useStartFilter() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [loadingTemplate, setLoadingTemplate] = useState(false);

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

  const startFromTemplate = async () => {
    setLoadingTemplate(true);
    try {
      const text = await loadTemplateText();
      const check = checkFilterText(text);
      if (!check.ok) throw new Error(check.message);
      const action = importText({ name: TEMPLATE_NAME, text, source: 'template', basedOn: templateBasedOn() });
      dispatch(action);
      void navigate(draftPath(action.payload.id));
    } catch (error) {
      console.error('[Loot filters] Could not load the template', error);
      toast.error(`Could not load ${TEMPLATE_NAME}`, { description: error instanceof Error ? error.message : undefined });
    } finally {
      setLoadingTemplate(false);
    }
  };

  return { createNew, upload, startFromTemplate, loadingTemplate };
}
