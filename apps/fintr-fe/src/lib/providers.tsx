// app/providers.jsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { Provider as JotaiProvider } from "jotai";
import { ToasterWithSettings } from "@/components/ui/toaster-with-settings";
import { E2eTestHooks } from "@/components/e2e-test-hooks";
import { AuthProvider } from "@/contexts/AuthContext";
import { TutorialProvider } from "@/contexts/TutorialContext";
import { ToastSettingsProvider } from "@/contexts/ToastSettingsContext";
import AuthWrapper from "@/components/auth-wrapper";
import DeepLinkHandler from "@/components/deep-link-handler";
import SessionExpirationModal from "@/components/session-expiration-modal";
import { ErrorBoundary } from "@/components/error-boundary";
import { ThemeProvider } from "@/components/theme-provider";
import { NativeThemeSync } from "@/components/native-theme-sync";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000, // 10 minutes (renamed from cacheTime in v4)
        refetchOnWindowFocus: false,
        refetchOnMount: true,
        retry: 2,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      },
    },
  }));

  return (
    <ThemeProvider>
      <NativeThemeSync />
      <JotaiProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ErrorBoundary>
              <TutorialProvider>
                <ToastSettingsProvider>
                  <DeepLinkHandler />
                  <SessionExpirationModal />
                  <E2eTestHooks />
                  <ToasterWithSettings />
                  <AuthWrapper>
                    {children}
                  </AuthWrapper>
                </ToastSettingsProvider>
              </TutorialProvider>
            </ErrorBoundary>
          </AuthProvider>
        </QueryClientProvider>
      </JotaiProvider>
    </ThemeProvider>
  );
}
