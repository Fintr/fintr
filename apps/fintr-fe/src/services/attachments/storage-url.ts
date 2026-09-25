const LEGACY_DEVELOPMENT_BUCKET_PREFIX =
  "https://storage.googleapis.com/fintr-dev/";

const DEVELOPMENT_BUCKET_PREFIX =
  "https://storage.googleapis.com/fintr-development/";

export const normalizeAttachmentStorageUrl = (url: string): string => {
  if (!url.startsWith(LEGACY_DEVELOPMENT_BUCKET_PREFIX)) {
    return url;
  }

  return `${DEVELOPMENT_BUCKET_PREFIX}${url.slice(LEGACY_DEVELOPMENT_BUCKET_PREFIX.length)}`;
};
