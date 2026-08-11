"use client";

import { Cpu, Cloud } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { AiLlmPriority } from "@/lib/on-device-llm";

type AiLlmPriorityPickerProps = {
  priority: AiLlmPriority;
  localAvailable: boolean;
  onChange: (priority: AiLlmPriority) => void;
};

export const AiLlmPriorityPicker = ({
  priority,
  localAvailable,
  onChange,
}: AiLlmPriorityPickerProps) => {
  return (
    <div className="flex flex-col items-center gap-1 px-4 py-2 border-b bg-muted/10">
      <p className="text-xs text-muted-foreground">AI engine</p>
      <div
        className="inline-flex rounded-lg border border-border p-0.5 bg-background"
        role="group"
        aria-label="Choose AI engine"
      >
        <Button
          type="button"
          size="sm"
          variant={priority === "local" ? "default" : "ghost"}
          className="h-8 rounded-md px-3 text-xs"
          disabled={!localAvailable}
          onClick={() => onChange("local")}
          aria-pressed={priority === "local"}
        >
          <Cpu className="h-3.5 w-3.5 mr-1.5" />
          On-device
        </Button>
        <Button
          type="button"
          size="sm"
          variant={priority === "cloud" ? "default" : "ghost"}
          className="h-8 rounded-md px-3 text-xs"
          onClick={() => onChange("cloud")}
          aria-pressed={priority === "cloud"}
        >
          <Cloud className="h-3.5 w-3.5 mr-1.5" />
          Cloud
        </Button>
      </div>
      {!localAvailable ? (
        <p className="text-[11px] text-muted-foreground text-center max-w-xs">
          On-device AI isn&apos;t available on this phone. Cloud uses Fintr&apos;s full ledger-aware assistant.
        </p>
      ) : priority === "local" ? (
        <p className="text-[11px] text-muted-foreground text-center max-w-xs">
          Answers stay on your phone. Falls back to cloud if on-device fails.
        </p>
      ) : (
        <p className="text-[11px] text-muted-foreground text-center max-w-xs">
          Uses Fintr cloud AI with your data. Uses on-device when offline.
        </p>
      )}
    </div>
  );
};
