"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { MerchantAvatar } from "@/components/ui/merchant-avatar";
import { useEntities } from "@/hooks/async/useEntities";
import { Loan } from "@/services/loans/queries";
import { cn, formatCurrency } from "@/lib/utils";
import {
  buildLoanEntityProfiles,
  LoanEntityProfile,
} from "@/utils/loan-entity-profiles";
import { buildEntityDetailHref } from "@/utils/entityManagement";

type LoanProfilesSectionProps = {
  loans: Loan[];
};

const directionLabel = (profile: LoanEntityProfile): string => {
  if (profile.primaryBalance.direction === "you_owe") {
    return "You owe";
  }

  if (profile.primaryBalance.direction === "they_owe") {
    return "Owes you";
  }

  return "Settled";
};

const amountClassName = (profile: LoanEntityProfile): string => {
  if (profile.primaryBalance.direction === "you_owe") {
    return "text-red-900 dark:text-red-700";
  }

  if (profile.primaryBalance.direction === "they_owe") {
    return "text-teal-600 dark:text-teal-500";
  }

  return "text-muted-foreground";
};

export const LoanProfilesSection = ({ loans }: LoanProfilesSectionProps) => {
  const router = useRouter();
  const { entities } = useEntities("loan");

  const profiles = React.useMemo(
    () => buildLoanEntityProfiles(loans),
    [loans],
  );

  const photoByName = React.useMemo(() => {
    const map = new Map<string, { id: string; photoUrl?: string | null }>();

    for (const entity of entities) {
      map.set(entity.fullName.trim().toLowerCase(), {
        id: entity.id,
        photoUrl: entity.photoUrl,
      });
    }

    return map;
  }, [entities]);

  if (profiles.length === 0) {
    return null;
  }

  const handleOpenProfile = (profile: LoanEntityProfile) => {
    const matched = photoByName.get(profile.entityKey);
    if (!matched?.id) {
      return;
    }

    router.push(buildEntityDetailHref(matched.id));
  };

  return (
    <section className="mb-6">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-primary">Profiles</h3>
        <p className="text-xs text-gray-500 dark:text-muted-foreground">
          Net balance with each borrower or lender
        </p>
      </div>
      <div
        className={cn(
          "insight-rail-peek -mx-2 flex gap-3 overflow-x-auto px-2 pb-2",
          "snap-x snap-proximity",
        )}
        role="list"
        aria-label="Loan contact profiles"
      >
        {profiles.map((profile) => {
          const matched = photoByName.get(profile.entityKey);
          const isClickable = Boolean(matched?.id);
          const absoluteNet = Math.abs(profile.primaryBalance.netAmount);

          return (
            <button
              key={profile.entityKey}
              type="button"
              role="listitem"
              disabled={!isClickable}
              onClick={() => handleOpenProfile(profile)}
              className={cn(
                "flex w-[9.5rem] shrink-0 snap-start flex-col items-center gap-2 rounded-lg",
                "bg-white px-3 py-3 text-center dark:bg-card",
                isClickable
                  ? "cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-accent/50"
                  : "cursor-default",
              )}
              aria-label={`${profile.entityName}: ${directionLabel(profile)} ${formatCurrency(
                absoluteNet,
                profile.primaryBalance.currency,
              )}`}
            >
              <MerchantAvatar
                name={profile.entityName}
                photoUrl={matched?.photoUrl}
                size={44}
              />
              <div className="min-w-0 w-full">
                <p className="truncate text-xs font-medium text-primary">
                  {profile.entityName}
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {directionLabel(profile)}
                </p>
                <p
                  className={cn(
                    "mt-0.5 truncate text-sm font-semibold tabular-nums",
                    amountClassName(profile),
                  )}
                >
                  {formatCurrency(
                    absoluteNet,
                    profile.primaryBalance.currency,
                  )}
                </p>
                {profile.balances.length > 1 ? (
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    +{profile.balances.length - 1} more
                  </p>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};
