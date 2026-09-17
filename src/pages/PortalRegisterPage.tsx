import { Navigate } from 'react-router-dom';

/**
 * Partner self-registration has been decommissioned.
 * Partners can only access the portal when explicitly invited by a workspace.
 */
export function PortalRegisterPage() {
  return <Navigate to="/login?portal=partner" replace />;
}
