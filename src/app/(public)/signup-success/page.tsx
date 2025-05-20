"use client";
import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

const SignupSuccessRedirect = () => {
  const router = useRouter();

  useEffect(() => {
    // Redirect to account setup after a short delay
    const timer = setTimeout(() => {
      router.push("/account-setup");
    }, 1500);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-[#FAF9F6] flex flex-col items-center justify-center p-4">
      <img
        src="https://raw.githubusercontent.com/paoloparaiso/Fintr/c273332c59168c59539d499b2ee119186af8f88a/Fintr_Logo.png"
        alt="Fintr Logo"
        className="h-16 mb-8"
      />
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-bold text-[#0A3D62] mb-2">
          Account Created Successfully!
        </h1>
        <p className="text-[#0A3D62]/70 mb-6">
          Redirecting you to set up your account...
        </p>
        <div className="flex justify-center">
          <Loader2 className="h-8 w-8 text-[#0A3D62] animate-spin" />
        </div>
      </div>
    </div>
  );
};

export default SignupSuccessRedirect;
