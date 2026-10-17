import { HttpError } from "../errors";

export type MessageInput = {
  content: string;
  scheduledAt: Date;
  cancelIfContactReplies: boolean;
  cancelIfNotOpen: boolean;
};

export function parseMessageInput(input: unknown, now = new Date()): MessageInput {
  const record = input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
  const content = typeof record.content === "string" ? record.content : "";
  if (!content.trim()) throw new HttpError(400, "content_required");
  if (content.length > 150_000) throw new HttpError(400, "content_too_long");
  const scheduledAt = new Date(typeof record.scheduledAt === "string" ? record.scheduledAt : "");
  if (Number.isNaN(scheduledAt.getTime())) throw new HttpError(400, "scheduled_at_invalid");
  if (scheduledAt.getTime() <= now.getTime()) throw new HttpError(400, "scheduled_at_must_be_future");
  if (typeof record.cancelIfContactReplies !== "boolean" || typeof record.cancelIfNotOpen !== "boolean") {
    throw new HttpError(400, "cancellation_options_required");
  }
  return {
    content,
    scheduledAt,
    cancelIfContactReplies: record.cancelIfContactReplies,
    cancelIfNotOpen: record.cancelIfNotOpen,
  };
}

export function parsePositiveInt(value: unknown, code: string) {
  const parsed = typeof value === "string" ? Number.parseInt(value, 10) : Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new HttpError(400, code);
  return parsed;
}

export function retryDelayMs(attempt: number) {
  return Math.min(60 * 60_000, 15_000 * 2 ** Math.max(0, attempt - 1));
}
