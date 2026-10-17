import assert from "node:assert/strict";
import test from "node:test";
import { HttpError } from "../errors";
import { parseMessageInput, retryDelayMs } from "./validation";

const now = new Date("2026-08-20T12:00:00.000Z");

test("parseMessageInput accepts text, a future UTC instant, and cancellation guards", () => {
  const parsed = parseMessageInput({
    content: "Follow up tomorrow",
    scheduledAt: "2026-08-21T12:00:00.000Z",
    cancelIfContactReplies: true,
    cancelIfNotOpen: true,
  }, now);
  assert.equal(parsed.content, "Follow up tomorrow");
  assert.equal(parsed.scheduledAt.toISOString(), "2026-08-21T12:00:00.000Z");
  assert.equal(parsed.cancelIfContactReplies, true);
  assert.equal(parsed.cancelIfNotOpen, true);
});

test("parseMessageInput rejects blank content and past schedules", () => {
  assert.throws(() => parseMessageInput({
    content: "  ", scheduledAt: "2026-08-21T12:00:00.000Z",
    cancelIfContactReplies: false, cancelIfNotOpen: false,
  }, now), (error) => error instanceof HttpError && error.code === "content_required");
  assert.throws(() => parseMessageInput({
    content: "hello", scheduledAt: "2026-08-20T11:59:59.000Z",
    cancelIfContactReplies: false, cancelIfNotOpen: false,
  }, now), (error) => error instanceof HttpError && error.code === "scheduled_at_must_be_future");
});

test("retryDelayMs uses bounded exponential backoff", () => {
  assert.equal(retryDelayMs(1), 15_000);
  assert.equal(retryDelayMs(2), 30_000);
  assert.equal(retryDelayMs(20), 3_600_000);
});
