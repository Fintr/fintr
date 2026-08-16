"use client";

import React, { useState } from "react";
import { Fingerprint, Plus, ScanLine, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthApi } from "@/hooks/useAuthApi";
import { useQueryClient } from "@tanstack/react-query";
import { ENTITY_DETAIL_KEY } from "@/hooks/async/useEntityDetail";
import {
  createMerchantIdentifier,
  deleteMerchantIdentifier,
  type EntityIdentifier,
} from "@/services/entities/mutation";
import { formatApiErrorMessage } from "@/utils/errorUtils";

type EntityIdentifiersEditorProps = {
  entityId: string;
  entityName: string;
  identifiers: EntityIdentifier[];
};

const normalizeIdentifierText = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, " ");

export function EntityIdentifiersEditor({
  entityId,
  entityName,
  identifiers,
}: EntityIdentifiersEditorProps) {
  const { api } = useAuthApi();
  const queryClient = useQueryClient();
  const [identifierInput, setIdentifierInput] = useState("");
  const [isAddingIdentifier, setIsAddingIdentifier] = useState(false);
  const [deletingIdentifierId, setDeletingIdentifierId] = useState<string | null>(
    null,
  );

  const refreshIdentifiers = () => {
    queryClient.invalidateQueries({ queryKey: [ENTITY_DETAIL_KEY] });
  };

  const handleAddIdentifier = async () => {
    const label = identifierInput.trim();
    if (!label) {
      toast.error("Enter identifier text first");
      return;
    }

    if (normalizeIdentifierText(label) === normalizeIdentifierText(entityName)) {
      toast.error("Identifier cannot be the same as the merchant name");
      return;
    }

    setIsAddingIdentifier(true);

    try {
      await createMerchantIdentifier(api, entityId, label);
      setIdentifierInput("");
      refreshIdentifiers();
      toast.success("Identifier added");
    } catch (error) {
      toast.error(
        formatApiErrorMessage(error, "Could not add identifier. Try again."),
      );
    } finally {
      setIsAddingIdentifier(false);
    }
  };

  const handleDeleteIdentifier = async (identifierId: string) => {
    setDeletingIdentifierId(identifierId);

    try {
      await deleteMerchantIdentifier(api, entityId, identifierId);
      refreshIdentifiers();
      toast.success("Identifier removed");
    } catch (error) {
      toast.error(
        formatApiErrorMessage(error, "Could not remove identifier. Try again."),
      );
    } finally {
      setDeletingIdentifierId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2 rounded-xl border border-border bg-muted/20 px-3 py-3 text-sm text-muted-foreground">
        <div className="flex items-start gap-2">
          <ScanLine className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          <p>
            Identifiers are receipt text that Fintr links to{" "}
            <span className="font-medium text-foreground">{entityName}</span>.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={identifierInput}
          onChange={(event) => setIdentifierInput(event.target.value)}
          placeholder='e.g. "CORPORATION A"'
          disabled={isAddingIdentifier}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void handleAddIdentifier();
            }
          }}
          aria-label="Identifier text"
        />
        <Button
          type="button"
          onClick={() => void handleAddIdentifier()}
          disabled={isAddingIdentifier || identifierInput.trim().length === 0}
          className="shrink-0"
        >
          <Plus className="mr-2 h-4 w-4" aria-hidden />
          Add
        </Button>
      </div>

      {identifiers.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No identifiers yet. Add receipt text above, or save a receipt expense
          and pick this merchant.
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {identifiers.map((identifier) => (
            <li key={identifier.id}>
              <div className="flex items-center gap-3 px-3 py-2.5">
                <Fingerprint className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                  {identifier.label}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => void handleDeleteIdentifier(identifier.id)}
                  disabled={deletingIdentifierId === identifier.id}
                  aria-label={`Remove identifier ${identifier.label}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
