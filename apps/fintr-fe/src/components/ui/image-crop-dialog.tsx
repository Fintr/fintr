"use client";

import React, { useCallback, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";

import { Button } from "@/components/ui/button";
import { CustomModal } from "@/components/ui/custom-modal";
import { getCroppedImageFile } from "@/lib/crop-image";
import { cn } from "@/lib/utils";

type ImageCropDialogProps = {
  open: boolean;
  imageSrc: string | null;
  onOpenChange: (open: boolean) => void;
  onCropped: (file: File) => void;
  title?: string;
};

export function ImageCropDialog({
  open,
  imageSrc,
  onOpenChange,
  onCropped,
  title = "Crop photo",
}: ImageCropDialogProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleClose = useCallback(() => {
    onOpenChange(false);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  }, [onOpenChange]);

  const handleSave = useCallback(async () => {
    if (!imageSrc || !croppedAreaPixels) return;

    setIsSaving(true);
    try {
      const file = await getCroppedImageFile(imageSrc, croppedAreaPixels);
      onCropped(file);
      handleClose();
    } catch (error) {
      console.error("Failed to crop image:", error);
    } finally {
      setIsSaving(false);
    }
  }, [croppedAreaPixels, handleClose, imageSrc, onCropped]);

  return (
    <CustomModal
      isOpen={open}
      onClose={handleClose}
      title={title}
      maxWidth="md"
      bodyTouchAction="none"
    >
      <div className="space-y-4 px-6 pb-6">
        <div
          className={cn(
            "relative h-80 w-full overflow-hidden rounded-xl bg-muted",
            "touch-none select-none",
          )}
          style={{ touchAction: "none" }}
        >
          {imageSrc ? (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              objectFit="cover"
              zoomWithScroll
              minZoom={1}
              maxZoom={4}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_area, pixels) => setCroppedAreaPixels(pixels)}
              classes={{
                cropAreaClassName: "pointer-events-none",
              }}
            />
          ) : null}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Drag the photo to reposition. Pinch or use the slider to zoom.
        </p>

        <div className="space-y-2">
          <label
            htmlFor="merchant-photo-zoom"
            className="text-xs font-medium text-muted-foreground"
          >
            Zoom
          </label>
          <input
            id="merchant-photo-zoom"
            type="range"
            min={1}
            max={4}
            step={0.05}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            className="w-full accent-primary"
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !croppedAreaPixels}
          >
            {isSaving ? "Saving…" : "Use photo"}
          </Button>
        </div>
      </div>
    </CustomModal>
  );
}
