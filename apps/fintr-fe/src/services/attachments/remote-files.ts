export type RemoteFileAttachment = {
  id?: string;
  url?: string;
  filename?: string;
  contentType?: string;
  byteSize?: number;
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  return value as Record<string, unknown>;
};

const stringValue = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

export const extractRemoteFiles = (detail: unknown): RemoteFileAttachment[] => {
  const record = asRecord(detail);
  if (!record) {
    return [];
  }

  const files = record.files;
  if (!Array.isArray(files)) {
    return [];
  }

  return files
    .map((file) => {
      const raw = asRecord(file);
      if (!raw) {
        return null;
      }

      const url = stringValue(raw.url);
      if (!url) {
        return null;
      }

      const filename = stringValue(raw.filename) || stringValue(raw.name);
      const contentType =
        stringValue(raw.contentType) || stringValue(raw.content_type);

      return {
        id: raw.id != null ? String(raw.id) : undefined,
        url,
        filename: filename || undefined,
        contentType: contentType || undefined,
        byteSize:
          typeof raw.byteSize === "number"
            ? raw.byteSize
            : typeof raw.byte_size === "number"
              ? raw.byte_size
              : undefined,
      } satisfies RemoteFileAttachment;
    })
    .filter((file): file is RemoteFileAttachment => file != null);
};
