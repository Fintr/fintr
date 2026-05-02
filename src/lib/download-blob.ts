/**
 * Saves a Blob as a downloaded file. On native Capacitor (iOS/Android), WebView
 * `<a download>` is unreliable; we write to cache and open the system share sheet
 * so the user can save to Files / Drive / etc.
 *
 * Android: @capacitor/share rejects content:// URLs from Filesystem.getUri(); we use
 * the Fintr FileShare native plugin for ACTION_SEND.
 * iOS: @capacitor/share rejects when the user dismisses the sheet and can mishandle file
 * URIs; FileShare uses UIActivityViewController and always resolves on dismiss.
 */

import { Capacitor } from "@capacitor/core";
import { initCapacitorBridgeIfNeeded } from "@/lib/capacitor-bridge-init";
import { waitForCapacitor } from "@/lib/capacitor";
import { FileShare } from "@/plugins/file-share";

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

async function shouldUseCapacitorFileShare(): Promise<boolean> {
  if (typeof window === "undefined") {
    return false;
  }
  await waitForCapacitor();
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
  const nativeShare = await shouldUseCapacitorFileShare();

  if (nativeShare) {
    try {
      initCapacitorBridgeIfNeeded();
      const { Directory, Encoding, Filesystem } = await import("@capacitor/filesystem");
      const path = `fintr-downloads/${Date.now()}_${safeName}`;
      const isUtf8Text = /\.(csv|txt|json|md|xml)$/i.test(safeName);

      const writePayload = isUtf8Text
        ? {
            path,
            data: await blob.text(),
            directory: Directory.Cache,
            encoding: Encoding.UTF8,
            recursive: true,
          }
        : {
            path,
            data: await blobToBase64(blob),
            directory: Directory.Cache,
            recursive: true,
          };

      const writeResult = await Filesystem.writeFile(writePayload);
      let uri = writeResult.uri;

      if (!uri || String(uri).trim() === "") {
        const uriResult = await Filesystem.getUri({
          directory: Directory.Cache,
          path,
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
    } catch (err) {
      console.error(
        "[downloadBlobAsFile] Native share failed; falling back to anchor download",
        err
      );
    }
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
