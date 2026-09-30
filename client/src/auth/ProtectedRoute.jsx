import {
  Navigate,
} from "react-router-dom";

import {
  useAuth,
} from "./useAuth";

export function ProtectedRoute({
  children,
}) {
  const {
    isAuthenticated,
    isInitializing,
  } = useAuth();

  if (isInitializing) {
    return (
      <div>
        Loading ChatSphere...
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  return children;
}