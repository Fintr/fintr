/**
 * Session expiration handler utility
 * Dispatches a custom event when session expires
 */

const SESSION_EXPIRED_EVENT = 'session-expired';

// Flag to prevent multiple triggers
let hasTriggered = false;

export const triggerSessionExpiration = () => {
  if (typeof window !== 'undefined' && !hasTriggered) {
    hasTriggered = true;
    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
  }
};

export const resetSessionExpirationFlag = () => {
  hasTriggered = false;
};

export const SESSION_EXPIRED_EVENT_NAME = SESSION_EXPIRED_EVENT;

