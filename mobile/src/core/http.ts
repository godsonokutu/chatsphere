export class ApiError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 0, code = "NETWORK_ERROR") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export type RequestOptions = {
  method?: string;
  body?: unknown;
  token?: string;
};
export type Transport = <T>(
  path: string,
  options?: RequestOptions,
) => Promise<T>;

export function validateApiUrl(
  value: string | undefined,
  development: boolean,
) {
  if (!value)
    throw new Error(
      "Set EXPO_PUBLIC_API_URL to your ChatSphere API URL ending in /api.",
    );
  const url = new URL(value);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !/^https?:$/.test(url.protocol)
  ) {
    throw new Error(
      "Use an API URL without credentials, query strings or fragments.",
    );
  }
  if (!development && url.protocol !== "https:")
    throw new Error("The release app requires an HTTPS API.");
  if (url.pathname.replace(/\/$/, "") !== "/api")
    throw new Error("The API URL must end in /api.");
  return url.toString().replace(/\/$/, "");
}

export function createTransport(baseUrl: string): Transport {
  return async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(baseUrl + path, {
        method: options.method || "GET",
        credentials: "omit",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          ...(options.body !== undefined
            ? { "Content-Type": "application/json" }
            : {}),
          ...(options.token
            ? { Authorization: `Bearer ${options.token}` }
            : {}),
        },
        ...(options.body !== undefined
          ? { body: JSON.stringify(options.body) }
          : {}),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.success !== true) {
        throw new ApiError(
          result?.message ||
            result?.error?.message ||
            "The server could not complete the request.",
          response.status,
          result?.code || result?.error?.code || "API_ERROR",
        );
      }
      return result.data as T;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        "Could not reach ChatSphere. Check your connection and try again.",
      );
    } finally {
      clearTimeout(timeout);
    }
  };
}
