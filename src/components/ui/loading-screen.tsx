import Image from "next/image";

interface LoadingScreenProps {
  className?: string;
  logoSize?: number;
}

const LoadingScreen = ({ 
  className = "flex flex-col items-center justify-center h-screen space-y-4",
  logoSize = 100 
}: LoadingScreenProps) => {
  return (
    <div className={className}>
      <Image 
        src="https://raw.githubusercontent.com/paoloparaiso/Fintr/c273332c59168c59539d499b2ee119186af8f88a/Fintr_Logo.png" 
        alt="Fintr Logo" 
        width={logoSize} 
        height={logoSize} 
        className="animate-pulse"
      />
    </div>
  );
};

export default LoadingScreen;
