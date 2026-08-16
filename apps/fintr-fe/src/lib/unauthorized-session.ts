/**
 * Handle API 401 without logging the user out.
 *
 * Attachment proxy failures and other non-auth 401s reuse HTTP 401
 * (`render_unauthorized`) even while the session is valid. Treating those as
 * session expiry pops the modal mid-import and aborts offline sync.
 *
 * True JWT expiry still goes through `triggerSessionExpiration` in `api.ts`
 * when the response message is "Signature has expired".
 */
export const respondToUnauthorizedApiError = (_url?: string): void => {
  return;
};
