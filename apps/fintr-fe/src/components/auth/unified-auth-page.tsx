"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Eye, EyeOff } from "lucide-react";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { FintrLogo } from "@/components/brand/fintr-logo";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { smartInAppBrowserGoogleSignIn } from "@/services/auth/modal-google-signin";
import { smartAppleSignIn } from "@/services/auth/in-app-apple-signin";
import { isNativeCapacitor } from "@/lib/capacitor";
import { initCapacitorBridgeIfNeeded } from "@/lib/capacitor-bridge-init";
import { cn } from "@/lib/utils";

const authInputClassName =
  "border-0 shadow-none focus-visible:border-transparent focus-visible:ring-1 focus-visible:ring-ring/40";

interface UnifiedAuthPageProps {
  onBack?: () => void;
  isLogin?: boolean;
  authToggle?: React.ReactNode;
  onAuthModeChange?: (mode: "login" | "signup") => void;
}

const UnifiedAuthPage = ({
  onBack,
  isLogin = true,
  authToggle,
  onAuthModeChange,
}: UnifiedAuthPageProps) => {
  const { login, signup, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [registerData, setRegisterData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
  });
  const [registerError, setRegisterError] = useState<string | null>(null);
  const isSignupView = registerError !== null ? true : !isLogin;

  const showSignupForm = () => {
    setRegisterError(null);
    if (onAuthModeChange) {
      onAuthModeChange("signup");
      return;
    }

    router.push("/signup");
  };

  const showLoginForm = () => {
    setRegisterError(null);
    if (onAuthModeChange) {
      onAuthModeChange("login");
      return;
    }

    router.push("/login");
  };

  useEffect(() => {
    if (isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, router]);

  // Reset loading state when page becomes visible again
  // (e.g., user cancels auth flow or hits back button)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('🔄 Page became visible - resetting loading state');
        setIsLoading(false);
      }
    };

    // Also handle when the window regains focus (for Capacitor apps)
    const handleFocus = () => {
      console.log('🔄 Window regained focus - resetting loading state');
      setIsLoading(false);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    // Reset loading state on mount (in case user navigated back)
    setIsLoading(false);

    // On Android, Browser.close() is a no-op and browserFinished may not fire
    // when Chrome Custom Tab closes after a custom URL scheme redirect.
    // Use Capacitor's appStateChange event as the reliable signal that the
    // user has returned to the app (after the OAuth browser closed).
    let appStateCleanup: (() => void) | null = null;
    if (isNativeCapacitor()) {
      // Initialize bridge before importing any Capacitor plugin
      initCapacitorBridgeIfNeeded();
      import('@capacitor/app').then(({ App }) => {
        App.addListener('appStateChange', ({ isActive }: { isActive: boolean }) => {
          if (isActive) {
            console.log('🔄 App became active (Capacitor) - resetting loading state');
            setIsLoading(false);
          }
        }).then((handle) => {
          appStateCleanup = () => handle.remove();
        });
      }).catch(() => {
        // Ignore if @capacitor/app is unavailable
      });
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      appStateCleanup?.();
    };
  }, []);

  const handleLoginChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setLoginData((prev) => ({ ...prev, [name]: value }));
  };

  const handleRegisterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setRegisterData((prev) => ({ ...prev, [name]: value }));
    if (registerError) {
      setRegisterError(null);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await login({
        username: loginData.email,
        password: loginData.password,
      });
      toast.success("Welcome back to Fintr!");
    } catch (error: any) {
      toast.error(error.message || "Please check your credentials and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError(null);

    if (registerData.password !== registerData.confirmPassword) {
      setRegisterError("Passwords don't match");
      return;
    }

    if (registerData.password.length < 8) {
      setRegisterError("Password must be at least 8 characters long");
      return;
    }

    setIsLoading(true);

    try {
      await signup({
        firstName: registerData.firstName,
        lastName: registerData.lastName,
        email: registerData.email,
        password: registerData.password,
      });
      toast.success("Your account has been created. Welcome to Fintr!");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Registration failed";
      setRegisterError(message);
      onAuthModeChange?.("signup");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    console.log('\n=== User Clicked Google Sign-In ===');
    console.log('Timestamp:', new Date().toISOString());
    
    try {
      setIsLoading(true);
      console.log('Initiating Google sign-in flow...');
      
      // Use smart in-app browser Google Sign-In (in-app browser on mobile, redirect on desktop)
      await smartInAppBrowserGoogleSignIn();
      
      console.log('✅ Google sign-in flow completed');
      // Reset loading state after browser closes
      // If auth succeeded, user will be redirected via deep link
      // If user cancelled, they stay on this page and need loading state reset
      setIsLoading(false);
    } catch (error: any) {
      console.error('\n❌ Google sign-in error:', error.message || error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      console.error('==================================\n');
      toast.error(error.message || "Google sign-in failed");
      setIsLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    console.log('\n=== User Clicked Apple Sign-In ===');
    console.log('Timestamp:', new Date().toISOString());
    
    try {
      setIsLoading(true);
      console.log('Initiating Apple sign-in flow...');
      
      // Use smart in-app browser Apple Sign-In (in-app browser on mobile, redirect on desktop)
      await smartAppleSignIn();
      
      console.log('✅ Apple sign-in flow completed');
      // Reset loading state after browser closes
      // If auth succeeded, user will be redirected via deep link
      // If user cancelled, they stay on this page and need loading state reset
      setIsLoading(false);
    } catch (error: any) {
      console.error('\n❌ Apple sign-in error:', error.message || error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      console.error('==================================\n');
      toast.error(error.message || "Apple sign-in failed");
      setIsLoading(false);
    }
  };

  if (isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (authLoading && !isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 rounded-lg max-w-md mx-auto">
      <div className="mb-8">
        {onBack && !isNativeCapacitor() && (
          <button
            onClick={onBack}
            className="mb-6 flex items-center text-primary hover:text-primary/80 dark:text-primary-dark-mode dark:hover:text-primary-dark-mode/80"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </button>
        )}
        <div className="text-center mb-6">
          <FintrLogo className="mx-auto mb-4 h-12 w-auto dark:h-24" />
          <h2 className="mb-2 text-2xl font-semibold text-primary dark:text-primary-dark-mode">
            Welcome
          </h2>
          <p className="text-gray-600 text-sm">
            {isSignupView
              ? "Create your account to get started"
              : "Log in to fintr to continue to Fintr"}
          </p>
        </div>
      </div>

      <div className="mb-4 space-y-3">
        <Button
          onClick={handleAppleSignIn}
          disabled={isLoading}
          className="w-full flex items-center justify-center space-x-3 bg-black hover:bg-gray-900 text-white rounded-md py-2.5 px-4 font-medium"
        >
          {isLoading ? (
            <LoadingSpinner size="small" className="mr-2" />
          ) : (
            <>
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
              </svg>
              <span>Continue with Apple</span>
            </>
          )}
        </Button>
        <Button
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          className="w-full flex items-center justify-center space-x-3 bg-card hover:bg-accent/50 text-foreground border-0 shadow-none rounded-md py-2.5 px-4 font-medium"
        >
          {isLoading ? (
            <LoadingSpinner size="small" className="mr-2" />
          ) : (
            <>
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
                <path d="M1 1h22v22H1z" fill="none" />
              </svg>
              <span>Continue with Google</span>
            </>
          )}
        </Button>
      </div>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-background text-gray-600 font-medium">
            OR
          </span>
        </div>
      </div>

      {authToggle && <div className="mb-6">{authToggle}</div>}

      {!isSignupView ? (
        <div>
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-email" className="text-sm font-medium text-gray-700">
                Email address*
              </Label>
              <Input
                id="login-email"
                name="email"
                type="email"
                value={loginData.email}
                onChange={handleLoginChange}
                placeholder="Enter your email"
                className={authInputClassName}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password" className="text-sm font-medium text-gray-700">
                Password*
              </Label>
              <div className="relative">
                <Input
                  id="login-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={loginData.password}
                  onChange={handleLoginChange}
                  placeholder="••••••••"
                  className={cn(authInputClassName, "pr-10")}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="flex justify-start">
              <button
                type="button"
                className="text-sm text-blue-600 hover:text-blue-800 underline"
              >
                Forgot password?
              </button>
            </div>
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5"
            >
              {isLoading ? (
                <LoadingSpinner size="small" className="mr-2" />
              ) : (
                "Continue"
              )}
            </Button>

            <p className="text-center text-sm text-gray-600 mt-4">
              Don't have an account?{" "}
              <button
                type="button"
                onClick={showSignupForm}
                className="text-blue-600 font-medium hover:text-blue-800 underline"
              >
                Sign up
              </button>
            </p>
          </form>
        </div>
      ) : (
        <div>
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            {registerError ? (
              <div
                role="alert"
                data-testid="register-form-error"
                className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {registerError}
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="register-first-name" className="text-sm font-medium text-gray-700">
                  First Name*
                </Label>
                <Input
                  id="register-first-name"
                  name="firstName"
                  value={registerData.firstName}
                  onChange={handleRegisterChange}
                  placeholder="John"
                  className={authInputClassName}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="register-last-name" className="text-sm font-medium text-gray-700">
                  Last Name*
                </Label>
                <Input
                  id="register-last-name"
                  name="lastName"
                  value={registerData.lastName}
                  onChange={handleRegisterChange}
                  placeholder="Doe"
                  className={authInputClassName}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="register-email" className="text-sm font-medium text-gray-700">
                Email address*
              </Label>
              <Input
                id="register-email"
                name="email"
                type="email"
                value={registerData.email}
                onChange={handleRegisterChange}
                placeholder="Enter your email"
                className={authInputClassName}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="register-password" className="text-sm font-medium text-gray-700">
                Password*
              </Label>
              <div className="relative">
                <Input
                  id="register-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={registerData.password}
                  onChange={handleRegisterChange}
                  placeholder="At least 8 characters"
                  className={cn(authInputClassName, "pr-10")}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="register-confirm-password" className="text-sm font-medium text-gray-700">
                Confirm Password*
              </Label>
              <div className="relative">
                <Input
                  id="register-confirm-password"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={registerData.confirmPassword}
                  onChange={handleRegisterChange}
                  placeholder="Re-enter your password"
                  className={cn(authInputClassName, "pr-10")}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-2.5"
            >
              {isLoading ? (
                <LoadingSpinner size="small" className="mr-2" />
              ) : (
                "Create Account"
              )}
            </Button>

            <p className="text-center text-sm text-gray-600 mt-4">
              Already have an account?{" "}
              <button
                type="button"
                onClick={showLoginForm}
                className="text-blue-600 font-medium hover:text-blue-800 underline"
              >
                Sign In
              </button>
            </p>
          </form>
        </div>
      )}
    </div>
  );
};

export default UnifiedAuthPage;

