import { toast } from "sonner";
import { getRequestCode, getRequestMessage, getRequestStatus } from "@/lib/request-error";

const toUserMessage = (error: unknown, fallbackMessage: string): string => {
  const status = getRequestStatus(error);
  const code = getRequestCode(error);
  const message = getRequestMessage(error);

  if (status === null) {
    if (message) {
      return message;
    }

    return fallbackMessage;
  }

  if (status >= 500) {
    return "서버 처리 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요.";
  }

  if (status === 401) {
    return "로그인이 만료되었어요. 다시 로그인해 주세요.";
  }

  if (status === 403) {
    return "이 작업을 수행할 권한이 없어요.";
  }

  if (status === 404) {
    return "요청한 대상을 찾을 수 없어요.";
  }

  if (status === 409) {
    return message ?? "현재 상태와 충돌해서 요청을 처리할 수 없어요. 새로고침 후 다시 시도해 주세요.";
  }

  if (status >= 400) {
    if (code === "workspace.cannot_remove_self") {
      return "자기 자신은 워크스페이스에서 내보낼 수 없어요.";
    }

    return message ?? fallbackMessage;
  }

  return fallbackMessage;
};

export const notifySuccess = (message: string) => {
  toast.success(message);
};

export const notifyError = (error: unknown, fallbackMessage: string) => {
  toast.error(toUserMessage(error, fallbackMessage));
};
