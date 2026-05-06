import React from "react";
import NotificationItem, { NotificationProps } from "@/components/dashboard/notification-item";
import { Button } from "@/components/ui/button";

interface NotificationsPopupProps {
  notifications: NotificationProps[];
  onClose: () => void;
  onMarkAllAsRead: () => void;
}

const NotificationsPopup: React.FC<NotificationsPopupProps> = ({
  notifications,
  onClose,
  onMarkAllAsRead,
}) => {
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="absolute top-12 right-0 w-80 bg-white rounded-md shadow-lg border border-gray-200 z-50">
      <div className="p-3 border-b border-gray-100 flex justify-between items-center">
        <h3 className="font-medium text-primary">
          Notifications
          {unreadCount > 0 && (
            <span className="ml-2 text-xs bg-blue-100/50 text-blue-600 px-2 py-0.5 rounded-full">
              {unreadCount} new
            </span>
          )}
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onMarkAllAsRead}
          className="text-xs text-primary hover:text-primary/80"
        >
          Mark all as read
        </Button>
      </div>

      <div className="max-h-80 overflow-y-auto">
        {notifications.length > 0 ? (
          notifications.map((notification) => (
            <NotificationItem key={notification.id} {...notification} />
          ))
        ) : (
          <div className="p-4 text-center text-gray-500 text-sm">
            No notifications
          </div>
        )}
      </div>

      <div className="p-2 border-t border-gray-100 text-center">
        <Button
          variant="link"
          size="sm"
          className="text-xs text-primary hover:text-primary/80"
        >
          View all notifications
        </Button>
      </div>
    </div>
  );
};

export default NotificationsPopup;
