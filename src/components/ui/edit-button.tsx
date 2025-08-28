import React from "react";
import { Button } from "@/components/ui/button";
import { Edit } from "lucide-react";

interface EditButtonProps {
  onClick: () => void;
  className?: string;
  size?: "sm" | "default" | "lg" | "icon";
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
}

const EditButton = ({ 
  onClick, 
  className = "h-8 w-8 text-primary hover:bg-primary/30",
  size = "icon",
  variant = "ghost"
}: EditButtonProps) => {
  return (
    <Button 
      variant={variant} 
      size={size} 
      className={className}
      onClick={onClick}
    >
      <Edit className="h-4 w-4" />
    </Button>
  );
};

export default EditButton;
