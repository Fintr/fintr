import React from "react";
import { Check, Clock, AlertCircle } from "lucide-react";

export interface NotificationProps {
  id: string;
  type: "info" | "warning" | "success";
  message: string;
  time: string;
  isRead: boolean;
}

const NotificationItem: React.FC<NotificationProps> = ({
  type,
  message,
  time,
  isRead,
}) => {
  const getIcon = () => {
    switch (type) {
      case "success":
        return <Check className="h-4 w-4 text-teal-100/500" />;
      case "warning":
        return <AlertCircle className="h-4 w-4 text-amber-500" />;
      case "info":
      default:
        return <Clock className="h-4 w-4 text-primary" />;
    }
  };

  return (
    <div
      className={`p-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${isRead ? "opacity-70" : ""}`}
    >
      <div className="flex items-start gap-3">
        <div className="p-1.5 bg-gray-100 rounded-full">{getIcon()}</div>
        <div className="flex-1">
          <p className="text-sm text-primary font-medium">{message}</p>
          <p className="text-xs text-gray-500 mt-1">{time}</p>
        </div>
        {!isRead && (
          <div className="h-2 w-2 rounded-full bg-blue-500 mt-1"></div>
        )}
      </div>
    </div>
  );
};

export default NotificationItem;
