/**
 * True when a mutation failure should keep local state + pending outbox
 * (offline, timeout, connection refused) rather than rolling back.
 */
export const isNetworkLikeMutationError = (error: unknown): boolean => {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("failed to create")
      || message.includes("failed to update")
      || message.includes("failed to delete")
      || message.includes("network")
      || message.includes("failed to fetch")
      || message.includes("offline")
      || message.includes("timeout")
      || message.includes("err_network")
      || message.includes("err_internet_disconnected")
      || message.includes("econnrefused")
    );
  }

  if (error && typeof error === "object") {
    const record = error as {
      message?: unknown;
      code?: unknown;
      details?: unknown;
      success?: unknown;
      response?: unknown;
    };

    if (record.response == null) {
      const code =
        typeof record.code === "string" ? record.code.toLowerCase() : "";
      if (
        code === "err_network"
        || code === "econnaborted"
        || code === "etimedout"
        || code === "econnrefused"
      ) {
        return true;
      }
    }

    if (record.details != null || record.success === false) {
      return false;
    }
  }

  return false;
};

export const readBrowserOnline = (): boolean =>
  typeof navigator === "undefined" ? true : navigator.onLine !== false;
