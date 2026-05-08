/**
 * Saves a Blob as a downloaded file. On native Capacitor (iOS/Android), WebView
 * `<a download>` is unreliable; we write to the app's / public Documents directory
 * so the file persists on the device.
 *
 * Android: @capacitor/filesystem maps Directory.Documents to the public Documents
 * folder via MediaStore (Android 10+) or external storage.
 * iOS: Directory.Documents maps to the app’s Documents container, visible in the
 * Files app. A fallback share sheet is used only when the Documents write fails.
 */

import { Capacitor } from "@capacitor/core";
import { initCapacitorBridgeIfNeeded } from "@/lib/capacitor-bridge-init";
import { isNativeCapacitor, waitForCapacitor } from "@/lib/capacitor";

function sanitizeFilename(name: string): string {
  const trimmed = name.trim() || "download";
  return trimmed.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 200);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(blob);
  });
}

function mimeTypeForFilename(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".csv")) {
    return "text/csv";
  }
  if (lower.endsWith(".txt")) {
    return "text/plain";
  }
  if (lower.endsWith(".json")) {
    return "application/json";
  }
  if (lower.endsWith(".xlsx")) {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  if (lower.endsWith(".xls")) {
    return "application/vnd.ms-excel";
  }
  return "*/*";
}

/**
 * Waits until Capacitor reports ios/android (native plugins), or gives up with false for
 * real browsers. On Android remote-URL mode the bridge can lag behind FintrNativeApp UA;
 * partial manual bridge init must list Filesystem/FileShare in PluginHeaders before import.
 */
async function waitForNativeExportSupport(): Promise<boolean> {
  if (typeof window === "undefined") {
    return false;
  }

  initCapacitorBridgeIfNeeded();

  const maxMs = 8000;
  const start = Date.now();

  while (Date.now() - start < maxMs) {
    await waitForCapacitor();
    const platform = Capacitor.getPlatform();
    if (platform === "ios" || platform === "android") {
      return true;
    }
    if (platform === "web" && !isNativeCapacitor()) {
      return false;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  const platform = Capacitor.getPlatform();
  return platform === "ios" || platform === "android";
}

/**
 * @param blob - File contents
 * @param filename - Suggested filename (e.g. transactions.csv)
 */
export async function downloadBlobAsFile(
  blob: Blob,
  filename: string
): Promise<void> {
  const safeName = sanitizeFilename(filename);
  const mimeType = mimeTypeForFilename(safeName);
  const nativeExport = await waitForNativeExportSupport();

  if (nativeExport) {
    try {
      initCapacitorBridgeIfNeeded();
      const [{ Directory, Encoding, Filesystem }] = await import(
        "@capacitor/filesystem"
      );
      const path = `Downloads/${Date.now()}_${safeName}`;
      const isUtf8Text = /\.(csv|txt|json|md|xml)$/i.test(safeName);

      const writePayload = isUtf8Text
        ? {
            path,
            data: await blob.text(),
            directory: Directory.Documents,
            encoding: Encoding.UTF8,
            recursive: true,
          }
        : {
            path,
            data: await blobToBase64(blob),
            directory: Directory.Documents,
            recursive: true,
          };

      await Filesystem.writeFile(writePayload);
      console.log(`[downloadBlobAsFile] Saved to Documents/Downloads: ${path}`);
      return;
    } catch (err) {
      console.error(
        "[downloadBlobAsFile] Documents write failed, falling back to share",
        err
      );
      // Graceful fallback: write to Cache and open share sheet so the user
      // can still save the file rather than getting a hard error.
      try {
        const [{ Directory, Encoding, Filesystem }, { FileShare }] =
          await Promise.all([
            import("@capacitor/filesystem"),
            import("@/plugins/file-share"),
          ]);
        const fallbackPath = `fintr-downloads/${Date.now()}_${safeName}`;
        const isUtf8Text = /\.(csv|txt|json|md|xml)$/i.test(safeName);

        const writePayload = isUtf8Text
          ? {
              path: fallbackPath,
              data: await blob.text(),
              directory: Directory.Cache,
              encoding: Encoding.UTF8,
              recursive: true,
            }
          : {
              path: fallbackPath,
              data: await blobToBase64(blob),
              directory: Directory.Cache,
              recursive: true,
            };

        const writeResult = await Filesystem.writeFile(writePayload);
        let uri = writeResult.uri;

        if (!uri || String(uri).trim() === "") {
          const uriResult = await Filesystem.getUri({
            directory: Directory.Cache,
            path: fallbackPath,
          });
          uri = uriResult.uri;
        }

        const uriStr = String(uri).trim();

        await FileShare.shareStream({
          uri: uriStr,
          mimeType,
          dialogTitle: "Save or share file",
        });
        return;
      } catch (fallbackErr) {
        console.error(
          "[downloadBlobAsFile] Fallback share also failed",
          fallbackErr
        );
        throw fallbackErr instanceof Error
          ? fallbackErr
          : new Error(String(fallbackErr));
      }
    }
  }

  if (isNativeCapacitor() && !nativeExport) {
    throw new Error(
      "Could not connect to the device export feature. Try again in a few seconds, or restart the app."
    );
  }

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", safeName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
