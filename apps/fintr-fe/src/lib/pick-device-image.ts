import type { ChangeEvent } from "react";

export type PickDeviceImageOptions = {
  capture?: "environment" | "user";
};

function isIosNativeCapacitor(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const cap = (window as Window & { Capacitor?: { getPlatform?: () => string } }).Capacitor;

  return typeof cap?.getPlatform === "function" && cap.getPlatform() === "ios";
}

function presentFileInput(input: HTMLInputElement): void {
  if (isIosNativeCapacitor()) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        input.click();
      });
    });
    return;
  }

  input.click();
}

/**
 * Opens the device camera (or image picker with camera option) via a transient
 * file input. Appends the input to `document.body` so Android WebViews present
 * the camera intent reliably.
 */
export function pickDeviceImage(
  options: PickDeviceImageOptions = {},
): Promise<File | null> {
  return new Promise((resolve) => {
    if (typeof document === "undefined") {
      resolve(null);
      return;
    }

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = options.capture ?? "environment";
    input.style.display = "none";
    document.body.appendChild(input);

    let settled = false;

    const finish = (file: File | null) => {
      if (settled) {
        return;
      }

      settled = true;
      input.remove();
      resolve(file);
    };

    input.addEventListener("change", () => {
      finish(input.files?.[0] ?? null);
    });

    input.addEventListener("cancel", () => {
      finish(null);
    });

    window.setTimeout(() => {
      if (!settled && !input.files?.length) {
        finish(null);
      }
    }, 300_000);

    presentFileInput(input);
  });
}

export function createFileInputChangeEvent(
  file: File,
): ChangeEvent<HTMLInputElement> {
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);

  const input = document.createElement("input");
  input.type = "file";
  Object.defineProperty(input, "files", {
    value: dataTransfer.files,
    configurable: true,
  });

  return {
    target: input,
    currentTarget: input,
  } as ChangeEvent<HTMLInputElement>;
}
