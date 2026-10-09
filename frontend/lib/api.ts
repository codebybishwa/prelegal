/** An error from the backend API, with a message fit to show the user. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
  }
}

export const SESSION_EXPIRED = "Your session has ended. Please sign in again.";

/** The user-facing message in a FastAPI error body: a string detail, or the first validation error. */
async function errorDetail(response: Response): Promise<string | null> {
  const detail = await response
    .json()
    .then((body) => body?.detail)
    .catch(() => null);
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && typeof detail[0]?.msg === "string") return detail[0].msg;
  return null;
}

/**
 * Calls a same-origin JSON endpoint (the session cookie goes along automatically) and returns
 * the parsed body, or undefined for 204. Throws ApiError, using `fallback` when the backend
 * can't be reached or gives no usable message.
 */
export async function apiFetch<T>(path: string, fallback: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(fallback, null);
  }

  if (!response.ok) {
    throw new ApiError((await errorDetail(response)) ?? fallback, response.status);
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
