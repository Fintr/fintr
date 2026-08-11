"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { HandCoins, Plus, Search, Store, ChevronRight } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { MerchantAvatar } from "@/components/ui/merchant-avatar";
import { CustomModal } from "@/components/ui/custom-modal";
import EntityCreationForm from "@/components/dashboard/forms/EntityCreationForm";
import { useEntities } from "@/hooks/async/useEntities";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { cn } from "@/lib/utils";
import { buildEntityDetailHref } from "@/utils/entityManagement";

type EntityTab = "merchants" | "loan";

const TAB_COPY: Record<
  EntityTab,
  {
    title: string;
    description: string;
    emptyTitle: string;
    emptyDescription: string;
    addLabel: string;
    searchPlaceholder: string;
    entityType: "transaction" | "loan";
    nameLabel: string;
    namePlaceholder: string;
    photoLabel: string;
    icon: React.ElementType;
  }
> = {
  merchants: {
    title: "Merchants",
    description: "Stores, vendors, and payers used on income and expense transactions.",
    emptyTitle: "No merchants yet",
    emptyDescription: "Add merchants when recording expenses or payers for income.",
    addLabel: "Add merchant",
    searchPlaceholder: "Search merchants…",
    entityType: "transaction",
    nameLabel: "Merchant name",
    namePlaceholder: "e.g. Jollibee, Shopee",
    photoLabel: "Merchant photo",
    icon: Store,
  },
  loan: {
    title: "Loan contacts",
    description: "Lenders and borrowers linked to your loans.",
    emptyTitle: "No loan contacts yet",
    emptyDescription: "Add lenders or borrowers when you create a loan.",
    addLabel: "Add contact",
    searchPlaceholder: "Search loan contacts…",
    entityType: "loan",
    nameLabel: "Contact name",
    namePlaceholder: "e.g. BPI, Juan Dela Cruz",
    photoLabel: "Contact photo",
    icon: HandCoins,
  },
};

export function EntitiesPageContent() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<EntityTab>("merchants");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const debouncedSearch = useDebouncedValue(searchQuery, 300);

  const copy = TAB_COPY[activeTab];
  const { entities, isLoading, isError, refetch } = useEntities(
    copy.entityType,
    debouncedSearch,
  );

  const sortedEntities = useMemo(
    () =>
      [...entities].sort((left, right) =>
        left.fullName.localeCompare(right.fullName),
      ),
    [entities],
  );

  const handleEntityCreated = () => {
    setIsCreateOpen(false);
    queryClient.invalidateQueries({ queryKey: ["entities"] });
    refetch();
  };

  const TabIcon = copy.icon;

  return (
    <>
      <Card className="border-0 bg-transparent px-0 shadow-none">
        <CardHeader className="px-0 pb-4">
          <CardTitle className="text-2xl text-primary">Entities</CardTitle>
          <CardDescription>
            Manage merchants and loan contacts for faster transaction and loan entry.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 px-0">
          <Tabs
            value={activeTab}
            onValueChange={(value) => {
              setActiveTab(value as EntityTab);
              setSearchQuery("");
            }}
          >
            <TabsList className="grid w-full grid-cols-2 bg-white dark:bg-card dark:shadow-sm">
              <TabsTrigger value="merchants" className="gap-2">
                <Store className="h-4 w-4" aria-hidden />
                Merchants
              </TabsTrigger>
              <TabsTrigger value="loan" className="gap-2">
                <HandCoins className="h-4 w-4" aria-hidden />
                Loan contacts
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-primary">{copy.title}</h2>
                <p className="text-sm text-muted-foreground">{copy.description}</p>
              </div>
              <Button
                type="button"
                className="shrink-0"
                onClick={() => setIsCreateOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" aria-hidden />
                {copy.addLabel}
              </Button>
            </div>

            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={copy.searchPlaceholder}
                className="pl-10"
              />
            </div>

            {isLoading ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner size="medium" />
              </div>
            ) : isError ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-center text-sm text-destructive">
                Could not load entities. Please try again.
              </div>
            ) : sortedEntities.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center">
                <div
                  className={cn(
                    "mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full",
                    "bg-primary/10 text-primary",
                  )}
                  aria-hidden
                >
                  <TabIcon className="h-5 w-5" />
                </div>
                <p className="text-sm font-medium text-foreground">{copy.emptyTitle}</p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                  {copy.emptyDescription}
                </p>
                <Button
                  type="button"
                  size="sm"
                  className="mt-4"
                  onClick={() => setIsCreateOpen(true)}
                >
                  <Plus className="mr-2 h-4 w-4" aria-hidden />
                  {copy.addLabel}
                </Button>
              </div>
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                {sortedEntities.map((entity) => (
                  <li key={entity.id}>
                    <Link
                      href={buildEntityDetailHref(entity.id)}
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                    >
                      <MerchantAvatar
                        name={entity.fullName}
                        photoUrl={entity.photoUrl}
                        size={44}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {entity.fullName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {activeTab === "merchants" ? "Merchant" : "Loan contact"}
                        </p>
                      </div>
                      <ChevronRight
                        className="h-4 w-4 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      <CustomModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title={copy.addLabel}
        maxWidth="md"
        className="p-0"
      >
        <div className="px-6 pb-6">
          <EntityCreationForm
            entityType={copy.entityType}
            nameLabel={copy.nameLabel}
            namePlaceholder={copy.namePlaceholder}
            photoLabel={copy.photoLabel}
            onSuccess={handleEntityCreated}
            onCancel={() => setIsCreateOpen(false)}
          />
        </div>
      </CustomModal>
    </>
  );
}
