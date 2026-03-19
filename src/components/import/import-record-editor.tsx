'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CalculatorInput } from '@/components/ui/calculator-input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useUpdateImportRecord, useImportSingleRecord } from '@/hooks/async/useImport';
import { Loader2, X, Check, CalendarIcon } from 'lucide-react';
import { useNumberInput } from '@/hooks/useNumberInput';
import { useAtomValue } from 'jotai';
import { expenseCategoryOptionsAtom, incomeCategoryOptionsAtom } from '@/atoms/dashboardAtoms';
import { numberFormatting } from '@/lib/utils';
import { format } from 'date-fns';

interface ImportRecordEditorProps {
  importId: string;
  importRecordId: string;
  initialData: {
    date?: string;
    description?: string;
    amount?: string | number;
    type?: string;
    category?: string;
  };
  errors?: string[];
  onCancel: () => void;
  onImported: () => void;
}

export const ImportRecordEditor: React.FC<ImportRecordEditorProps> = ({
  importId,
  importRecordId,
  initialData,
  errors = [],
  onCancel,
  onImported,
}) => {
  const updateMutation = useUpdateImportRecord();
  const importMutation = useImportSingleRecord();

  // Get category options based on type
  const expenseCategoryOptions = useAtomValue(expenseCategoryOptionsAtom);
  const incomeCategoryOptions = useAtomValue(incomeCategoryOptionsAtom);

  // Parse initial date string to Date object
  const parseInitialDate = (dateString?: string): Date | undefined => {
    if (!dateString) return undefined;
    try {
      const parsed = new Date(dateString);
      return isNaN(parsed.getTime()) ? undefined : parsed;
    } catch {
      return undefined;
    }
  };

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    parseInitialDate(initialData.date)
  );

  const [formData, setFormData] = useState({
    date: initialData.date || '',
    description: initialData.description || '',
    amount: initialData.amount?.toString() || '',
    type: initialData.type || 'expense',
    category: initialData.category || '',
  });

  // Update formData.date when selectedDate changes
  useEffect(() => {
    if (selectedDate) {
      setFormData((prev) => ({
        ...prev,
        date: format(selectedDate, 'yyyy-MM-dd'),
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        date: '',
      }));
    }
  }, [selectedDate]);

  // Update selectedDate when initialData.date changes
  useEffect(() => {
    if (!initialData.date) {
      setSelectedDate(undefined);
      return;
    }
    try {
      const parsed = new Date(initialData.date);
      if (!isNaN(parsed.getTime())) {
        setSelectedDate(parsed);
      } else {
        setSelectedDate(undefined);
      }
    } catch {
      setSelectedDate(undefined);
    }
  }, [initialData.date]);

  // Get category options based on current type
  const categoryOptions = useMemo(() => {
    return formData.type === 'income' ? incomeCategoryOptions : expenseCategoryOptions;
  }, [formData.type, incomeCategoryOptions, expenseCategoryOptions]);

  // Number input hook for amount field
  const amountInput = useNumberInput({
    initialValue: formData.amount,
    onValueChange: (cleanValue) => {
      setFormData((prev) => ({ ...prev, amount: cleanValue.toString() }));
    }
  });

  // Update amount input when formData.amount changes externally (e.g., from initialData)
  React.useEffect(() => {
    const formattedValue = numberFormatting.formatForInput(formData.amount);
    if (formattedValue !== amountInput.displayValue) {
      amountInput.setDisplayValue(formData.amount);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData.amount]);

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errors: Record<string, string> = {};

    if (!selectedDate) {
      errors.date = 'Date is required';
    }

    // Description is optional - no validation needed

    if (!formData.amount || formData.amount.trim() === '') {
      errors.amount = 'Amount is required';
    } else {
      const cleanAmount = numberFormatting.cleanForBackend(formData.amount);
      if (isNaN(cleanAmount) || cleanAmount === 0) {
        errors.amount = 'Amount cannot be zero';
      }
    }

    if (!formData.type || !['income', 'expense'].includes(formData.type)) {
      errors.type = 'Type must be income or expense';
    }

    if (!formData.category?.trim()) {
      errors.category = 'Category is required';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      return;
    }

    try {
      const cleanAmount = numberFormatting.cleanForBackend(formData.amount);
      await updateMutation.mutateAsync({
        importId,
        importRecordId,
        data: {
          date: formData.date,
          description: formData.description,
          amount: cleanAmount,
          type: formData.type as 'income' | 'expense',
          category: formData.category,
        },
      });
    } catch (error) {
      console.error('Failed to save record:', error);
    }
  };

  const handleImport = async () => {
    if (!validate()) {
      return;
    }

    // Save first, then import
    try {
      await handleSave();
      await importMutation.mutateAsync({
        importId,
        importRecordId,
      });
      onImported();
    } catch (error) {
      console.error('Failed to import record:', error);
    }
  };

  return (
    <div className="space-y-4">
      {/* Display original errors */}
      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="text-sm font-medium text-red-900 mb-2">Original Errors:</div>
          <ul className="list-disc list-inside space-y-1">
            {errors.map((error, idx) => (
              <li key={idx} className="text-sm text-red-900">{error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Form */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="date">Date *</Label>
          <Popover modal>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={`w-full justify-start text-left font-normal text-sm ${
                  validationErrors.date ? 'border-red-500' : ''
                }`}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? (
                  format(selectedDate, 'MMM d, yyyy')
                ) : (
                  <span className="text-sm">Pick a date</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                initialFocus
                defaultMonth={selectedDate || new Date()}
              />
            </PopoverContent>
          </Popover>
          {validationErrors.date && (
            <p className="text-sm text-red-900">{validationErrors.date}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="type">Type *</Label>
          <Select
            value={formData.type}
            onValueChange={(value) => {
              // Reset category when type changes since category options will be different
              setFormData({ ...formData, type: value, category: '' });
            }}
          >
            <SelectTrigger className={validationErrors.type ? 'border-red-500' : ''}>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="expense">Expense</SelectItem>
            </SelectContent>
          </Select>
          {validationErrors.type && (
            <p className="text-sm text-red-900">{validationErrors.type}</p>
          )}
        </div>

        <div className="space-y-2 col-span-2">
          <Label htmlFor="description">Description *</Label>
          <Input
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className={validationErrors.description ? 'border-red-500' : ''}
          />
          {validationErrors.description && (
            <p className="text-sm text-red-900">{validationErrors.description}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="amount">Amount *</Label>
          <CalculatorInput
            id="amount"
            placeholder="0.00"
            value={amountInput.displayValue}
            onChange={(value) => amountInput.handleInputChange(value)}
            className={validationErrors.amount ? 'border-red-500' : ''}
          />
          {validationErrors.amount && (
            <p className="text-sm text-red-900">{validationErrors.amount}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">Category *</Label>
          <Select
            value={formData.category}
            onValueChange={(value) => setFormData({ ...formData, category: value })}
          >
            <SelectTrigger 
              id="category" 
              className={validationErrors.category ? 'border-red-500' : ''}
            >
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {categoryOptions.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {validationErrors.category && (
            <p className="text-sm text-red-900">{validationErrors.category}</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 justify-end">
        <Button onClick={onCancel} variant="outline" size="sm">
          <X className="h-4 w-4 mr-2" />
          Cancel
        </Button>
        <Button onClick={handleSave} variant="outline" size="sm" disabled={updateMutation.isLoading}>
          {updateMutation.isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check className="h-4 w-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
        <Button onClick={handleImport} size="sm" disabled={importMutation.isLoading || updateMutation.isLoading}>
          {importMutation.isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Importing...
            </>
          ) : (
            <>
              <Check className="h-4 w-4 mr-2" />
              Import Record
            </>
          )}
        </Button>
      </div>
    </div>
  );
};








