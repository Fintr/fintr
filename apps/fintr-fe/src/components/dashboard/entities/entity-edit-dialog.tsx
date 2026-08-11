"use client";

import React, { useEffect, useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/ui/form-error";
import { ImageCropDialog } from "@/components/ui/image-crop-dialog";
import { MerchantAvatar } from "@/components/ui/merchant-avatar";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { useAuthApi } from "@/hooks/useAuthApi";
import { ENTITY_DETAIL_KEY } from "@/hooks/async/useEntityDetail";
import { EntityRecord, updateEntity } from "@/services/entities/mutation";
import { extractFieldErrors, formatApiErrorMessage } from "@/utils/errorUtils";

type EntityEditDialogProps = {
  entity: EntityRecord;
  entityLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

export function EntityEditDialog({
  entity,
  entityLabel,
  open,
  onOpenChange,
  onSuccess,
}: EntityEditDialogProps) {
  const { api } = useAuthApi();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState(entity.fullName);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(
    entity.photoUrl ?? null,
  );
  const [removePhoto, setRemovePhoto] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string | string[]>
  >({});

  useEffect(() => {
    if (!open) return;

    setFullName(entity.fullName);
    setPhotoFile(null);
    setPhotoPreviewUrl(entity.photoUrl ?? null);
    setRemovePhoto(false);
    setValidationErrors({});
  }, [entity.fullName, entity.photoUrl, open]);

  useEffect(() => {
    if (!photoFile) return;

    const url = URL.createObjectURL(photoFile);
    setPhotoPreviewUrl(url);
    setRemovePhoto(false);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [photoFile]);

  const handlePhotoSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      setCropImageSrc(String(reader.result));
      setCropDialogOpen(true);
    });
    reader.readAsDataURL(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    setPhotoPreviewUrl(null);
    setRemovePhoto(true);
  };

  const refreshEntityQueries = () => {
    queryClient.invalidateQueries({ queryKey: [ENTITY_DETAIL_KEY, entity.id] });
    queryClient.invalidateQueries({ queryKey: ["entities"] });
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const handleSave = async () => {
    const trimmedName = fullName.trim();
    if (!trimmedName) {
      toast.error("Name is required");
      return;
    }

    setIsSaving(true);
    setValidationErrors({});

    try {
      await updateEntity(api, {
        id: entity.id,
        fullName: trimmedName,
        photo: photoFile,
        removePhoto,
      });

      refreshEntityQueries();
      toast.success(`${entityLabel} updated`);
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      const fieldErrors = extractFieldErrors(error);
      setValidationErrors(fieldErrors);

      if (Object.keys(fieldErrors).length === 0) {
        toast.error(formatApiErrorMessage(error, `Could not update ${entityLabel.toLowerCase()}.`));
      }
    } finally {
      setIsSaving(false);
    }
  };

  const nameError =
    validationErrors.fullName ??
    validationErrors.full_name;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-primary">
              Edit {entityLabel.toLowerCase()}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="entity-edit-name">Name</Label>
              <Input
                id="entity-edit-name"
                value={fullName}
                onChange={(event) => {
                  setFullName(event.target.value);
                  setValidationErrors({});
                }}
                disabled={isSaving}
                className={
                  nameError
                    ? "border-destructive focus-visible:ring-destructive/30"
                    : undefined
                }
              />
              {nameError ? (
                <FormError>
                  {Array.isArray(nameError) ? nameError[0] : String(nameError)}
                </FormError>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label>Photo</Label>
              <div className="flex items-center gap-3">
                <MerchantAvatar
                  name={fullName}
                  photoUrl={photoPreviewUrl}
                  size={64}
                />
                <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isSaving}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Camera className="mr-2 h-4 w-4" aria-hidden />
                    Upload photo
                  </Button>
                  {photoPreviewUrl ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={isSaving}
                      onClick={handleRemovePhoto}
                    >
                      <Trash2 className="mr-2 h-4 w-4" aria-hidden />
                      Remove
                    </Button>
                  ) : null}
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handlePhotoSelected}
              />
            </div>

            <Button
              type="button"
              className="w-full"
              disabled={isSaving}
              onClick={() => void handleSave()}
            >
              {isSaving ? <LoadingSpinner size="small" className="mr-2" /> : null}
              Save changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ImageCropDialog
        open={cropDialogOpen}
        imageSrc={cropImageSrc}
        onOpenChange={setCropDialogOpen}
        onCropped={setPhotoFile}
        title={`Crop ${entityLabel.toLowerCase()} photo`}
      />
    </>
  );
}
