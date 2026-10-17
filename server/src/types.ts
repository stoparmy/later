export const dashboardHeaderNames = ["access-token", "token-type", "client", "expiry", "uid"] as const;

export type DashboardAuthBundle = Record<(typeof dashboardHeaderNames)[number], string>;

export type DashboardActor = {
  id: number;
  accountId: number;
  email: string;
  name: string;
  role: "admin" | "agent";
  isAdmin: boolean;
};

export type ScheduledMessageStatus = "pending" | "processing" | "sent" | "failed" | "cancelled";

export type ScheduledMessage = {
  id: string;
  accountId: number;
  conversationId: number;
  inboxId: number;
  content: string;
  scheduledAt: Date;
  nextAttemptAt: Date | null;
  status: ScheduledMessageStatus;
  cancelIfContactReplies: boolean;
  cancelIfNotOpen: boolean;
  baselineMessageId: number | null;
  createdById: number;
  createdByName: string;
  updatedById: number;
  updatedByName: string;
  attempts: number;
  lastError: string | null;
  lockedBy: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};
