import {
  apiClient,
} from "./apiClient";

export async function fetchMessages({
  conversationId,
  before,
  limit = 50,
}) {
  const response =
    await apiClient.get(
      `/conversations/${conversationId}/messages`,
      {
        params: {
          limit,

          ...(before
            ? { before }
            : {}),
        },
      }
    );

  return response.data.data;
}