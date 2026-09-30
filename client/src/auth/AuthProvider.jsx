import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AuthContext,
} from "./AuthContext";

import {
  apiClient,
  refreshSession,
} from "../api/apiClient";

import {
  loginAccount,
} from "../api/authApi";

import {
  clearAccessToken,
  setAccessToken,
} from "../api/tokenStore";

// ======================================================
// AUTH PROVIDER
// ======================================================

export function AuthProvider({
  children,
}) {
  const [
    user,
    setUser,
  ] =
    useState(null);

  const [
    isInitializing,
    setIsInitializing,
  ] =
    useState(true);

  // ====================================================
  // LOGIN
  // ====================================================

  const login =
    useCallback(
      async ({
        email,
        phoneNumber,
        password,
      }) => {
        const data =
          await loginAccount({
            email,
            phoneNumber,
            password,
          });

        const accessToken =
          data?.accessToken;

        const authenticatedUser =
          data?.user;

        if (!accessToken) {
          throw new Error(
            "Login response did not include an access token."
          );
        }

        if (!authenticatedUser) {
          throw new Error(
            "Login response did not include the authenticated user."
          );
        }

        setAccessToken(
          accessToken
        );

        setUser(
          authenticatedUser
        );

        return authenticatedUser;
      },
      []
    );

  // ====================================================
  // LOGOUT
  // ====================================================

  const logout =
    useCallback(
      async () => {
        try {
          await apiClient
            .post(
              "/auth/logout"
            );
        } finally {
          clearAccessToken();

          setUser(null);
        }
      },
      []
    );

  // ====================================================
  // RESTORE EXISTING SESSION
  //
  // IMPORTANT:
  //
  // refreshSession() contains the single-flight
  // protection required for rotating refresh tokens.
  // ====================================================

  const restoreSession =
    useCallback(
      async () => {
        try {
          const data =
            await refreshSession();

          const restoredUser =
            data?.user;

          if (!restoredUser) {
            throw new Error(
              "Refresh response did not include the authenticated user."
            );
          }

          setUser(
            restoredUser
          );
        } catch {
          clearAccessToken();

          setUser(null);
        } finally {
          setIsInitializing(
            false
          );
        }
      },
      []
    );

  // ====================================================
  // INITIAL SESSION RESTORE
  // ====================================================

  useEffect(
    () => {
      restoreSession();
    },
    [
      restoreSession,
    ]
  );

  // ====================================================
  // SESSION EXPIRATION EVENT
  // ====================================================

  useEffect(
    () => {
      function handleSessionExpired() {
        clearAccessToken();

        setUser(null);
      }

      window.addEventListener(
        "auth:session-expired",
        handleSessionExpired
      );

      return () => {
        window.removeEventListener(
          "auth:session-expired",
          handleSessionExpired
        );
      };
    },
    []
  );

  // ====================================================
  // CONTEXT VALUE
  // ====================================================

  const value =
    useMemo(
      () => ({
        user,

        isAuthenticated:
          Boolean(user),

        isInitializing,

        login,
        logout,
      }),

      [
        user,
        isInitializing,
        login,
        logout,
      ]
    );

  return (
    <AuthContext.Provider
      value={value}
    >
      {children}
    </AuthContext.Provider>
  );
}