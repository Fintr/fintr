import type { OnDeviceLlmReadiness } from "./types";
import { isNetworkError } from "./types";

export const AI_LLM_PRIORITY_STORAGE_KEY = "fintr_ai_llm_priority";

export type AiLlmPriority = "local" | "cloud";

export type AiLlmRoute = "local" | "cloud";

export const isAiLlmPriority = (value: unknown): value is AiLlmPriority =>
  value === "local" || value === "cloud";

export const parseAiLlmPriority = (value: unknown): AiLlmPriority =>
  isAiLlmPriority(value) ? value : "cloud";

export const resolveAiLlmRoute = (params: {
  priority: AiLlmPriority;
  isNative: boolean;
  isOnline: boolean;
  readiness: OnDeviceLlmReadiness;
}): AiLlmRoute => {
  const canUseLocal =
    params.isNative && params.readiness === "ready";

  if (!canUseLocal) {
    return "cloud";
  }

  if (params.priority === "local") {
    return "local";
  }

  return params.isOnline ? "cloud" : "local";
};

export const shouldFallbackToOnDeviceLlm = (params: {
  isNative: boolean;
  readiness: OnDeviceLlmReadiness;
  error: unknown;
  priority: AiLlmPriority;
}): boolean => {
  if (params.priority === "local") {
    return false;
  }

  if (!params.isNative || params.readiness !== "ready") {
    return false;
  }

  return isNetworkError(params.error);
};

export const shouldFallbackToCloudAfterLocalFailure = (params: {
  priority: AiLlmPriority;
  isOnline: boolean;
}): boolean => params.priority === "local" && params.isOnline;
