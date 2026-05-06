"use client";

import React from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownContentProps {
  content: string;
  className?: string;
}

const markdownComponents: Components = {
  p: ({ children }) => (
    <p className="my-2 leading-relaxed last:mb-0">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="my-2 list-disc pl-5 space-y-0.5">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 list-decimal pl-5 space-y-0.5">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="my-0.5">
      {children}
    </li>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">
      {children}
    </strong>
  ),
};

/**
 * Renders markdown (bold, lists, etc.) for AI assistant messages.
 * Uses react-markdown + remark-gfm; no raw HTML for safety.
 */
export function MarkdownContent({ content, className = "" }: MarkdownContentProps) {
  if (!content?.trim()) return null;

  return (
    <div className={`text-sm ${className}`}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={markdownComponents}
      >
        {content}
      </Markdown>
    </div>
  );
}
