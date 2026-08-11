import React, { useEffect, useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { Label } from "../../ui/label";
import { Input } from "../../ui/input";
import { Button } from "../../ui/button";
import { FormError } from "@/components/ui/form-error";
import { ImageCropDialog } from "@/components/ui/image-crop-dialog";
import { MerchantAvatar } from "@/components/ui/merchant-avatar";
import { useAuthApi } from "@/hooks/useAuthApi";
import { createEntity } from "@/services/entities/mutation";
import { toast } from "sonner";
import { extractFieldErrors } from "@/utils/errorUtils";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { useQueryClient } from "@tanstack/react-query";

interface EntityCreationFormProps {
  onSuccess: (fullName: string) => void;
  onCancel?: () => void;
  entityType?: "loan" | "transaction";
  initialName?: string;
  nameLabel?: string;
  namePlaceholder?: string;
  photoLabel?: string;
}

const EntityCreationForm: React.FC<EntityCreationFormProps> = ({
  onSuccess,
  onCancel,
  entityType = "loan",
  initialName = "",
  nameLabel = "Full name",
  namePlaceholder = "Enter name",
  photoLabel = "Photo",
}) => {
  const { api } = useAuthApi();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [entityName, setEntityName] = useState(initialName);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [localErrors, setLocalErrors] = useState<{ fullName?: string }>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string | string[]>>({});

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(photoFile);
    setPhotoPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [photoFile]);

  const handleCancel = () => {
    setEntityName("");
    setPhotoFile(null);
    setLocalErrors({});
    setValidationErrors({});
    if (onCancel) {
      onCancel();
      return;
    }
    onSuccess("");
  };

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

  const handleAddEntity = async () => {
    if (!entityName.trim()) {
      setLocalErrors({ fullName: `${nameLabel} is required` });
      return;
    }
    setLocalErrors({});
    setIsLoading(true);
    setValidationErrors({});

    try {
      const response = await createEntity(api, {
        fullName: entityName.trim(),
        entityType,
        photo: photoFile,
      });

      toast.success(`"${entityName.trim()}" has been added.`);

      queryClient.invalidateQueries({ queryKey: ["entities"] });

      const finalEntityName = response?.data?.fullName || entityName.trim();
      setEntityName("");
      setPhotoFile(null);

      setTimeout(() => {
        onSuccess(finalEntityName);
      }, 100);
    } catch (error: any) {
      console.error("Failed to create entity:", error);

      let fieldErrors: Record<string, string | string[]> = {};

      if (error?.error?.details?.errors) {
        const errorDetails = error.error.details.errors;
        Object.keys(errorDetails).forEach((key) => {
          fieldErrors[key] = errorDetails[key];
        });
      } else {
        fieldErrors = extractFieldErrors(error);
      }

      setValidationErrors(fieldErrors);

      if (Object.keys(fieldErrors).length === 0) {
        toast.error("Failed to create entity.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="rounded-lg border border-border bg-muted/30 p-3">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-entity-name" className="text-sm text-foreground">
              {nameLabel}
            </Label>
            <Input
              id="new-entity-name"
              placeholder={namePlaceholder}
              value={entityName}
              onChange={(e) => {
                setEntityName(e.target.value);
                if (localErrors.fullName) setLocalErrors({});
                if (validationErrors.full_name || validationErrors.fullName) {
                  setValidationErrors({});
                }
              }}
              className={
                localErrors.fullName || validationErrors.full_name || validationErrors.fullName
                  ? "border-destructive focus-visible:ring-destructive/30"
                  : undefined
              }
              disabled={isLoading}
              autoFocus
            />
            {localErrors.fullName && (
              <FormError>{localErrors.fullName}</FormError>
            )}
            {(validationErrors.full_name || validationErrors.fullName) && (
              <FormError>
                {Array.isArray(validationErrors.full_name)
                  ? validationErrors.full_name[0]
                  : Array.isArray(validationErrors.fullName)
                    ? validationErrors.fullName[0]
                    : String(validationErrors.full_name || validationErrors.fullName)}
              </FormError>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-sm text-foreground">{photoLabel} (Optional)</Label>
            <div className="flex items-center gap-3">
              <MerchantAvatar
                name={entityName}
                photoUrl={photoPreviewUrl}
                size={56}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isLoading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera className="mr-2 h-4 w-4" aria-hidden />
                  {photoFile ? "Change photo" : "Add photo"}
                </Button>
                {photoFile ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isLoading}
                    onClick={() => setPhotoFile(null)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" aria-hidden />
                    Remove
                  </Button>
                ) : null}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handlePhotoSelected}
              />
            </div>
          </div>
        </div>

        <div className="mt-3 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={isLoading}
            onClick={handleAddEntity}
          >
            {isLoading ? <LoadingSpinner size="small" className="mr-2" /> : "Save"}
          </Button>
        </div>
      </div>

      <ImageCropDialog
        open={cropDialogOpen}
        imageSrc={cropImageSrc}
        onOpenChange={setCropDialogOpen}
        onCropped={setPhotoFile}
        title={`Crop ${photoLabel.toLowerCase()}`}
      />
    </>
  );
};

export default EntityCreationForm;
