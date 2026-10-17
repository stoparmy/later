import { Router } from "express";
import { actorFrom, dashboardAuthFrom } from "../auth";
import { getBaselineMessageId, verifyConversationAccess } from "../chatwoot/conversations";
import { HttpError, route } from "../errors";
import {
  cancelScheduledMessage,
  createScheduledMessage,
  listVisibleMessages,
  updateScheduledMessage,
} from "../messages/repository";
import { parseMessageInput, parsePositiveInt } from "../messages/validation";
import type { ScheduledMessage } from "../types";

export const embeddedRouter = Router();

embeddedRouter.get("/me", route(async (req, res) => {
  res.json({ actor: actorFrom(req) });
}));

embeddedRouter.get("/scheduled-messages", route(async (req, res) => {
  const scope = await conversationScope(req);
  const messages = await listVisibleMessages(scope.actor.accountId, scope.conversationId);
  res.json({ messages: messages.map(toJson) });
}));

embeddedRouter.post("/scheduled-messages", route(async (req, res) => {
  const scope = await conversationScope(req);
  const messageInput = parseMessageInput(req.body);
  const baselineMessageId = await getBaselineMessageId({
    accountId: scope.actor.accountId,
    conversationId: scope.conversationId,
    auth: dashboardAuthFrom(req),
  });
  const message = await createScheduledMessage({
    ...messageInput,
    accountId: scope.actor.accountId,
    conversationId: scope.conversationId,
    inboxId: scope.inboxId,
    baselineMessageId,
    actor: scope.actor,
  });
  res.status(201).json({ message: toJson(message) });
}));

embeddedRouter.put("/scheduled-messages/:id", route(async (req, res) => {
  const scope = await conversationScope(req);
  const id = uuid(req.params.id);
  const version = parsePositiveInt(req.body?.version, "version_required");
  const messageInput = parseMessageInput(req.body);
  const baselineMessageId = await getBaselineMessageId({
    accountId: scope.actor.accountId,
    conversationId: scope.conversationId,
    auth: dashboardAuthFrom(req),
  });
  const message = await updateScheduledMessage({
    ...messageInput,
    id,
    accountId: scope.actor.accountId,
    conversationId: scope.conversationId,
    baselineMessageId,
    version,
    actor: scope.actor,
  });
  res.json({ message: toJson(message) });
}));

embeddedRouter.delete("/scheduled-messages/:id", route(async (req, res) => {
  const scope = await conversationScope(req);
  const id = uuid(req.params.id);
  const version = parsePositiveInt(req.query.version, "version_required");
  await cancelScheduledMessage({
    id,
    accountId: scope.actor.accountId,
    conversationId: scope.conversationId,
    version,
    actor: scope.actor,
  });
  res.status(204).end();
}));

async function conversationScope(req: Parameters<typeof actorFrom>[0]) {
  const actor = actorFrom(req);
  const conversationId = parsePositiveInt(req.query.conversationId, "conversation_id_required");
  const inboxId = parsePositiveInt(req.query.inboxId, "inbox_id_required");
  await verifyConversationAccess({
    accountId: actor.accountId,
    conversationId,
    expectedInboxId: inboxId,
    auth: dashboardAuthFrom(req),
  });
  return { actor, conversationId, inboxId };
}

function uuid(value: unknown) {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new HttpError(400, "scheduled_message_id_invalid");
  }
  return value;
}

function toJson(message: ScheduledMessage) {
  return {
    id: message.id,
    content: message.content,
    scheduledAt: message.scheduledAt.toISOString(),
    nextAttemptAt: message.nextAttemptAt?.toISOString() ?? null,
    status: message.status,
    cancelIfContactReplies: message.cancelIfContactReplies,
    cancelIfNotOpen: message.cancelIfNotOpen,
    createdBy: { id: message.createdById, name: message.createdByName },
    updatedBy: { id: message.updatedById, name: message.updatedByName },
    attempts: message.attempts,
    lastError: message.lastError,
    version: message.version,
    createdAt: message.createdAt.toISOString(),
    updatedAt: message.updatedAt.toISOString(),
  };
}
