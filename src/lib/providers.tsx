// app/providers.jsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { Toaster } from "@/components/ui/sonner";
import { Auth0Provider } from "@auth0/auth0-react";
import AuthWrapper from "@/components/auth-wrapper";

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
      <Auth0Provider
        domain={process.env.NEXT_PUBLIC_AUTH0_DOMAIN!}
        clientId={process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID!}
        useRefreshTokens={true}
        useRefreshTokensFallback={true}
        cacheLocation="localstorage"
        authorizationParams={{
          redirect_uri: process.env.NEXT_PUBLIC_APP_BASE_URL + "/dashboard",
          audience: process.env.NEXT_PUBLIC_BE_URL,
          scope: "openid profile email read:current_user read:users read:transactions offline_access",
        }}
      >
        <Toaster />
        <AuthWrapper>
          {children}
        </AuthWrapper>
      </Auth0Provider>
    </QueryClientProvider>
  );
}
