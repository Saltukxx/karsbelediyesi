export type MobilizSyncStatus = {
  configured: boolean;
  lastSyncAt: string | null;
  lastSyncSuccess: boolean;
  lastSyncError: string | null;
  matched: number;
  updated: number;
  skipped: number;
  unmatchedPlates: string[];
};
