import {
  apiClient,
} from "./apiClient";

// ======================================================
// SEARCH ACTIVE USERS
// ======================================================

export async function searchUsers({
  query,
  limit = 10,
}) {
  const response =
    await apiClient.get(
      "/users/search",
      {
        params: {
          q:
            query,

          limit,
        },
      }
    );

  return response.data.data;
}