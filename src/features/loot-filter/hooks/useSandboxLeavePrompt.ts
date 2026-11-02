import { useEffect } from 'react';
import { useDispatch, useStore } from 'react-redux';
import { useBlocker } from 'react-router-dom';
import type { RootState } from '@/core/store';
import { discardChanges } from '../store/lootFilterSlice';

const MESSAGE = 'Your changes to this filter are not saved anywhere. Leave and lose them? (Copy to my filters keeps them.)';

function isDirtySandbox(state: RootState): boolean {
  const { target, dirty } = state.lootFilter.editor;
  return target?.kind === 'sandbox' && dirty;
}

/**
 * Asks once before leaving an edited sandbox: in-app navigation (a blocker that reads the store when it fires, so Copy
 * to my filters, which turns the sandbox into a draft right before it navigates, is never blocked) and a page unload.
 * Confirming drops the sandbox edits, so the redirects that may follow do not ask again.
 */
export function useSandboxLeavePrompt(dirtySandbox: boolean) {
  const store = useStore<RootState>();
  const dispatch = useDispatch();
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => currentLocation.pathname !== nextLocation.pathname && isDirtySandbox(store.getState())
  );

  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (window.confirm(MESSAGE)) {
      dispatch(discardChanges());
      blocker.proceed();
    } else {
      blocker.reset();
    }
  }, [blocker, dispatch]);

  useEffect(() => {
    if (!dirtySandbox) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => {
      window.removeEventListener('beforeunload', handler);
    };
  }, [dirtySandbox]);
}
