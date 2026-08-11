import { Capacitor } from "@capacitor/core";

import { initCapacitorBridgeIfNeeded } from "@/lib/capacitor-bridge-init";
import { isNativeCapacitor, waitForCapacitor } from "@/lib/capacitor";

import { FINTR_ON_DEVICE_INSTRUCTIONS } from "./instructions";
import type {
  OnDeviceLlmPromptOptions,
  OnDeviceLlmPromptResult,
  OnDeviceLlmReadiness,
} from "./types";

let readiness: OnDeviceLlmReadiness = "not_ready";
let initPromise: Promise<OnDeviceLlmReadiness> | null = null;
let activeChatId: string | null = null;
let listenersRegistered = false;

const mapReadiness = (value: string | undefined): OnDeviceLlmReadiness => {
  if (!value) {
    return "not_ready";
  }

  const normalized = value.toLowerCase();
  if (normalized === "ready" || normalized === "available") {
    return "ready";
  }

  if (normalized === "unsupported" || normalized === "unavailable") {
    return "unsupported";
  }

  if (normalized === "error" || normalized === "failed") {
    return "error";
  }

  return "not_ready";
};

const systemModelPath = (): string => {
  const platform = Capacitor.getPlatform();
  return platform === "ios" ? "Apple Intelligence" : "Gemini Nano";
};

const loadCapgoLlm = async () => {
  initCapacitorBridgeIfNeeded();
  await waitForCapacitor();
  const { CapgoLLM } = await import("@capgo/capacitor-llm");
  return CapgoLLM;
};

export const getOnDeviceLlmReadiness = (): OnDeviceLlmReadiness => {
  if (!isNativeCapacitor()) {
    return "unsupported";
  }

  return readiness;
};

export const initializeOnDeviceLlm = async (): Promise<OnDeviceLlmReadiness> => {
  if (!isNativeCapacitor()) {
    readiness = "unsupported";
    return readiness;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      const CapgoLLM = await loadCapgoLlm();
      const { readiness: rawReadiness } = await CapgoLLM.getReadiness();
      let mapped = mapReadiness(rawReadiness);

      if (mapped !== "ready") {
        await CapgoLLM.setModel({
          path: systemModelPath(),
          maxTokens: 512,
          temperature: 0.35,
        });

        const afterSet = await CapgoLLM.getReadiness();
        mapped = mapReadiness(afterSet.readiness);
      }

      readiness = mapped === "ready" ? "ready" : mapped;
      return readiness;
    } catch (error) {
      console.warn("[on-device-llm] initialize failed:", error);
      readiness = "error";
      return readiness;
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
};

const ensureChatSession = async (): Promise<string> => {
  const CapgoLLM = await loadCapgoLlm();

  if (!activeChatId) {
    const chat = await CapgoLLM.createChat();
    activeChatId = chat.id;
  }

  return activeChatId;
};

const registerStreamingListeners = async (
  chatId: string,
  onChunk?: (text: string) => void,
): Promise<{
  waitForCompletion: () => Promise<string>;
  cleanup: () => Promise<void>;
}> => {
  const CapgoLLM = await loadCapgoLlm();
  let fullText = "";
  let resolveCompletion: ((value: string) => void) | null = null;
  let rejectCompletion: ((reason?: unknown) => void) | null = null;

  const completion = new Promise<string>((resolve, reject) => {
    resolveCompletion = resolve;
    rejectCompletion = reject;
  });

  const textListener = await CapgoLLM.addListener("textFromAi", (event) => {
    if (event.chatId !== chatId) {
      return;
    }

    fullText += event.text;
    onChunk?.(fullText);
  });

  const finishedListener = await CapgoLLM.addListener("aiFinished", (event) => {
    if (event.chatId !== chatId) {
      return;
    }

    resolveCompletion?.(fullText);
  });

  const errorListener = await CapgoLLM.addListener("generationError", (event) => {
    if (event.chatId && event.chatId !== chatId) {
      return;
    }

    rejectCompletion?.(new Error(event.error || "On-device generation failed"));
  });

  return {
    waitForCompletion: () => completion,
    cleanup: async () => {
      await textListener.remove();
      await finishedListener.remove();
      await errorListener.remove();
    },
  };
};

export const promptOnDeviceLlm = async (
  options: OnDeviceLlmPromptOptions,
): Promise<OnDeviceLlmPromptResult> => {
  const currentReadiness = await initializeOnDeviceLlm();
  if (currentReadiness !== "ready") {
    throw new Error("On-device LLM is not ready on this device.");
  }

  const CapgoLLM = await loadCapgoLlm();
  const chatId = await ensureChatSession();
  const { waitForCompletion, cleanup } = await registerStreamingListeners(
    chatId,
    options.onChunk,
  );

  const prompt = [
    options.instructions ?? FINTR_ON_DEVICE_INSTRUCTIONS,
    "",
    `User: ${options.message}`,
  ].join("\n");

  try {
    await CapgoLLM.sendMessage({
      chatId,
      message: prompt,
    });

    const text = await waitForCompletion();
    return {
      text: text.trim(),
      usedOnDevice: true,
    };
  } finally {
    await cleanup();
  }
};

export const resetOnDeviceLlmSession = async (): Promise<void> => {
  activeChatId = null;

  if (!isNativeCapacitor()) {
    return;
  }

  try {
    const CapgoLLM = await loadCapgoLlm();
    if (!listenersRegistered) {
      listenersRegistered = true;
      await CapgoLLM.addListener("readinessChange", (event) => {
        readiness = mapReadiness(event.readiness);
      });
    }
  } catch {
    // Best-effort — web / missing plugin
  }
};

export const __resetOnDeviceLlmForTests = (): void => {
  readiness = "not_ready";
  initPromise = null;
  activeChatId = null;
  listenersRegistered = false;
};
