import type { ChangeEvent } from "react";

import { Label } from "@/components/ui/label";
import NotesAutocomplete from "@/components/ui/notes-autocomplete";

type TransactionDescriptionFieldProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  categoryName: string;
  transactionType: "expense" | "income";
};

const TransactionDescriptionField = ({
  id,
  value,
  onChange,
  categoryName,
  transactionType,
}: TransactionDescriptionFieldProps) => {
  return (
    <div className="min-w-0 space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={id} className="text-sm font-medium text-primary">
          Description
        </Label>
        <span className="text-xs text-muted-foreground">Optional</span>
      </div>
      <NotesAutocomplete
        id={id}
        value={value}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
          onChange(event.target.value)
        }
        categoryName={categoryName}
        transactionType={transactionType}
        placeholder="Shown on the transaction list"
        className="text-sm"
      />
    </div>
  );
};

export default TransactionDescriptionField;
