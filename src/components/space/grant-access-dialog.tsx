"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Copy, Mail } from "lucide-react";
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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthApi } from "@/hooks/useAuthApi";
import { useSpaceContext } from "@/hooks/useSpaceContext";
import { toast } from "sonner";

const grantAccessSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["admin", "member"]),
});

type GrantAccessForm = z.infer<typeof grantAccessSchema>;

interface GrantAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GrantAccessDialog({ open, onOpenChange }: GrantAccessDialogProps) {
  const { api } = useAuthApi();
  const queryClient = useQueryClient();
  const { currentSpace } = useSpaceContext(api);
  const [accessLink, setAccessLink] = useState<string>("");

  const form = useForm<GrantAccessForm>({
    resolver: zodResolver(grantAccessSchema),
    defaultValues: {
      email: "",
      role: "member",
    },
  });

  const grantAccessMutation = useMutation({
    mutationFn: async (data: GrantAccessForm) => {
      const response = await api.post(
        `/spaces/${currentSpace?.code}/users/grant_access`,
        data
      );
      return response.data;
    },
    onSuccess: (data) => {
      toast.success("Access granted successfully!");
      setAccessLink(data.data.access_link);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["space-users"] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to grant access");
    },
  });

  const copyAccessLink = async () => {
    try {
      await navigator.clipboard.writeText(accessLink);
      toast.success("Access link copied to clipboard!");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const onSubmit = async (data: GrantAccessForm) => {
    await grantAccessMutation.mutateAsync(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Grant Access to Space</DialogTitle>
          <DialogDescription>
            Grant team members access to collaborate in this organization space.
          </DialogDescription>
        </DialogHeader>
        
        {!accessLink ? (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input 
                        type="email" 
                        placeholder="user@example.com" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <FormControl>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant={field.value === "admin" ? "default" : "outline"}
                          onClick={() => field.onChange("admin")}
                          className="flex-1"
                        >
                          Admin
                        </Button>
                        <Button
                          type="button"
                          variant={field.value === "member" ? "default" : "outline"}
                          onClick={() => field.onChange("member")}
                          className="flex-1"
                        >
                          Member
                        </Button>
                      </div>
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
                  disabled={grantAccessMutation.isLoading}
                >
                  {grantAccessMutation.isLoading ? "Granting..." : "Grant Access"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <Mail className="h-4 w-4 text-green-600" />
                <span className="font-medium text-green-800">Access Granted!</span>
              </div>
              <p className="text-sm text-green-700 mb-3">
                Share this link with your team member to join the space.
              </p>
              <div className="flex gap-2">
                <Input 
                  value={accessLink} 
                  readOnly 
                  className="flex-1 text-sm"
                />
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={copyAccessLink}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

