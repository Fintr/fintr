"use client";

import { AiInteraction } from "@/services/admin/ai-interactions";

type ToolCallEntry = {
  name: string;
  arguments: Record<string, unknown>;
  result: string;
  result_truncated?: boolean;
};

const renderJsonBlock = (value: unknown) => (
  <pre className="text-xs overflow-auto whitespace-pre-wrap">
    {JSON.stringify(value, null, 2)}
  </pre>
);

const ToolCallsSection = ({ toolCalls }: { toolCalls: ToolCallEntry[] }) => (
  <div className="space-y-3">
    {toolCalls.map((toolCall, index) => (
      <div
        key={`${toolCall.name}-${index}`}
        className="rounded-md border border-border bg-background p-3 space-y-2"
      >
        <div className="flex items-center justify-between gap-2">
          <h5 className="text-sm font-medium">
            {index + 1}. {toolCall.name}
          </h5>
          {toolCall.result_truncated && (
            <span className="text-xs text-muted-foreground">Result truncated</span>
          )}
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Arguments</p>
          {renderJsonBlock(toolCall.arguments)}
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Result returned to model</p>
          <div className="bg-muted p-2 rounded-md">
            <p className="text-sm whitespace-pre-wrap">{toolCall.result}</p>
          </div>
        </div>
      </div>
    ))}
  </div>
);

export const AiInteractionAuditDetails = ({
  interaction,
}: {
  interaction: AiInteraction;
}) => {
  const metadata = interaction.metadata ?? {};
  const isAgentic = metadata.agentic === true;
  const toolCalls = Array.isArray(metadata.tool_calls) ? metadata.tool_calls as ToolCallEntry[] : [];
  const reasoningNotes = Array.isArray(metadata.reasoning_notes) ? metadata.reasoning_notes as string[] : [];
  const structuredData = metadata.structured_data;
  const vectorResults = metadata.vector_results;

  const remainingMetadata = { ...metadata };
  [
    "tool_calls",
    "reasoning_notes",
    "structured_data",
    "vector_results",
    "steps",
  ].forEach((key) => {
    delete remainingMetadata[key];
  });

  return (
    <>
      {interaction.enhanced_prompt && (
        <div>
          <h4 className="font-medium mb-2">
            {isAgentic ? "Agent Tool Call Audit" : "Enhanced Prompt Sent to Model"}
          </h4>
          <div className="bg-blue-50 border border-blue-200 dark:bg-blue-950/40 dark:border-blue-800/50 p-3 rounded-md">
            <p className="text-sm whitespace-pre-wrap">{interaction.enhanced_prompt}</p>
          </div>
        </div>
      )}

      {toolCalls.length > 0 && (
        <div>
          <h4 className="font-medium mb-2">Tool Calls</h4>
          <ToolCallsSection toolCalls={toolCalls} />
        </div>
      )}

      {reasoningNotes.length > 0 && (
        <div>
          <h4 className="font-medium mb-2">Agent Reasoning Notes</h4>
          <div className="bg-muted p-3 rounded-md space-y-2">
            {reasoningNotes.map((note, index) => (
              <p key={index} className="text-sm whitespace-pre-wrap">
                {index + 1}. {note}
              </p>
            ))}
          </div>
        </div>
      )}

      {Array.isArray(structuredData) && structuredData.length > 0 && (
        <div>
          <h4 className="font-medium mb-2">Structured Database Results</h4>
          <div className="bg-muted p-3 rounded-md">
            {renderJsonBlock(structuredData)}
          </div>
        </div>
      )}

      {Array.isArray(vectorResults) && vectorResults.length > 0 && (
        <div>
          <h4 className="font-medium mb-2">Vector Search Results</h4>
          <div className="bg-muted p-3 rounded-md">
            {renderJsonBlock(vectorResults)}
          </div>
        </div>
      )}

      {Object.keys(remainingMetadata).length > 0 && (
        <div>
          <h4 className="font-medium mb-2">Additional Metadata</h4>
          <div className="bg-muted p-3 rounded-md">
            {renderJsonBlock(remainingMetadata)}
          </div>
        </div>
      )}
    </>
  );
};
