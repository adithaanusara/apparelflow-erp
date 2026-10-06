import { NextResponse, type NextRequest } from "next/server";

export type FieldErrors = Record<string, string>;

// Thrown anywhere below a route handler to end the request with a specific
// status. Everything else that is thrown becomes a 500.
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fieldErrors?: FieldErrors,
  ) {
    super(message);
  }
}

function errorResponse(error: HttpError) {
  return NextResponse.json(
    {
      error: {
        code: error.code,
        message: error.message,
        ...(error.fieldErrors && { fieldErrors: error.fieldErrors }),
      },
    },
    { status: error.status },
  );
}

// Wraps a route handler so every failure leaves as the same JSON error shape.
export function route<Context>(
  handler: (request: NextRequest, context: Context) => Promise<Response>,
) {
  return async (request: NextRequest, context: Context): Promise<Response> => {
    try {
      return await handler(request, context);
    } catch (error) {
      if (error instanceof HttpError) return errorResponse(error);
      console.error(error);
      return errorResponse(
        new HttpError(500, "INTERNAL_ERROR", "Something went wrong."),
      );
    }
  };
}

// Requiring application/json also blocks cross-site HTML form posts, which
// cannot send that content type.
export async function readJsonObject(
  request: Request,
): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new HttpError(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "Send the request body as application/json.",
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, "INVALID_JSON", "Request body is not valid JSON.");
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new HttpError(
      400,
      "INVALID_BODY",
      "Request body must be a JSON object.",
    );
  }
  return body as Record<string, unknown>;
}

// A path segment that is not a plain positive integer cannot match any row.
export function parseIdParam(raw: string, resource: string): number {
  if (!/^[1-9]\d{0,8}$/.test(raw)) {
    throw new HttpError(404, "NOT_FOUND", `${resource} not found.`);
  }
  return Number(raw);
}
