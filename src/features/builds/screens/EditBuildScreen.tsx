import { useEffect } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/PageHeader';
import { Spinner } from '@/components/ui/spinner';
import { RequestState } from '@/core/types';
import { selectAuthInitialized, selectAuthUserId, selectIsAuthenticated } from '@/features/auth';
import { asBuildData } from '../buildData';
import type { CharacterClass } from '../constants';
import {
  clearDetail,
  fetchBuildRequested,
  resetUpdateStatus,
  selectDetailBuild,
  selectDetailNotFound,
  selectDetailStatus,
  selectUpdateBuildStatus,
  updateBuildRequested,
} from '../store';
import { BuildForm } from '../components/BuildForm';
import type { BuildFormSubmit, BuildFormValues } from '../components/buildFormModel';

export function EditBuildScreen() {
  const { buildId } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const initialized = useSelector(selectAuthInitialized);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const currentUserId = useSelector(selectAuthUserId);
  const build = useSelector(selectDetailBuild);
  const detailStatus = useSelector(selectDetailStatus);
  const notFound = useSelector(selectDetailNotFound);
  const updateStatus = useSelector(selectUpdateBuildStatus);

  useEffect(() => {
    dispatch(resetUpdateStatus());
  }, [dispatch]);

  useEffect(() => {
    if (buildId === undefined) return;
    dispatch(fetchBuildRequested(buildId));
    return () => {
      dispatch(clearDetail());
    };
  }, [dispatch, buildId]);

  useEffect(() => {
    if (updateStatus === RequestState.SUCCESS && buildId !== undefined) {
      void navigate(`/build/${buildId}`, { replace: true });
    }
  }, [updateStatus, navigate, buildId]);

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
  if (buildId === undefined || notFound) {
    return <Navigate to="/builds" replace />;
  }
  // Wait until the build matching this route is loaded (detail state may be stale).
  if (build === null || build.id !== buildId) {
    if (detailStatus === RequestState.ERROR) {
      return (
        <div className="mx-auto max-w-2xl py-16 text-center">
          <p className="text-muted-foreground">Couldn’t load this build. The backend may be waking up.</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => {
              dispatch(fetchBuildRequested(buildId));
            }}
          >
            Try again
          </Button>
        </div>
      );
    }
    return (
      <div className="flex justify-center py-16">
        <Spinner className="size-8" />
      </div>
    );
  }
  // Owner-only.
  if (currentUserId === null || build.user_id !== currentUserId) {
    return <Navigate to={`/build/${build.id}`} replace />;
  }

  const buildData = asBuildData(build.build_data);
  const initialValues: BuildFormValues = {
    name: build.name,
    description: build.description ?? '',
    characterClass: build.class as CharacterClass,
    items: buildData.items ?? {},
    weaponSwap: buildData.weaponSwap ?? {},
    mercenary: buildData.mercenary ?? {},
    itemNotes: buildData.itemNotes ?? {},
    weaponSwapNotes: buildData.weaponSwapNotes ?? {},
    mercenaryNotes: buildData.mercenaryNotes ?? {},
    charms: buildData.charms ?? [],
    ascendancy: buildData.ascendancy ?? null,
    skills: buildData.skills ?? '',
  };

  const handleSubmit = (payload: BuildFormSubmit) => {
    dispatch(
      updateBuildRequested({
        id: buildId,
        name: payload.name,
        description: payload.description,
        class: payload.characterClass,
        buildData: payload.buildData,
      })
    );
  };

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Edit Build" />
      <BuildForm
        initialValues={initialValues}
        submitLabel="Save Changes"
        saving={updateStatus === RequestState.LOADING}
        saved={updateStatus === RequestState.SUCCESS}
        onSubmit={handleSubmit}
        onCancel={() => {
          void navigate(`/build/${build.id}`);
        }}
      />
    </div>
  );
}
