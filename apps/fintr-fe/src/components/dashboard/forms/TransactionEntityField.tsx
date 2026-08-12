import React, { useCallback, useRef, useState } from "react";
import { Camera, Plus, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { MerchantPicker } from "@/components/ui/merchant-picker";
import { Button } from "@/components/ui/button";
import { useAuthApi } from "@/hooks/useAuthApi";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { createEntity } from "@/services/entities/mutation";
import { fetchEntitiesLocalFirst } from "@/services/entities/queries";
import { extractFieldErrors } from "@/utils/errorUtils";

import EntityCreationForm from "./EntityCreationForm";

type EntityFieldKind = "merchant" | "payer";

type TransactionEntityFieldProps = {
  id: string;
  kind: EntityFieldKind;
  value: string;
  onChange: (value: string) => void;
};

const FIELD_COPY: Record<
  EntityFieldKind,
  {
    label: string;
    placeholder: string;
    title: string;
    searchPlaceholder: string;
    emptyTitle: string;
    emptyDescription: string;
    addLabel: string;
    createLabel: (name: string) => string;
    notFoundPrefix: string;
    creationNoun: string;
  }
> = {
  merchant: {
    label: "Merchant",
    placeholder: "Select merchant",
    title: "Select Merchant",
    searchPlaceholder: "Search merchants…",
    emptyTitle: "No merchants yet",
    emptyDescription: "Save stores and vendors you pay often so you can pick them quickly next time.",
    addLabel: "Add merchant",
    createLabel: (name) => `Add "${name}"`,
    notFoundPrefix: "No merchant matches",
    creationNoun: "merchant",
  },
  payer: {
    label: "Payer",
    placeholder: "Select payer",
    title: "Select Payer",
    searchPlaceholder: "Search payers…",
    emptyTitle: "No payers yet",
    emptyDescription: "Save employers, clients, or other income sources for faster entry.",
    addLabel: "Add payer",
    createLabel: (name) => `Add "${name}"`,
    notFoundPrefix: "No payer matches",
    creationNoun: "payer",
  },
};

const TransactionEntityField: React.FC<TransactionEntityFieldProps> = ({
  id,
  kind,
  value,
  onChange,
}) => {
  const copy = FIELD_COPY[kind];
  const { api } = useAuthApi();
  const [spaceCode] = useLocalStorage("spaceCode", "");
  const queryClient = useQueryClient();
  const [showCreationPanel, setShowCreationPanel] = useState(false);
  const [isCreatingEntity, setIsCreatingEntity] = useState(false);
  const [creationSeed, setCreationSeed] = useState("");

  const fetchEntityOptions = useCallback(
    async (query: string) => {
      try {
        const entities = await fetchEntitiesLocalFirst(api, spaceCode, {
          entityType: "transaction",
          search: query,
        });

        return entities.map((entity) => ({
          id: entity.id,
          fullName: entity.fullName || "",
          photoUrl: entity.photoUrl,
        }));
      } catch (error: unknown) {
        const err = error as { error?: { message?: string }; status?: number };
        if (err?.error?.message !== "Unprocessable Entity" && err?.status !== 422) {
          console.error("Failed to fetch entities:", error);
        }
        return [];
      }
    },
    [api, spaceCode],
  );

  const openCreationPanel = (seed = "") => {
    setCreationSeed(seed);
    setShowCreationPanel(true);
  };

  const handleEntityCreated = (fullName: string) => {
    if (fullName.trim()) {
      onChange(fullName.trim());
    }
    setShowCreationPanel(false);
    setCreationSeed("");
  };

  const handleQuickCreate = async (
    fullName: string,
    onSuccess?: () => void,
  ) => {
    const trimmed = fullName.trim();
    if (!trimmed) return;

    setIsCreatingEntity(true);
    try {
      const response = await createEntity(api, {
        fullName: trimmed,
        entityType: "transaction",
      });

      const createdEntityName = response?.data?.fullName || trimmed;
      queryClient.invalidateQueries({ queryKey: ["entities"] });
      onChange(createdEntityName);
      toast.success(`${createdEntityName} saved.`);
      onSuccess?.();
    } catch (error: any) {
      console.error("Failed to create entity:", error);
      const fieldErrors = extractFieldErrors(error);
      const message =
        typeof fieldErrors.fullName === "string"
          ? fieldErrors.fullName
          : Array.isArray(fieldErrors.fullName)
            ? fieldErrors.fullName[0]
            : typeof fieldErrors.full_name === "string"
              ? fieldErrors.full_name
              : `Could not save ${copy.creationNoun}`;
      toast.error(String(message));
    } finally {
      setIsCreatingEntity(false);
    }
  };

  return (
    <div className="min-w-0 space-y-2" id={id}>
      {!showCreationPanel ? (
        <div className="space-y-2">
          <MerchantPicker
            value={value}
            onChange={onChange}
            onFetchMerchants={fetchEntityOptions}
            label={copy.label}
            placeholder={copy.placeholder}
            title={copy.title}
            searchPlaceholder={copy.searchPlaceholder}
            emptyTitle={copy.emptyTitle}
            emptyDescription={copy.emptyDescription}
            addLabel={copy.addLabel}
            notFoundPrefix={copy.notFoundPrefix}
            createLabel={copy.createLabel}
            onAddMerchant={() => openCreationPanel()}
            onQuickCreate={handleQuickCreate}
            onOpenCreationPanel={openCreationPanel}
            isCreating={isCreatingEntity}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-0 text-xs text-primary hover:bg-transparent hover:text-primary/80"
            onClick={() => openCreationPanel()}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            {copy.addLabel}
          </Button>
        </div>
      ) : (
        <EntityCreationForm
          onSuccess={handleEntityCreated}
          onCancel={() => {
            setShowCreationPanel(false);
            setCreationSeed("");
          }}
          entityType="transaction"
          initialName={creationSeed}
          nameLabel={`${copy.label} name`}
          namePlaceholder={`e.g. ${kind === "merchant" ? "Jollibee, Shopee" : "Acme Corp"}`}
          photoLabel={`${copy.label} photo`}
        />
      )}
    </div>
  );
};

export default TransactionEntityField;
