export type AttachmentOwnerType = "transaction" | "transfer" | "loan";

export type AttachmentSource = "local_create" | "remote_download";

export type LocalAttachmentRecord = {
  /** `${spaceId}:${ownerType}:${ownerId}:${attachmentId}` */
  key: string;
  spaceId: string;
  ownerType: AttachmentOwnerType;
  ownerId: string;
  attachmentId: string;
  filename: string;
  contentType: string;
  byteSize: number;
  blob: Blob;
  remoteUrl?: string;
  serverFileId?: string;
  source: AttachmentSource;
  cachedAt: number;
  lastAccessedAt: number;
};

export type AttachmentOutboxFields = {
  attachmentLocalKeys?: string[];
};
