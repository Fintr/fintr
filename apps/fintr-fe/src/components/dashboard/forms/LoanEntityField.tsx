import React, { useCallback, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { MerchantPicker } from "@/components/ui/merchant-picker";
import { Button } from "@/components/ui/button";
import { useAuthApi } from "@/hooks/useAuthApi";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useEntitiesMutations } from "@/hooks/async/useEntitiesMutations";
import { fetchEntitiesLocalFirst } from "@/services/entities/queries";
import { extractFieldErrors, formatApiErrorMessage } from "@/utils/errorUtils";

import EntityCreationForm from "./EntityCreationForm";

type LoanType = "borrowed" | "lent";

type LoanEntityFieldProps = {
  id?: string;
  loanType: LoanType;
  value: string;
  onChange: (value: string) => void;
  hasError?: boolean;
  excludeNames?: string[];
};

const FIELD_COPY: Record<
  LoanType,
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
    namePlaceholder: string;
  }
> = {
  borrowed: {
    label: "Lender",
    placeholder: "Select lender",
    title: "Select Lender",
    searchPlaceholder: "Search lenders…",
    emptyTitle: "No lenders yet",
    emptyDescription:
      "Save banks, friends, or other lenders so you can pick them quickly when recording borrowed money.",
    addLabel: "Add lender",
    createLabel: (name) => `Add "${name}"`,
    notFoundPrefix: "No lender matches",
    creationNoun: "lender",
    namePlaceholder: "e.g. BDO, Friend",
  },
  lent: {
    label: "Borrower",
    placeholder: "Select borrower",
    title: "Select Borrower",
    searchPlaceholder: "Search borrowers…",
    emptyTitle: "No borrowers yet",
    emptyDescription:
      "Save people or businesses you lend to so you can pick them quickly next time.",
    addLabel: "Create borrower",
    createLabel: (name) => `Add "${name}"`,
    notFoundPrefix: "No borrower matches",
    creationNoun: "borrower",
    namePlaceholder: "e.g. Friend, Client",
  },
};

const LoanEntityField: React.FC<LoanEntityFieldProps> = ({
  id,
  loanType,
  value,
  onChange,
  hasError = false,
  excludeNames = [],
}) => {
  const copy = FIELD_COPY[loanType];
  const { api } = useAuthApi();
  const [spaceCode] = useLocalStorage("spaceCode", "");
  const queryClient = useQueryClient();
  const { createEntity } = useEntitiesMutations();
  const [showCreationPanel, setShowCreationPanel] = useState(false);
  const [isCreatingEntity, setIsCreatingEntity] = useState(false);
  const [creationSeed, setCreationSeed] = useState("");

  const excludedNameKey = useMemo(
    () =>
      excludeNames
        .map((name) => name.trim().toLowerCase())
        .filter(Boolean)
        .sort()
        .join("\0"),
    [excludeNames],
  );

  const fetchEntityOptions = useCallback(
    async (query: string) => {
      try {
        const entities = await fetchEntitiesLocalFirst(api, spaceCode, {
          entityType: "loan",
          search: query,
        });

        const excluded = new Set(
          excludedNameKey ? excludedNameKey.split("\0") : [],
        );

        return entities
          .filter((entity) => !excluded.has((entity.fullName || "").trim().toLowerCase()))
          .map((entity) => ({
            id: entity.id,
            fullName: entity.fullName || "",
            photoUrl: entity.photoUrl,
          }));
      } catch (error: unknown) {
        const err = error as { error?: { message?: string }; status?: number };
        if (err?.error?.message !== "Unprocessable Entity" && err?.status !== 422) {
          console.error("Failed to fetch loan entities:", error);
        }
        return [];
      }
    },
    [api, excludedNameKey, spaceCode],
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
      const response = await createEntity({
        fullName: trimmed,
        entityType: "loan",
      });

      const createdEntityName = response?.data?.fullName || trimmed;
      queryClient.invalidateQueries({ queryKey: ["entities"] });
      onChange(createdEntityName);
      toast.success(`${createdEntityName} saved.`);
      onSuccess?.();
    } catch (error: unknown) {
      console.error("Failed to create loan entity:", error);
      const fieldErrors = extractFieldErrors(error);
      const fieldMessage =
        typeof fieldErrors.fullName === "string"
          ? fieldErrors.fullName
          : Array.isArray(fieldErrors.fullName)
            ? fieldErrors.fullName[0]
            : typeof fieldErrors.full_name === "string"
              ? fieldErrors.full_name
              : Array.isArray(fieldErrors.full_name)
                ? fieldErrors.full_name[0]
                : null;
      toast.error(
        String(
          fieldMessage
          || formatApiErrorMessage(error, `Could not save ${copy.creationNoun}`),
        ),
      );
    } finally {
      setIsCreatingEntity(false);
    }
  };

  return (
    <div className="min-w-0 space-y-2" id={id}>
      <div className="space-y-2">
        <MerchantPicker
          value={value}
          onChange={onChange}
          onFetchMerchants={fetchEntityOptions}
          label={copy.label}
          optionalLabel=""
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
          className={
            hasError ? "border-red-800 focus-visible:ring-red-800" : undefined
          }
        />
        {!showCreationPanel ? (
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
        ) : null}
      </div>
      {showCreationPanel ? (
        <EntityCreationForm
          onSuccess={handleEntityCreated}
          onCancel={() => {
            setShowCreationPanel(false);
            setCreationSeed("");
          }}
          entityType="loan"
          initialName={creationSeed}
          nameLabel={`${copy.label} name`}
          namePlaceholder={copy.namePlaceholder}
          photoLabel={`${copy.label} photo`}
        />
      ) : null}
    </div>
  );
};

export default LoanEntityField;
