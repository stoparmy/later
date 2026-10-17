import assert from "node:assert/strict";
import test from "node:test";
import { HttpError } from "../errors";
import type { ScheduledMessage } from "../types";

process.env.CHATWOOT_BASE_URL = "https://helpdesk.example.org";
process.env.CHATWOOT_APP_TOKEN = "test-token";
process.env.DATABASE_URL = "postgresql://later:later@127.0.0.1:1/later";

const { processMessage } = require("./processor") as typeof import("./processor");

function message(overrides: Partial<ScheduledMessage> = {}): ScheduledMessage {
  return {
    id: "11111111-1111-4111-8111-111111111111", accountId: 1, conversationId: 2, inboxId: 3,
    content: "hello", scheduledAt: new Date(), nextAttemptAt: null, status: "processing",
    cancelIfContactReplies: false, cancelIfNotOpen: false, baselineMessageId: 10,
    createdById: 1, createdByName: "Agent", updatedById: 1, updatedByName: "Agent",
    attempts: 1, lastError: null, lockedBy: "worker-1", version: 1, createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  };
}

function harness(inspection: { status: string | null; contactReplied: boolean; existingChatwootMessageId: number | null }) {
  const events: string[] = [];
  return {
    events,
    dependencies: {
      inspect: async () => inspection,
      send: async () => { events.push("send"); return 99; },
      sent: async (_id: string, chatwootId: number) => { events.push(`sent:${chatwootId}`); },
      cancelled: async (_id: string, reason: string) => { events.push(`cancelled:${reason}`); },
      failed: async (_id: string, error: string, retryAt: Date | null) => { events.push(`failed:${error}:${retryAt?.toISOString() || "final"}`); },
      now: () => Date.parse("2026-08-20T12:00:00.000Z"),
    },
  };
}

test("processor recognizes an already-created Chatwoot message", async () => {
  const run = harness({ status: "open", contactReplied: false, existingChatwootMessageId: 88 });
  await processMessage(message(), 5, run.dependencies);
  assert.deepEqual(run.events, ["sent:88"]);
});

test("processor applies not-open guard before the contact-reply guard", async () => {
  const run = harness({ status: "resolved", contactReplied: true, existingChatwootMessageId: null });
  await processMessage(message({ cancelIfNotOpen: true, cancelIfContactReplies: true }), 5, run.dependencies);
  assert.deepEqual(run.events, ["cancelled:conversation_not_open:resolved"]);
});

test("processor cancels after a contact reply when selected", async () => {
  const run = harness({ status: "open", contactReplied: true, existingChatwootMessageId: null });
  await processMessage(message({ cancelIfContactReplies: true }), 5, run.dependencies);
  assert.deepEqual(run.events, ["cancelled:contact_replied"]);
});

test("processor sends when guards allow delivery", async () => {
  const run = harness({ status: "open", contactReplied: false, existingChatwootMessageId: null });
  await processMessage(message(), 5, run.dependencies);
  assert.deepEqual(run.events, ["send", "sent:99"]);
});

test("processor schedules transient failures with exponential backoff", async () => {
  const run = harness({ status: "open", contactReplied: false, existingChatwootMessageId: null });
  run.dependencies.send = async () => { throw new HttpError(503, "chatwoot_request_failed"); };
  await processMessage(message({ attempts: 2 }), 5, run.dependencies);
  assert.deepEqual(run.events, ["failed:chatwoot_request_failed: chatwoot_request_failed:2026-08-20T12:00:30.000Z"]);
});

test("processor leaves permanent failures for agent action", async () => {
  const run = harness({ status: "open", contactReplied: false, existingChatwootMessageId: null });
  run.dependencies.send = async () => { throw new HttpError(403, "chatwoot_request_failed"); };
  await processMessage(message(), 5, run.dependencies);
  assert.deepEqual(run.events, ["failed:chatwoot_request_failed: chatwoot_request_failed:final"]);
});
