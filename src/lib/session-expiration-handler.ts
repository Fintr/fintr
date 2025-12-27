/**
 * Session expiration handler utility
 * Dispatches a custom event when session expires
 */

const SESSION_EXPIRED_EVENT = 'session-expired';

export const triggerSessionExpiration = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
  }
};

export const SESSION_EXPIRED_EVENT_NAME = SESSION_EXPIRED_EVENT;

