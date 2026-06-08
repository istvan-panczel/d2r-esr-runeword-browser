import { useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { PageHeader } from '@/components/PageHeader';
import { Spinner } from '@/components/ui/spinner';
import { RequestState } from '@/core/types';
import { selectAuthInitialized, selectIsAuthenticated } from '@/features/auth';
import { createBuildRequested, resetCreateStatus, selectCreateBuildStatus } from '../store';
import { BuildForm } from '../components/BuildForm';
import { EMPTY_BUILD_FORM, type BuildFormSubmit } from '../components/buildFormModel';

export function CreateBuildScreen() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const initialized = useSelector(selectAuthInitialized);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const createStatus = useSelector(selectCreateBuildStatus);

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

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Create Build" />
      <BuildForm
        initialValues={EMPTY_BUILD_FORM}
        submitLabel="Save Build"
        saving={createStatus === RequestState.LOADING}
        saved={createStatus === RequestState.SUCCESS}
        onSubmit={handleSubmit}
        onCancel={() => {
          void navigate('/builds');
        }}
      />
    </div>
  );
}
