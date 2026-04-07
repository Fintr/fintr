import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNoteSuggestions } from '@/hooks/async/useNoteSuggestions';
import { cn } from '@/lib/utils';

interface NotesAutocompleteProps {
  id?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  categoryName?: string;
  transactionType?: 'income' | 'expense';
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const NotesAutocomplete: React.FC<NotesAutocompleteProps> = ({
  id,
  value,
  onChange,
  categoryName,
  transactionType,
  placeholder = "Add additional details",
  className,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: suggestions = [] } = useNoteSuggestions({
    categoryName,
    transactionType,
    limit: 10,
    enabled: !!categoryName,
  });

  // Filter suggestions based on current input
  // Show all suggestions when empty, filter when user types
  const filteredSuggestions = value.trim() === ''
    ? suggestions
    : suggestions.filter(
        (suggestion) =>
          suggestion.toLowerCase().includes(value.toLowerCase()) &&
          suggestion.toLowerCase() !== value.toLowerCase()
      );

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = ta.scrollHeight + 'px';
    }
  }, [value]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = useCallback(
    (suggestion: string) => {
      const syntheticEvent = {
        target: { value: suggestion },
      } as React.ChangeEvent<HTMLTextAreaElement>;
      onChange(syntheticEvent);
      setIsOpen(false);
      setHighlightedIndex(-1);
      textareaRef.current?.focus();
    },
    [onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!isOpen || filteredSuggestions.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev < filteredSuggestions.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev > 0 ? prev - 1 : filteredSuggestions.length - 1
          );
          break;
        case 'Enter':
          if (highlightedIndex >= 0) {
            e.preventDefault();
            handleSelect(filteredSuggestions[highlightedIndex]);
          }
          break;
        case 'Escape':
          setIsOpen(false);
          setHighlightedIndex(-1);
          break;
        case 'Tab':
          if (highlightedIndex >= 0) {
            e.preventDefault();
            handleSelect(filteredSuggestions[highlightedIndex]);
          } else {
            setIsOpen(false);
          }
          break;
      }
    },
    [isOpen, filteredSuggestions, highlightedIndex, handleSelect]
  );

  const handleFocus = () => {
    if (categoryName) {
      setIsOpen(true);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    let newValue = e.target.value;
    
    // Auto-capitalize: first letter and after periods
    if (newValue.length > 0) {
      // Capitalize first letter
      newValue = newValue.charAt(0).toUpperCase() + newValue.slice(1);
      
      // Capitalize after ". "
      newValue = newValue.replace(/\.\s+\w/g, (match) => {
        return match.toUpperCase();
      });
    }
    
    // Create synthetic event with capitalized value
    const syntheticEvent = {
      ...e,
      target: { ...e.target, value: newValue },
    } as React.ChangeEvent<HTMLTextAreaElement>;
    
    onChange(syntheticEvent);
    if (categoryName && newValue.length >= 0) {
      setIsOpen(true);
    }
    setHighlightedIndex(-1);
  };

  const showDropdown =
    isOpen && filteredSuggestions.length > 0 && !disabled;

  return (
    <div ref={containerRef} className="relative">
      <textarea
        ref={textareaRef}
        id={id}
        value={value}
        onChange={handleChange}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className={cn(
          "resize-none w-full min-h-[40px] max-h-48 overflow-auto rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-all outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
          className
        )}
        autoComplete="off"
      />

      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-1 w-full max-h-48 overflow-auto rounded-md border border-input bg-popover shadow-lg"
        >
          {filteredSuggestions.map((suggestion, index) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => handleSelect(suggestion)}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={cn(
                "w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground transition-colors",
                highlightedIndex === index && "bg-accent text-accent-foreground"
              )}
            >
              <span className="line-clamp-2">{suggestion}</span>
            </button>
          ))}
        </div>
      )}

      {categoryName && suggestions.length > 0 && !isOpen && !value && (
        <p className="text-xs text-muted-foreground mt-1">
          Start typing for suggestions based on previous notes
        </p>
      )}
    </div>
  );
};

export default NotesAutocomplete;
