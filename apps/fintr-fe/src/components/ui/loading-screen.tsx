import { LoadingFintrLogo } from "@/components/brand/fintr-logo";

interface LoadingScreenProps {
  className?: string;
  logoSize?: number;
}

const LoadingScreen = ({
  className = "flex flex-col items-center justify-center h-screen space-y-4",
  logoSize = 100,
}: LoadingScreenProps) => {
  return (
    <div className={className} data-testid="app-loading-screen">
      <LoadingFintrLogo size={logoSize} />
    </div>
  );
};

export default LoadingScreen;
