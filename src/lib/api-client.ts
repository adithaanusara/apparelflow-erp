export type ApiError = {
  status: number;
  code: string;
  message: string;
  fieldErrors?: Record<string, string>;
};

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError };

export function postJson<T>(url: string, body?: unknown) {
  return sendJson<T>("POST", url, body);
}

// Sends JSON to one of this app's API routes and never throws: network
// failures come back as an error result the form can display.
export async function sendJson<T>(
  method: "POST" | "PUT",
  url: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
  } catch {
    return {
      ok: false,
      error: {
        status: 0,
        code: "NETWORK_ERROR",
        message: "Could not reach the server. Check your connection.",
      },
    };
  }

  const payload = await response.json().catch(() => null);
  if (response.ok) return { ok: true, data: payload as T };

  return {
    ok: false,
    error: {
      status: response.status,
      code: payload?.error?.code ?? "UNKNOWN_ERROR",
      message: payload?.error?.message ?? "Something went wrong.",
      fieldErrors: payload?.error?.fieldErrors,
    },
  };
}
