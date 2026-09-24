import {
  ATTACHMENT_JPEG_QUALITY,
  MAX_ATTACHMENT_IMAGE_EDGE,
} from "./constants";

const IMAGE_TYPE_PATTERN = /^image\//i;
const SKIP_COMPRESS_TYPE_PATTERN = /^image\/(gif|svg\+xml)$/i;
const IMAGE_EXTENSION_PATTERN = /\.(jpe?g|png|webp|heic|heif|bmp)$/i;

const looksLikeCompressibleImage = (
  file: File | Blob,
  filename?: string,
): boolean => {
  if (SKIP_COMPRESS_TYPE_PATTERN.test(file.type)) {
    return false;
  }

  if (IMAGE_TYPE_PATTERN.test(file.type)) {
    return true;
  }

  const name = filename ?? (file instanceof File ? file.name : "");
  return IMAGE_EXTENSION_PATTERN.test(name);
};

const jpegFilename = (filename?: string, file?: File | Blob): string => {
  const source =
    filename
    ?? (file instanceof File ? file.name : "attachment");
  const baseName = source.replace(/\.[^.]+$/, "") || "attachment";
  return `${baseName}.jpg`;
};

export const maybeCompressAttachmentBlob = async (
  file: File | Blob,
  filename?: string,
): Promise<File | Blob> => {
  if (!looksLikeCompressibleImage(file, filename)) {
    return file;
  }

  if (typeof createImageBitmap !== "function") {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const longestEdge = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, MAX_ATTACHMENT_IMAGE_EDGE / longestEdge);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return file;
    }

    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", ATTACHMENT_JPEG_QUALITY);
    });

    if (!blob || blob.size === 0) {
      return file;
    }

    if (blob.size >= file.size && scale === 1) {
      return file;
    }

    return new File(
      [blob],
      jpegFilename(filename, file),
      { type: "image/jpeg" },
    );
  } catch {
    return file;
  }
};
