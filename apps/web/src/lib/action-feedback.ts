import { toast } from "sonner";

const requestErrorPattern = /^Request failed:\s*(\d{3})\s*(.*)$/s;

const toUserMessage = (error: unknown, fallbackMessage: string): string => {
  if (!(error instanceof Error) || !error.message) {
    return fallbackMessage;
  }

  const match = error.message.match(requestErrorPattern);

  if (!match) {
    return error.message;
  }

  const status = Number(match[1]);
  const rawMessage = match[2]?.trim() ?? "";

  if (status >= 500) {
    return "Server error. Please try again.";
  }

  if (status === 401) {
    return "You need to sign in again.";
  }

  if (status === 403) {
    return "You do not have permission for this action.";
  }

  if (status === 404) {
    return "The requested resource was not found.";
  }

  if (status === 409) {
    return rawMessage.length > 0 ? rawMessage : "This action conflicts with current data. Please refresh and try again.";
  }

  if (status >= 400) {
    return rawMessage.length > 0 ? rawMessage : fallbackMessage;
  }

  return fallbackMessage;
};

export const notifySuccess = (message: string) => {
  toast.success(message);
};

export const notifyError = (error: unknown, fallbackMessage: string) => {
  toast.error(toUserMessage(error, fallbackMessage));
};
