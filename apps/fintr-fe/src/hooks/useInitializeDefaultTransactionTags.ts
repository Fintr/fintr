import { useEffect, useRef } from "react";

import type { TransactionTag } from "@/types/transactionTagTypes";

type UseInitializeDefaultTransactionTagsArgs = {
  tags: TransactionTag[];
  isEditMode: boolean;
  hasInitialTags: boolean;
  setSelectedTagIds: (tagIds: string[]) => void;
};

/** Pre-selects the space default tag on new expense/income forms. */
export function useInitializeDefaultTransactionTags({
  tags,
  isEditMode,
  hasInitialTags,
  setSelectedTagIds,
}: UseInitializeDefaultTransactionTagsArgs) {
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current || isEditMode || hasInitialTags) {
      return;
    }

    if (tags.length === 0) {
      return;
    }

    const defaultTag = tags.find((tag) => tag.isDefault);
    if (defaultTag) {
      setSelectedTagIds([defaultTag.id]);
    }

    initializedRef.current = true;
  }, [tags, isEditMode, hasInitialTags, setSelectedTagIds]);
}
