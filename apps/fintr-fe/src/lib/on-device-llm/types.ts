export type OnDeviceLlmReadiness =
  | "unsupported"
  | "not_ready"
  | "ready"
  | "error";

export type OnDeviceLlmPromptOptions = {
  message: string;
  instructions?: string;
  onChunk?: (text: string) => void;
};

export type OnDeviceLlmPromptResult = {
  text: string;
  usedOnDevice: true;
};

export const isNetworkError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = (error as { code?: string }).code;
  if (code === "ERR_NETWORK" || code === "ECONNABORTED") {
    return true;
  }

  const message = (error as { message?: string }).message ?? "";
  return /network error/i.test(message);
};

