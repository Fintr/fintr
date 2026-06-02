import React, { useRef, useEffect, forwardRef, TextareaHTMLAttributes } from 'react';
import { handleMultilineNotesKeyDown } from '@/lib/multiline-notes-keydown';
import { cn } from '@/lib/utils';
import { formControlSurfaceClassName } from '@/components/ui/form-control-surface';

interface ExpandableTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  className?: string;
  onImagePaste?: (files: File[]) => void;
  blurOnEnterKey?: boolean;
}

const ExpandableTextarea = forwardRef<HTMLTextAreaElement, ExpandableTextareaProps>(
  (
    {
      value,
      onChange,
      className = '',
      onImagePaste,
      blurOnEnterKey = false,
      onKeyDown,
      ...props
    },
    ref,
  ) => {
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

    const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      if (!onImagePaste) return;

      const clipboardData = e.clipboardData;
      if (!clipboardData) return;

      const items = Array.from(clipboardData.items);
      const imageFiles: File[] = [];

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault(); // Prevent the default paste behavior for images
          const file = item.getAsFile();
          if (file) {
            // Create a new File with a timestamp-based name
            const timestamp = new Date().getTime();
            const extension = file.type.split('/')[1] || 'png';
            const newFile = new File([file], `pasted-image-${timestamp}.${extension}`, {
              type: file.type,
            });
            imageFiles.push(newFile);
          }
        }
      }

      if (imageFiles.length > 0) {
        onImagePaste(imageFiles);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (blurOnEnterKey && e.key === 'Enter' && !e.shiftKey) {
        handleMultilineNotesKeyDown(e);
      }
      onKeyDown?.(e);
    };

    return (
      <textarea
        ref={combinedRef}
        value={value}
        onChange={onChange}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        className={cn(
          "resize-none w-full min-h-[40px] max-h-48 overflow-auto rounded-md px-3 py-2 text-sm transition-all outline-none",
          formControlSurfaceClassName,
          "focus-visible:ring-ring/50 focus-visible:ring-[3px]",
          className,
        )}
        rows={1}
        {...props}
      />
    );
  }
);
ExpandableTextarea.displayName = 'ExpandableTextarea';

export default ExpandableTextarea; 
