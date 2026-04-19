const requestStatusPattern = /^Request failed:\s*(\d{3})\b/;

export const getRequestStatus = (error: unknown): number | null => {
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

export const isRequestStatus = (error: unknown, status: number): boolean => getRequestStatus(error) === status;

