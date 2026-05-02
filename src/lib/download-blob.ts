/**
 * Saves a Blob as a downloaded file. On native Capacitor (iOS/Android), WebView
 * `<a download>` is unreliable; we write to cache and open the system share sheet
 * so the user can save to Files / Drive / etc.
 */

import { initCapacitorBridgeIfNeeded } from "@/lib/capacitor-bridge-init";
import { isNativeCapacitorAsync } from "@/lib/capacitor";

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

/**
 * @param blob - File contents
 * @param filename - Suggested filename (e.g. transactions.csv)
 */
export async function downloadBlobAsFile(
  blob: Blob,
  filename: string
): Promise<void> {
  const safeName = sanitizeFilename(filename);
  const native = await isNativeCapacitorAsync();

  if (native) {
    try {
      initCapacitorBridgeIfNeeded();
      const { Directory, Encoding, Filesystem } = await import("@capacitor/filesystem");
      const { Share } = await import("@capacitor/share");
      const path = `fintr-downloads/${Date.now()}_${safeName}`;
      const isUtf8Text = /\.(csv|txt|json|md|xml)$/i.test(safeName);

      if (isUtf8Text) {
        await Filesystem.writeFile({
          path,
          data: await blob.text(),
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
          recursive: true,
        });
      } else {
        await Filesystem.writeFile({
          path,
          data: await blobToBase64(blob),
          directory: Directory.Cache,
          recursive: true,
        });
      }

      const { uri } = await Filesystem.getUri({
        directory: Directory.Cache,
        path,
      });

      await Share.share({
        title: safeName,
        url: uri,
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
