export const OFFLINE_SYNC_HEADLINE =
  "Making Fintr offline-ready";

export const OFFLINE_SYNC_SUBHEADLINE =
  "Syncing your workspaces with the backend so your data loads instantly — even without a connection.";

export const OFFLINE_SYNC_ROTATING_MESSAGES = [
  "Gathering your accounts…",
  "Downloading your full transaction history…",
  "Saving loans and transfers…",
  "Saving your budgets and categories…",
  "Preparing your dashboard…",
  "Almost there — building your offline copy…",
  "Syncing workspace by workspace…",
  "Storing everything safely on this device…",
  "Fintr works best when your data travels with you.",
  "One moment — future-you will thank present-you.",
  "Turning your financial history into an offline-ready library…",
] as const;

export const pickOfflineSyncMessage = (index: number): string => {
  const messages = OFFLINE_SYNC_ROTATING_MESSAGES;
  return messages[index % messages.length];
};
