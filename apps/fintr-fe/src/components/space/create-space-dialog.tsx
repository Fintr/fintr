"use client";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CurrencyPicker } from "@/components/ui/currency-picker";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthApi } from "@/hooks/useAuthApi";
import { useSpaceContext } from "@/hooks/useSpaceContext";
import { toast } from "sonner";
import { CURRENCY_CODES } from "@/data/currencies";

const createSpaceSchema = z.object({
  name: z.string().min(1, "Space name is required").max(50, "Name too long"),
  currency: z.string().min(3, "Currency is required").max(3, "Invalid currency"),
});

type CreateSpaceForm = z.infer<typeof createSpaceSchema>;

interface CreateSpaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DEFAULT_CURRENCY = "USD";

function getDefaultCurrency(currentSpaceCurrency: string | undefined): string {
  if (currentSpaceCurrency && CURRENCY_CODES.has(currentSpaceCurrency.toUpperCase())) {
    return currentSpaceCurrency.toUpperCase();
  }
  return DEFAULT_CURRENCY;
}

export function CreateSpaceDialog({ open, onOpenChange }: CreateSpaceDialogProps) {
  const { api } = useAuthApi();
  const queryClient = useQueryClient();
  const { switchSpace, currentSpace } = useSpaceContext(api);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const defaultCurrency = getDefaultCurrency(currentSpace?.currency);

  const form = useForm<CreateSpaceForm>({
    resolver: zodResolver(createSpaceSchema),
    defaultValues: {
      name: "",
      currency: defaultCurrency,
    },
  });

  // When dialog opens, reset form and set currency default from current space
  useEffect(() => {
    if (open) {
      const currency = getDefaultCurrency(currentSpace?.currency);
      form.reset({
        name: "",
        currency,
      });
    }
  }, [open, currentSpace?.currency, form]);

  const createSpaceMutation = useMutation({
    mutationFn: async (data: CreateSpaceForm) => {
      const response = await api.post("/spaces", data);
      toast.success("Organization space created successfully!");
      queryClient.invalidateQueries({ queryKey: ["spaces"] });
      onOpenChange(false);
      form.reset();

      if (response.data.data?.space?.code) {
        switchSpace(response.data.data.space.code);
      }

      return response.data;
    },
  });

  const onSubmit = async (data: CreateSpaceForm) => {
    setIsSubmitting(true);
    try {
      await createSpaceMutation.mutateAsync(data);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to create space");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create Organization Space</DialogTitle>
          <DialogDescription>
            Create a new organization space to collaborate with your team.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel className="text-sm">Space name</FormLabel>
                  <FormControl>
                    <Input placeholder="My Organization" className="h-9" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="currency"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel className="text-sm">Space currency</FormLabel>
                  <FormControl>
                    <CurrencyPicker
                      value={field.value}
                      onChange={field.onChange}
                      label=""
                      placeholder="Search by name or code..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting}
              >
                {isSubmitting ? "Creating..." : "Create Space"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

