import type { AxiosInstance } from "axios";

import { AuthStorage } from "@/lib/auth-storage";
import { getPublicBackendUrl } from "@/lib/public-backend-url";

import {
  listAttachmentsForOwner,
  putLocalAttachment,
} from "./local-store";
import type { RemoteFileAttachment } from "./remote-files";
import type {
  AttachmentOwnerType,
  LocalAttachmentRecord,
} from "./types";

const ATTACHMENTS_DOWNLOAD_PATH = "/attachments/download";
const ATTACHMENT_DOWNLOAD_TIMEOUT_MS = 8_000;

const blobLooksLikeJsonError = (blob: Blob): boolean =>
  blob.type.includes("json") || blob.type.includes("application/problem");

const blobFromProxyResponse = (blob: unknown): Blob | null => {
  if (
    blob instanceof Blob &&
    blob.size > 0 &&
    !blobLooksLikeJsonError(blob)
  ) {
    return blob;
  }

  return null;
};

export async function fetchAttachmentBlob(
  url: string,
  api?: AxiosInstance | null,
): Promise<Blob | null> {
  if (!url) {
    return null;
  }

  if (api) {
    try {
      const response = await api.get<Blob>(ATTACHMENTS_DOWNLOAD_PATH, {
        params: { url },
        responseType: "blob",
        timeout: ATTACHMENT_DOWNLOAD_TIMEOUT_MS,
      });
      return blobFromProxyResponse(response.data);
    } catch {
      return null;
    }
  }

  const backendUrl = getPublicBackendUrl() ?? process.env.NEXT_PUBLIC_BE_URL;
  const token = AuthStorage.getAccessToken();
  if (backendUrl && token) {
    try {
      const proxyUrl =
        `${backendUrl.replace(/\/$/, "")}/api/v1/attachments/download`
        + `?url=${encodeURIComponent(url)}`;
      const response = await fetch(proxyUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const blob = await response.blob();
        if (blob.size > 0 && !blobLooksLikeJsonError(blob)) {
          return blob;
        }
      }
    } catch {
      // Fall through to a direct fetch.
    }
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    const blob = await response.blob();
    if (blob.size > 0 && !blobLooksLikeJsonError(blob)) {
      return blob;
    }
  } catch {
    return null;
  }

  return null;
}

export async function cacheRemoteFilesForOwner(params: {
  spaceId: string;
  ownerType: AttachmentOwnerType;
  ownerId: string;
  files: RemoteFileAttachment[];
  api?: AxiosInstance | null;
}): Promise<LocalAttachmentRecord[]> {
  const existing = await listAttachmentsForOwner({
    spaceId: params.spaceId,
    ownerType: params.ownerType,
    ownerId: params.ownerId,
  });

  if (existing.length > 0) {
    return existing;
  }

  for (const file of params.files) {
    if (!file.url) {
      continue;
    }

    const blob = await fetchAttachmentBlob(file.url, params.api);
    if (!blob) {
      continue;
    }

    const contentType = file.contentType || blob.type || "application/octet-stream";
    const storedBlob =
      contentType !== blob.type
        ? new Blob([blob], { type: contentType })
        : blob;

    try {
      await putLocalAttachment({
        spaceId: params.spaceId,
        ownerType: params.ownerType,
        ownerId: params.ownerId,
        file: storedBlob,
        filename: file.filename,
        source: "remote_download",
        remoteUrl: file.url,
        serverFileId: file.id,
      });
    } catch (error) {
      console.warn(
        "[attachments] Failed to store remote file in IndexedDB",
        params.ownerId,
        file.url,
        error,
      );
    }
  }

  return listAttachmentsForOwner({
    spaceId: params.spaceId,
    ownerType: params.ownerType,
    ownerId: params.ownerId,
  });
}

export async function cacheRemoteFilesForOwners(params: {
  spaceId: string;
  ownerType: AttachmentOwnerType;
  ownerIds: string[];
  files: RemoteFileAttachment[];
  api?: AxiosInstance | null;
}): Promise<LocalAttachmentRecord[]> {
  const uniqueIds = [...new Set(params.ownerIds.filter(Boolean))];
  let stored: LocalAttachmentRecord[] = [];

  for (const ownerId of uniqueIds) {
    if (stored.length === 0) {
      stored = await cacheRemoteFilesForOwner({
        spaceId: params.spaceId,
        ownerType: params.ownerType,
        ownerId,
        files: params.files,
        api: params.api,
      });
      continue;
    }

    const existing = await listAttachmentsForOwner({
      spaceId: params.spaceId,
      ownerType: params.ownerType,
      ownerId,
    });
    if (existing.length > 0) {
      continue;
    }

    for (const record of stored) {
      await putLocalAttachment({
        spaceId: params.spaceId,
        ownerType: params.ownerType,
        ownerId,
        file: record.blob,
        filename: record.filename,
        source: record.source,
        remoteUrl: record.remoteUrl,
        serverFileId: record.serverFileId,
      });
    }
  }

  return stored;
}
