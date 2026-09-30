import axios from "axios";

import {
  getAccessToken,
  setAccessToken,
  clearAccessToken,
} from "./tokenStore";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL;

if (!API_BASE_URL) {
  throw new Error(
    "VITE_API_BASE_URL is required"
  );
}

// ======================================================
// NORMAL AUTHENTICATED API CLIENT
// ======================================================

const apiClient =
  axios.create({
    baseURL:
      API_BASE_URL,

    withCredentials:
      true,

    timeout:
      15000,

    headers: {
      "Content-Type":
        "application/json",
    },
  });

// ======================================================
// AUTH CLIENT
//
// This client has no response interceptor.
// That prevents infinite refresh loops.
// ======================================================

const refreshClient =
  axios.create({
    baseURL:
      API_BASE_URL,

    withCredentials:
      true,

    timeout:
      15000,

    headers: {
      "Content-Type":
        "application/json",
    },
  });

// ======================================================
// SINGLE-FLIGHT REFRESH
//
// Only ONE refresh request may run at a time.
//
// This is especially important because ChatSphere
// rotates refresh tokens.
// ======================================================

let refreshPromise =
  null;

async function refreshSession() {
  if (!refreshPromise) {
    refreshPromise =
      refreshClient
        .post(
          "/auth/refresh"
        )
        .then(
          (response) => {
            const data =
              response.data?.data;

            const accessToken =
              data?.accessToken;

            if (!accessToken) {
              throw new Error(
                "Refresh response did not include an access token."
              );
            }

            setAccessToken(
              accessToken
            );

            return data;
          }
        )
        .catch(
          (error) => {
            clearAccessToken();

            window.dispatchEvent(
              new CustomEvent(
                "auth:session-expired"
              )
            );

            throw error;
          }
        )
        .finally(
          () => {
            refreshPromise =
              null;
          }
        );
  }

  return refreshPromise;
}

// ======================================================
// REQUEST INTERCEPTOR
// ======================================================

apiClient.interceptors
  .request.use(
    (config) => {
      const token =
        getAccessToken();

      if (token) {
        config.headers =
          config.headers || {};

        config.headers
          .Authorization =
          `Bearer ${token}`;
      }

      return config;
    },

    (error) =>
      Promise.reject(
        error
      )
  );

// ======================================================
// RESPONSE INTERCEPTOR
//
// If access token expires:
// 1. refresh once
// 2. receive new token
// 3. retry original request
// ======================================================

apiClient.interceptors
  .response.use(
    (response) =>
      response,

    async (error) => {
      const originalRequest =
        error.config;

      const status =
        error.response
          ?.status;

      if (
        status !== 401 ||
        !originalRequest ||
        originalRequest._retry
      ) {
        return Promise.reject(
          error
        );
      }

      const requestUrl =
        String(
          originalRequest.url ||
          ""
        );

      // Never create refresh loops
      // around authentication endpoints.
      if (
        requestUrl.includes(
          "/auth/login"
        ) ||
        requestUrl.includes(
          "/auth/refresh"
        ) ||
        requestUrl.includes(
          "/auth/register"
        )
      ) {
        return Promise.reject(
          error
        );
      }

      originalRequest._retry =
        true;

      try {
        const refreshData =
          await refreshSession();

        const newAccessToken =
          refreshData
            .accessToken;

        originalRequest.headers =
          originalRequest.headers ||
          {};

        originalRequest
          .headers
          .Authorization =
          `Bearer ${newAccessToken}`;

        return apiClient(
          originalRequest
        );
      } catch (
        refreshError
      ) {
        return Promise.reject(
          refreshError
        );
      }
    }
  );

export {
  apiClient,
  refreshClient,
  refreshSession,
};