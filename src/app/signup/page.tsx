"use client";

import UnifiedAuthPage from "@/components/auth/unified-auth-page";

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-background py-12">
      <div className="container mx-auto px-4">
        <UnifiedAuthPage isLogin={false} />
      </div>
    </div>
  );
}
