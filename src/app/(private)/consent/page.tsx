import { useAuth0 } from "@auth0/auth0-react";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";

const ConsentPage = () => {
  const { getAccessTokenWithPopup } = useAuth0();

  const router = useRouter();

  const handleConsentClick = async () => {
    try {
      const accessToken = await getAccessTokenWithPopup({
        authorizationParams: {
          audience: process.env.NEXT_PUBLIC_BE_URL,
          scope: "openid profile email",
        }
      });
      console.log(accessToken);
      // After successful consent, navigate back to dashboard
      router.push("/dashboard");
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-8 text-center">
        <h1 className="text-2xl md:text-3xl font-bold text-primary mb-4">
          Additional Permissions Required
        </h1>
        <p className="text-primary/70 mb-6">
          To access all features of the application, we need your consent for additional permissions. 
          This allows us to securely access the resources you need.
        </p>
        <div className="flex justify-center">
          <Button 
            onClick={handleConsentClick}
            className="bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-md"
          >
            Grant Permissions
          </Button>
        </div>
        <p className="mt-4 text-sm text-gray-500">
          You can revoke these permissions at any time from your account settings.
        </p>
      </div>
    </div>
  );
};

export default ConsentPage;
