"use client";

import { useEffect, useState } from "react";

import { isNativeCapacitor } from "@/lib/capacitor";
import {
  AI_LLM_PRIORITY_STORAGE_KEY,
  getOnDeviceLlmReadiness,
  initializeOnDeviceLlm,
  parseAiLlmPriority,
} from "@/lib/on-device-llm";
import type { AiLlmPriority, OnDeviceLlmReadiness } from "@/lib/on-device-llm";
import { useLocalStorage } from "@/hooks/useLocalStorage";

export const useAiLlmPriority = () => {
  const canChoose = isNativeCapacitor();
  const [storedPriority, setStoredPriority] = useLocalStorage(
    AI_LLM_PRIORITY_STORAGE_KEY,
    "cloud",
  );
  const [readiness, setReadiness] = useState<OnDeviceLlmReadiness>(
    canChoose ? getOnDeviceLlmReadiness() : "unsupported",
  );

  const priority = canChoose
    ? parseAiLlmPriority(storedPriority)
    : ("cloud" as AiLlmPriority);

  useEffect(() => {
    if (!canChoose) {
      return;
    }

    void initializeOnDeviceLlm().then(setReadiness);
  }, [canChoose]);

  const setPriority = (next: AiLlmPriority) => {
    if (!canChoose) {
      return;
    }

    setStoredPriority(next);
  };

  return {
    canChoose,
    priority,
    setPriority,
    readiness,
    localAvailable: readiness === "ready",
  };
};
