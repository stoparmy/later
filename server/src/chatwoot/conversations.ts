import { appFetchJson, dashboardFetchJson } from "./client";
import { HttpError } from "../errors";
import type { DashboardAuthBundle } from "../types";

type MessageRecord = {
  id: number;
  messageType: number;
  private: boolean;
  contentAttributes: Record<string, unknown>;
};

export async function verifyConversationAccess(input: {
  accountId: number;
  conversationId: number;
  expectedInboxId: number;
  auth: DashboardAuthBundle;
}) {
  const conversation = await dashboardFetchJson(conversationPath(input.accountId, input.conversationId), input.auth);
  const record = asRecord(conversation);
  const inboxId = positiveInt(record?.inbox_id);
  if (!inboxId || inboxId !== input.expectedInboxId) throw new HttpError(403, "conversation_access_rejected");
}

export async function getBaselineMessageId(input: {
  accountId: number;
  conversationId: number;
  auth: DashboardAuthBundle;
}) {
  const response = await dashboardFetchJson(messagesPath(input.accountId, input.conversationId), input.auth);
  const messages = parseMessages(response);
  return messages.reduce<number | null>((max, message) => max === null || message.id > max ? message.id : max, null);
}

export async function inspectConversationAtSend(input: {
  accountId: number;
  conversationId: number;
  baselineMessageId: number | null;
  laterMessageId: string;
}) {
  const conversation = asRecord(await appFetchJson(conversationPath(input.accountId, input.conversationId)));
  const status = stringValue(conversation?.status);
  const messages = await getMessagesAfter(input.accountId, input.conversationId, input.baselineMessageId);
  const existingMessage = messages.find((message) => message.contentAttributes.later_message_id === input.laterMessageId);
  const contactReplied = messages.some((message) => message.messageType === 0 && !message.private);
  return { status, contactReplied, existingChatwootMessageId: existingMessage?.id ?? null };
}

export async function sendScheduledMessage(input: {
  id: string;
  accountId: number;
  conversationId: number;
  content: string;
}) {
  const payload = await appFetchJson(messagesPath(input.accountId, input.conversationId), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      content: input.content,
      message_type: "outgoing",
      private: false,
      content_type: "text",
      content_attributes: { later_message_id: input.id },
    }),
  });
  const id = positiveInt(asRecord(payload)?.id);
  if (!id) throw new HttpError(502, "chatwoot_invalid_message_response");
  return id;
}

async function getMessagesAfter(accountId: number, conversationId: number, baselineMessageId: number | null) {
  const all: MessageRecord[] = [];
  let after = baselineMessageId;
  for (let page = 0; page < 100; page += 1) {
    const query = after ? `?after=${after}` : "";
    const response = await appFetchJson(`${messagesPath(accountId, conversationId)}${query}`);
    const messages = parseMessages(response).filter((message) => after === null || message.id > after);
    if (!messages.length) break;
    all.push(...messages);
    const nextAfter = Math.max(...messages.map((message) => message.id));
    if (after !== null && nextAfter <= after) break;
    after = nextAfter;
    if (messages.length < 100) break;
  }
  return all;
}

function parseMessages(input: unknown): MessageRecord[] {
  const payload = asRecord(input)?.payload;
  if (!Array.isArray(payload)) return [];
  return payload.flatMap((item) => {
    const record = asRecord(item);
    const id = positiveInt(record?.id);
    const messageType = nonNegativeInt(record?.message_type);
    if (!id || messageType === null) return [];
    return [{
      id,
      messageType,
      private: record?.private === true,
      contentAttributes: asRecord(record?.content_attributes) || {},
    }];
  });
}

function conversationPath(accountId: number, conversationId: number) {
  return `/api/v1/accounts/${accountId}/conversations/${conversationId}`;
}
function messagesPath(accountId: number, conversationId: number) {
  return `${conversationPath(accountId, conversationId)}/messages`;
}
function asRecord(value: unknown) { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function stringValue(value: unknown) { return typeof value === "string" ? value : null; }
function positiveInt(value: unknown) { const parsed = Number(value); return Number.isInteger(parsed) && parsed > 0 ? parsed : null; }
function nonNegativeInt(value: unknown) { const parsed = Number(value); return Number.isInteger(parsed) && parsed >= 0 ? parsed : null; }
