import React from "react";
import { Button } from "@/components/ui/button";
import { Edit } from "lucide-react";

interface EditButtonProps {
  onClick: () => void;
  className?: string;
  size?: "sm" | "default" | "lg" | "icon";
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  disabled?: boolean;
  title?: string;
}

const EditButton = ({ 
  onClick, 
  className = "h-8 w-8 text-primary hover:bg-primary/30",
  size = "icon",
  variant = "ghost",
  disabled,
  title
}: EditButtonProps) => {
  return (
    <Button 
      variant={variant} 
      size={size} 
      className={className}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      <Edit className="h-4 w-4" />
    </Button>
  );
};

export default EditButton;
