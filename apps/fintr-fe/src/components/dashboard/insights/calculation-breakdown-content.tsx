"use client";

import { MetricCalculation } from "@/services/insights/types";

const FormulaLine = ({ children }: { children: string }) => (
  <p className="text-xs font-mono bg-muted/50 rounded px-2 py-1.5 text-primary break-words">
    {children}
  </p>
);

interface CalculationBreakdownContentProps {
  title: string;
  calculation?: MetricCalculation;
  fallbackLabeledFormula?: string;
  fallbackNotes?: string[];
}

export const CalculationBreakdownContent = ({
  title,
  calculation,
  fallbackLabeledFormula = "",
  fallbackNotes = [],
}: CalculationBreakdownContentProps) => {
  const labeledFormula =
    calculation?.labeledFormula || fallbackLabeledFormula || "";
  const valueFormula = calculation?.formula;
  const showValueFormula =
    Boolean(valueFormula) && valueFormula !== labeledFormula;
  const notes = calculation?.notes?.length
    ? calculation.notes
    : fallbackNotes;

  return (
    <>
      <p className="text-sm font-semibold text-primary mb-2">{title}</p>
      <div className="space-y-2 mb-3">
        {labeledFormula ? <FormulaLine>{labeledFormula}</FormulaLine> : null}
        {showValueFormula && valueFormula ? (
          <FormulaLine>{valueFormula}</FormulaLine>
        ) : null}
      </div>

      {calculation?.inputs && calculation.inputs.length > 0 ? (
        <dl className="space-y-2 mb-3">
          {calculation.inputs.map((input) => (
            <div
              key={`${input.label}-${input.value}`}
              className="flex items-start justify-between gap-3 text-xs"
            >
              <dt className="text-primary/70 shrink-0">{input.label}</dt>
              <dd className="font-semibold text-primary text-right break-all">
                {input.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {notes.length > 0 ? (
        <ul className="space-y-2 text-xs text-primary/80 list-disc pl-4 border-t border-primary/10 pt-3">
          {notes.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
    </>
  );
};
