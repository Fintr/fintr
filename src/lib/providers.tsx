// app/providers.jsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import AuthWrapper from "@/components/auth-wrapper";
import DeepLinkHandler from "@/components/deep-link-handler";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutes
        cacheTime: 10 * 60 * 1000, // 10 minutes
        refetchOnWindowFocus: false,
        refetchOnMount: true,
        retry: 2,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <DeepLinkHandler />
        <Toaster />
        <AuthWrapper>
          {children}
        </AuthWrapper>
      </AuthProvider>
    </QueryClientProvider>
  );
}
