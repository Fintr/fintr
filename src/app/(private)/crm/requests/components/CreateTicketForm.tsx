"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import ExpandableTextarea from '@/components/ui/expandable-textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useCreateTicket } from '@/hooks/async/useTickets';
import { AlertCircle } from 'lucide-react';
import ImageUploadInput from '@/components/crm/ImageUploadInput';
import { useImagePaste } from '@/hooks/useImagePaste';
import { ButtonLoader } from '@/components/ui/loading';


const createTicketSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title is too long'),
  description: z.string().min(1, 'Description is required'),
  ticketType: z.enum(['bug_report', 'feature_request', 'general_feedback', 'help_request', 'billing_issue', 'account_issue', 'other']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
});

type CreateTicketForm = z.infer<typeof createTicketSchema>;

interface CreateTicketFormProps {
  onSuccess: () => void;
}

export default function CreateTicketForm({ onSuccess }: CreateTicketFormProps) {
  const [selectedImages, setSelectedImages] = useState<File[]>([]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    trigger,
    formState: { errors }
  } = useForm<CreateTicketForm>({
    resolver: zodResolver(createTicketSchema),
    defaultValues: {
      priority: 'medium',
      ticketType: 'general_feedback'
    }
  });

  const createTicketMutation = useCreateTicket();
  const watchedType = watch('ticketType');
  const watchedPriority = watch('priority');

  const { handleImagePaste } = useImagePaste({
    maxImages: 5,
    maxSizeInMB: 10,
    currentImageCount: selectedImages.length,
    onImagesAdded: (newFiles) => {
      setSelectedImages(prev => [...prev, ...newFiles]);
    }
  });

  const onSubmit = async (data: CreateTicketForm) => {
    try {
      const payload = {
        title: data.title,
        description: data.description,
        ticketType: data.ticketType,
        priority: data.priority,
        images: selectedImages.length > 0 ? selectedImages : undefined,
      };

      await createTicketMutation.mutateAsync(payload);
      onSuccess();
    } catch (error) {
      console.error('Error creating ticket:', error);
    }
  };

  const getTypeDescription = (type: string) => {
    switch (type) {
      case 'general_feedback':
        return 'Share your thoughts and suggestions about our service';
      case 'bug_report':
        return 'Report a problem or issue you encountered';
      case 'feature_request':
        return 'Request a new feature or improvement';
      case 'help_request':
        return 'Ask for help or support with using our service';
      case 'billing_issue':
        return 'Questions or problems related to billing';
      case 'account_issue':
        return 'Problems with your account or login';
      case 'other':
        return 'Any other type of inquiry or feedback';
      default:
        return '';
    }
  };

  const getPriorityDescription = (priority: string) => {
    switch (priority) {
      case 'low':
        return 'Can wait - not time sensitive';
      case 'medium':
        return 'Normal priority - standard response time';
      case 'high':
        return 'Important - needs attention soon';
      case 'urgent':
        return 'Critical - immediate attention required';
      default:
        return '';
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {createTicketMutation.isError && (
        <div className="bg-red-100/50 border border-red-300 text-red-700 px-4 py-3 rounded">
          <div className="flex items-center">
            <AlertCircle className="h-4 w-4 mr-2" />
            Failed to create ticket. Please try again.
          </div>
        </div>
      )}

      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="title">Title *</Label>
        <ExpandableTextarea
          id="title"
          value={watch('title') || ''}
          onChange={(e) => {
            setValue('title', e.target.value);
            trigger('title');
          }}
          placeholder="Brief description of your issue or request"
          className={`${errors.title ? 'border-red-800' : ''} min-h-[40px] max-h-[120px]`}
          rows={1}
        />
        {errors.title && (
          <p className="text-sm bg-red-800">{errors.title.message}</p>
        )}
      </div>

      {/* Type */}
      <div className="space-y-2">
        <Label htmlFor="ticketType">Type *</Label>
        <Select 
          value={watchedType} 
          onValueChange={(value) => setValue('ticketType', value as any)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="z-40">
            <SelectItem value="general_feedback">General Feedback</SelectItem>
            <SelectItem value="bug_report">Bug Report</SelectItem>
            <SelectItem value="feature_request">Feature Request</SelectItem>
            <SelectItem value="help_request">Help Request</SelectItem>
            <SelectItem value="billing_issue">Billing Issue</SelectItem>
            <SelectItem value="account_issue">Account Issue</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
        {watchedType && (
          <p className="text-sm text-gray-600">{getTypeDescription(watchedType)}</p>
        )}
        {errors.ticketType && (
          <p className="text-sm bg-red-800">{errors.ticketType.message}</p>
        )}
      </div>

      {/* Priority */}
      <div className="space-y-2">
        <Label htmlFor="priority">Priority *</Label>
        <Select 
          value={watchedPriority} 
          onValueChange={(value) => setValue('priority', value as any)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="z-40">
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
          </SelectContent>
        </Select>
        {watchedPriority && (
          <p className="text-sm text-gray-600">{getPriorityDescription(watchedPriority)}</p>
        )}
        {errors.priority && (
          <p className="text-sm bg-red-800">{errors.priority.message}</p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description *</Label>
        <div className="relative">
          <ExpandableTextarea
            id="description"
            value={watch('description') || ''}
            onChange={(e) => {
              setValue('description', e.target.value);
              trigger('description');
            }}
            onImagePaste={handleImagePaste}
            placeholder="Provide detailed information about your issue or request... (You can also paste images here)"
            className={`${errors.description ? 'border-red-800' : ''} min-h-[100px] max-h-[300px]`}
            rows={3}
          />
          <div className="absolute bottom-2 right-2 text-xs text-gray-400 pointer-events-none">
            Ctrl+V to paste images
          </div>
        </div>
        {errors.description && (
          <p className="text-sm bg-red-800">{errors.description.message}</p>
        )}
      </div>

      {/* Image Upload */}
      <ImageUploadInput
        images={selectedImages}
        onImagesChange={setSelectedImages}
        label="Images (Optional)"
        description="Add images to help explain your issue"
        maxImages={5}
        maxSizeInMB={10}
        disabled={createTicketMutation.isLoading}
      />

      {/* Submit Button */}
      <div className="flex justify-end space-x-4 pt-6">
        <Button
          type="submit"
          disabled={createTicketMutation.isLoading}
          className="bg-primary hover:bg-primary/90"
        >
          {createTicketMutation.isLoading ? (
            <ButtonLoader text="Creating..." />
          ) : (
            'Create Ticket'
          )}
        </Button>
      </div>
    </form>
  );
}
