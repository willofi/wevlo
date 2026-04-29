export type ApiErrorPayload = {
  code?: string;
  message?: string;
};

export class ApiRequestError extends Error {
  code: string | null;
  status: number;

  constructor(input: { code?: string | null; fallbackMessage: string; message?: string | null; status: number }) {
    const resolvedMessage = input.message?.trim() || input.fallbackMessage;
    super(resolvedMessage);
    this.name = "ApiRequestError";
    this.code = input.code?.trim() || null;
    this.status = input.status;
  }
}

const requestStatusPattern = /^Request failed:\s*(\d{3})\b/;

const parseJsonSafely = (value: string): ApiErrorPayload | null => {
  try {
    const parsed = JSON.parse(value) as unknown;

    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return parsed as ApiErrorPayload;
  } catch {
    return null;
  }
};

export const buildApiRequestError = async (response: Response): Promise<ApiRequestError> => {
  const rawBody = await response.text();
  const parsedBody = parseJsonSafely(rawBody);
  const fallbackMessage = rawBody.trim() || `Request failed with status ${response.status}`;

  return new ApiRequestError({
    code: parsedBody?.code ?? null,
    fallbackMessage,
    message: parsedBody?.message ?? null,
    status: response.status
  });
};

export const getRequestStatus = (error: unknown): number | null => {
  if (error instanceof ApiRequestError) {
    return error.status;
  }

  if (!(error instanceof Error)) {
    return null;
  }

  const match = error.message.match(requestStatusPattern);

  if (!match) {
    return null;
  }

  const status = Number(match[1]);

  return Number.isFinite(status) ? status : null;
};

export const getRequestCode = (error: unknown): string | null => {
  if (error instanceof ApiRequestError) {
    return error.code;
  }

  return null;
};

export const getRequestMessage = (error: unknown): string | null => {
  if (error instanceof ApiRequestError) {
    return error.message;
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }

  return null;
};

export const isRequestStatus = (error: unknown, status: number): boolean => getRequestStatus(error) === status;
