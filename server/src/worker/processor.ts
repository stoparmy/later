import { HttpError } from "../errors";
import { inspectConversationAtSend, sendScheduledMessage } from "../chatwoot/conversations";
import { markCancelled, markFailure, markSent } from "../messages/repository";
import { retryDelayMs } from "../messages/validation";
import type { ScheduledMessage } from "../types";

type ProcessorDependencies = {
  inspect: typeof inspectConversationAtSend;
  send: typeof sendScheduledMessage;
  sent: typeof markSent;
  cancelled: typeof markCancelled;
  failed: typeof markFailure;
  now: () => number;
};

const defaultDependencies: ProcessorDependencies = {
  inspect: inspectConversationAtSend,
  send: sendScheduledMessage,
  sent: markSent,
  cancelled: markCancelled,
  failed: markFailure,
  now: Date.now,
};

export async function processMessage(
  message: ScheduledMessage,
  maxAttempts: number,
  dependencies: ProcessorDependencies = defaultDependencies,
) {
  try {
    const inspection = await dependencies.inspect({
      accountId: message.accountId,
      conversationId: message.conversationId,
      baselineMessageId: message.baselineMessageId,
      laterMessageId: message.id,
    });

    if (inspection.existingChatwootMessageId) {
      await dependencies.sent(message.id, inspection.existingChatwootMessageId, message.lockedBy);
      return;
    }
    if (message.cancelIfNotOpen && inspection.status !== "open") {
      await dependencies.cancelled(message.id, `conversation_not_open:${inspection.status || "unknown"}`, message.lockedBy);
      return;
    }
    if (message.cancelIfContactReplies && inspection.contactReplied) {
      await dependencies.cancelled(message.id, "contact_replied", message.lockedBy);
      return;
    }

    const chatwootMessageId = await dependencies.send({
      id: message.id,
      accountId: message.accountId,
      conversationId: message.conversationId,
      content: message.content,
    });
    await dependencies.sent(message.id, chatwootMessageId, message.lockedBy);
  } catch (error) {
    const retryable = isRetryable(error);
    const retryAt = retryable && message.attempts < maxAttempts
      ? new Date(dependencies.now() + retryDelayMs(message.attempts))
      : null;
    await dependencies.failed(message.id, safeError(error), retryAt, message.lockedBy);
  }
}

export function isRetryable(error: unknown) {
  if (!(error instanceof HttpError)) return true;
  return error.status === 408 || error.status === 429 || error.status >= 500;
}

function safeError(error: unknown) {
  if (error instanceof HttpError) return `${error.code}: ${error.message}`;
  return error instanceof Error ? error.message : "unknown_error";
}
