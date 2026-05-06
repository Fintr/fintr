import { registerPlugin } from "@capacitor/core";

export interface FileSharePlugin {
  shareStream(options: {
    uri: string;
    mimeType?: string;
    dialogTitle?: string;
  }): Promise<void>;
}

/**
 * Native plugin: Android registers from MainActivity; iOS registers from
 * CapacitorViewController. Shares cache file URIs via the system share sheet;
 * @capacitor/share is unreliable for these flows (content:// on Android,
 * cancel/reject behavior on iOS).
 */
export const FileShare = registerPlugin<FileSharePlugin>("FileShare", {
  web: () => ({
    async shareStream() {
      /* no-op */
    },
  }),
});
