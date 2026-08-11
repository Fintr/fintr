const IMAGE_EXTENSION_PATTERN = /\.(jpe?g|png|gif|webp|heic|heif|bmp)$/i;

const HEIC_TYPE_PATTERN = /^image\/hei[cf]$/i;

export function isReceiptImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) {
    return true;
  }

  return IMAGE_EXTENSION_PATTERN.test(file.name);
}

function isHeicImage(file: File): boolean {
  if (HEIC_TYPE_PATTERN.test(file.type)) {
    return true;
  }

  return /\.hei[cf]$/i.test(file.name);
}

async function convertImageFileToJpeg(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;

  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("Canvas is not available");
  }

  context.drawImage(bitmap, 0, 0);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", 0.92);
  });

  if (!blob) {
    throw new Error("Failed to convert image");
  }

  const baseName = file.name.replace(/\.[^.]+$/, "") || "receipt";

  return new File(
    [blob],
    `${baseName}.jpg`,
    { type: "image/jpeg" },
  );
}

export type ReceiptImagePreview = {
  file: File;
  previewUrl: string;
};

/**
 * Builds a browser-displayable preview URL for receipt images.
 * Converts HEIC/HEIF to JPEG when the runtime supports decoding them.
 */
export async function prepareReceiptImagePreview(
  file: File,
): Promise<ReceiptImagePreview> {
  if (isHeicImage(file) && typeof createImageBitmap === "function") {
    try {
      const jpegFile = await convertImageFileToJpeg(file);

      return {
        file: jpegFile,
        previewUrl: URL.createObjectURL(jpegFile),
      };
    } catch {
      // Fall through to a direct object URL when conversion is unavailable.
    }
  }

  return {
    file,
    previewUrl: URL.createObjectURL(file),
  };
}
