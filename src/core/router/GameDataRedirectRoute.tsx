import { Navigate, useLocation, useParams } from 'react-router-dom';
import { gameDataRedirectTarget } from './gameDataRedirect';
import { NotFoundScreen } from './NotFoundScreen';

/** The `game-data/*` route: old Game Data page URLs redirect to the top-level pages, anything else is not found. */
export function GameDataRedirectRoute() {
  const { '*': splat = '' } = useParams();
  const { search, hash } = useLocation();
  const target = gameDataRedirectTarget(splat, search, hash);
  if (target === null) return <NotFoundScreen />;
  return <Navigate to={target} replace />;
}
