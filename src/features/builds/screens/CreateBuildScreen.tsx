import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { PageShell } from '@/components/PageShell';
import { Spinner } from '@/components/ui/spinner';
import { RequestState } from '@/core/types';
import { selectAuthInitialized, selectIsAuthenticated } from '@/features/auth';
import { createBuildRequested, resetCreateStatus, selectCreateBuildStatus } from '../store';
import type { BuildDraft, SaveImportReport } from '@/features/character/engine/buildDraft';
import { BuildForm } from '../components/BuildForm';
import { SaveFileCard } from '../components/SaveFileCard';
import { EMPTY_BUILD_FORM, type BuildFormSubmit, type BuildFormValues } from '../components/buildFormModel';

interface FormSeed {
  /** Remounts the form: BuildForm reads its initial values once */
  readonly key: number;
  readonly values: BuildFormValues;
  readonly report: SaveImportReport | null;
}

export function CreateBuildScreen() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const initialized = useSelector(selectAuthInitialized);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const createStatus = useSelector(selectCreateBuildStatus);
  const [seed, setSeed] = useState<FormSeed>({ key: 0, values: EMPTY_BUILD_FORM, report: null });
  const [touched, setTouched] = useState(false);

  // Clear any stale create status from a previous visit.
  useEffect(() => {
    dispatch(resetCreateStatus());
  }, [dispatch]);

  // Navigate to the listing once the build is created.
  useEffect(() => {
    if (createStatus === RequestState.SUCCESS) {
      void navigate('/builds', { replace: true });
    }
  }, [createStatus, navigate]);

  if (!initialized) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="size-8" />
      </div>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to="/builds" replace />;
  }

  const handleSubmit = (payload: BuildFormSubmit) => {
    dispatch(
      createBuildRequested({
        name: payload.name,
        description: payload.description,
        class: payload.characterClass,
        buildData: payload.buildData,
      })
    );
  };

  const handleDraft = (draft: BuildDraft) => {
    setSeed({ key: seed.key + 1, values: draft.values, report: draft.report });
    setTouched(true);
  };

  return (
    <PageShell title="Create Build">
      <SaveFileCard
        importedFileName={seed.report?.fileName ?? null}
        confirmReplace={() => !touched || window.confirm('Replace what you have entered with this save file?')}
        onDraft={handleDraft}
      />
      <BuildForm
        key={seed.key}
        initialValues={seed.values}
        importReport={seed.report}
        onTouched={() => {
          setTouched(true);
        }}
        submitLabel="Save Build"
        saving={createStatus === RequestState.LOADING}
        saved={createStatus === RequestState.SUCCESS}
        onSubmit={handleSubmit}
        onCancel={() => {
          void navigate('/builds');
        }}
      />
    </PageShell>
  );
}
