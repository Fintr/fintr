"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Eye, EyeOff } from "lucide-react";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { smartInAppBrowserGoogleSignIn } from "@/services/auth/modal-google-signin";

interface UnifiedAuthPageProps {
  onBack?: () => void;
  isLogin?: boolean;
  authToggle?: React.ReactNode;
}

// Check if we're in a Capacitor environment (iOS app)
const isCapacitorEnvironment = (): boolean => {
  return typeof window !== 'undefined' && (window as any).Capacitor !== undefined;
};

const UnifiedAuthPage = ({
  onBack,
  isLogin = true,
  authToggle,
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
  const [isLoginState, setIsLoginState] = useState(isLogin);

  useEffect(() => {
    setIsLoginState(isLogin);
  }, [isLogin]);

  useEffect(() => {
    if (isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, router]);

  const handleLoginChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setLoginData((prev) => ({ ...prev, [name]: value }));
  };

  const handleRegisterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setRegisterData((prev) => ({ ...prev, [name]: value }));
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

    if (registerData.password !== registerData.confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }

    if (registerData.password.length < 8) {
      toast.error("Password must be at least 8 characters long");
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
    } catch (error: any) {
      toast.error(error.message || "Registration failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      // Use smart in-app browser Google Sign-In (in-app browser on mobile, redirect on desktop)
      await smartInAppBrowserGoogleSignIn();
      // Note: User will be redirected, so no need to setIsLoading(false)
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      toast.error(error.message || "Google sign-in failed");
      setIsLoading(false);
    }
  };

  if (authLoading) {
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
    <div className="bg-white p-8 rounded-lg shadow-sm max-w-md mx-auto border border-gray-200">
      <div className="mb-8">
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center text-gray-600 hover:text-gray-800 mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </button>
        )}
        <div className="text-center mb-6">
          <div className="text-3xl font-bold text-blue-600 mb-2">Fintr</div>
          <h2 className="text-2xl font-semibold text-gray-800 mb-2">
            Welcome
          </h2>
          <p className="text-gray-600 text-sm">
            {isLoginState ? "Log in to fintr to continue to Fintr" : "Create your account to get started"}
          </p>
        </div>
      </div>

      {!isCapacitorEnvironment() && (
        <>
          <div className="mb-6">
            <Button
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full flex items-center justify-center space-x-3 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-md py-2.5 px-4 font-medium"
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
              <span className="px-2 bg-white text-gray-600 font-medium">
                OR
              </span>
            </div>
          </div>
        </>
      )}

      {authToggle && <div className="mb-6">{authToggle}</div>}

      {isLoginState ? (
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
                placeholder="akositsam@gmail.com"
                className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
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
                  className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 pr-10"
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
                onClick={() => setIsLoginState(false)}
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
                  className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
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
                  className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
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
                placeholder="john.doe@example.com"
                className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
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
                  className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 pr-10"
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
                  className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 pr-10"
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
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5"
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
                onClick={() => setIsLoginState(true)}
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

