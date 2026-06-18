"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import AddAccountForm from "@/components/dashboard/add-account-form";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type AddAccountSheetProps = {
  onAccountCreated?: () => void;
};

const AddAccountSheet: React.FC<AddAccountSheetProps> = ({
  onAccountCreated,
}) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex shrink-0 justify-end">
        <Button
          type="button"
          size="lg"
          className="h-11 px-7 text-base font-semibold shadow-sm"
          onClick={() => setOpen(true)}
        >
          <Plus className="h-5 w-5" />
          Add account
        </Button>
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-lg flex flex-col overflow-hidden p-0 min-h-0 max-h-[100dvh]"
          swipeToClose
          onSwipeToClose={() => setOpen(false)}
        >
          <div className="p-6 pb-4 flex flex-col flex-1 min-h-0 min-w-0">
            <SheetHeader className="text-left shrink-0">
              <SheetTitle className="text-2xl font-bold text-primary">
                Add account
              </SheetTitle>
            </SheetHeader>
            <div className="mt-6 flex-1 min-h-0 min-w-0 overflow-y-auto overscroll-contain px-2 py-2 -mx-2">
              <AddAccountForm
                showHeading={false}
                onSuccessClose={() => {
                  setOpen(false);
                  onAccountCreated?.();
                }}
              />
            </div>
          </div>
          <SheetFooter className="border-t bg-background p-4 sm:p-6 gap-2 mt-auto shrink-0">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default AddAccountSheet;
