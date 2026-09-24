import React from "react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { UpdateScopeEnum } from "@/constants/transactionConstants";
import type { UpdateScope } from "./ScopeModal";

type InstallmentUpdateScopeSelectorProps = {
  value: UpdateScope;
  onChange: (scope: UpdateScope) => void;
  disabled?: boolean;
};

const InstallmentUpdateScopeSelector: React.FC<InstallmentUpdateScopeSelectorProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
      <div>
        <p className="text-sm font-medium text-foreground">What do you want to change?</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Choose the scope first — the form below updates to match.
        </p>
      </div>

      <RadioGroup
        value={value}
        onValueChange={(next) => onChange(next as UpdateScope)}
        className="space-y-3"
        disabled={disabled}
      >
        <div className="flex items-start space-x-2">
          <RadioGroupItem
            value={UpdateScopeEnum.THIS_ONLY}
            id="installment-scope-this-only"
            className="mt-0.5"
          />
          <Label htmlFor="installment-scope-this-only" className="cursor-pointer">
            <div className="font-medium">This installment payment only</div>
            <div className="text-sm text-muted-foreground">
              Change this payment&apos;s date or amount. The plan total adjusts by the
              difference.
            </div>
          </Label>
        </div>

        <div className="flex items-start space-x-2">
          <RadioGroupItem
            value={UpdateScopeEnum.THIS_AND_FUTURE}
            id="installment-scope-this-and-future"
            className="mt-0.5"
          />
          <Label htmlFor="installment-scope-this-and-future" className="cursor-pointer">
            <div className="font-medium">This and future payments</div>
            <div className="text-sm text-muted-foreground">
              Revise the plan from this payment onward. Already committed payments stay
              as recorded.
            </div>
          </Label>
        </div>

        <div className="flex items-start space-x-2">
          <RadioGroupItem
            value={UpdateScopeEnum.ALL_IN_SERIES}
            id="installment-scope-all-in-series"
            className="mt-0.5"
            disabled={disabled}
          />
          <Label
            htmlFor="installment-scope-all-in-series"
            className={disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}
          >
            <div className="font-medium">All payments in the plan</div>
            <div className="text-sm text-muted-foreground">
              Revise every payment in the plan, including ones already recorded.
            </div>
          </Label>
        </div>
      </RadioGroup>
    </div>
  );
};

export default InstallmentUpdateScopeSelector;
