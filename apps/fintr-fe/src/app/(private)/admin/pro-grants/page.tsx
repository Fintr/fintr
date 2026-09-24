"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Gift, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatProGrantDate } from "@/components/settings/pro-grant-thank-you-dialog";
import { useAuthApi } from "@/hooks/useAuthApi";
import { fetchProGrants, grantProYear } from "@/services/admin/pro-grants";
import { formatApiErrorMessage } from "@/utils/errorUtils";

const PRO_GRANTS_QUERY_KEY = ["admin", "proGrants"] as const;

const ProGrantsPage = () => {
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user",
  });
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const { data: grants = [], isLoading } = useQuery({
    queryKey: PRO_GRANTS_QUERY_KEY,
    queryFn: () => fetchProGrants(api),
  });
  const grantMutation = useMutation({
    mutationFn: (nextEmail: string) => grantProYear(api, nextEmail),
    onSuccess: async (grant) => {
      toast.success(`1 year of Fintr Pro granted to ${grant.email}`);
      setEmail("");
      await queryClient.invalidateQueries({ queryKey: PRO_GRANTS_QUERY_KEY });
    },
    onError: (error: unknown) => {
      toast.error(formatApiErrorMessage(error, "Couldn't grant Fintr Pro"));
    },
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextEmail = email.trim();
    if (!nextEmail) {
      toast.error("Enter an email address");
      return;
    }

    grantMutation.mutate(nextEmail);
  };

  return (
    <div className="container mx-auto py-4 sm:py-8">
      <div className="mb-6 sm:mb-8">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-primary sm:text-3xl">
          <Gift className="h-6 w-6 sm:h-8 sm:w-8" />
          Pro grants
        </h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          Give an existing account 1 year of Fintr Pro. They&apos;ll see a thank-you the next time they open the app.
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-primary">Grant by email</CardTitle>
          <CardDescription>
            The address has to match an account that already exists.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={handleSubmit}>
            <div className="flex-1 space-y-2">
              <Label htmlFor="pro-grant-email">Email</Label>
              <Input
                id="pro-grant-email"
                type="email"
                autoComplete="off"
                placeholder="name@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <Button type="submit" disabled={grantMutation.isPending}>
              {grantMutation.isPending ? "Granting…" : "Grant 1 year"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-primary">Granted accounts</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex min-h-32 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Pro through</TableHead>
                  <TableHead>Thank-you</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grants.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground">
                      No grants yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  grants.map((grant) => (
                    <TableRow key={grant.id}>
                      <TableCell>{grant.email}</TableCell>
                      <TableCell>{formatProGrantDate(grant.expiresAt)}</TableCell>
                      <TableCell>{grant.acknowledgedAt ? "Seen" : "Waiting for next login"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProGrantsPage;
