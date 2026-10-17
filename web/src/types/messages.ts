export type DashboardContext = {
  accountId: number;
  inboxId: number;
  conversationId: number;
  contactId: number;
  contactName: string;
};

export type ScheduledMessage = {
  id: string;
  content: string;
  scheduledAt: string;
  nextAttemptAt: string | null;
  status: "pending" | "failed";
  cancelIfContactReplies: boolean;
  cancelIfNotOpen: boolean;
  createdBy: { id: number; name: string };
  updatedBy: { id: number; name: string };
  attempts: number;
  lastError: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type Editor = {
  messageId: string | null;
  version: number | null;
  content: string;
  scheduledLocal: string;
  cancelIfContactReplies: boolean;
  cancelIfNotOpen: boolean;
};
