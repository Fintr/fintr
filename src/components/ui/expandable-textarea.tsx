import React, { useRef, useEffect, forwardRef, TextareaHTMLAttributes } from 'react';

interface ExpandableTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  className?: string;
}

const ExpandableTextarea = forwardRef<HTMLTextAreaElement, ExpandableTextareaProps>(
  ({ value, onChange, className = '', ...props }, ref) => {
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    // Allow parent to pass a ref
    const combinedRef = (node: HTMLTextAreaElement) => {
      if (typeof ref === 'function') ref(node);
      else if (ref) (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
      textareaRef.current = node;
    };

    useEffect(() => {
      const ta = textareaRef.current;
      if (ta) {
        ta.style.height = 'auto';
        ta.style.height = ta.scrollHeight + 'px';
      }
    }, [value]);

    return (
      <textarea
        ref={combinedRef}
        value={value}
        onChange={onChange}
        className={`resize-none w-full min-h-[40px] max-h-48 overflow-auto rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-all outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] ${className}`}
        rows={1}
        {...props}
      />
    );
  }
);
ExpandableTextarea.displayName = 'ExpandableTextarea';

export default ExpandableTextarea; 
