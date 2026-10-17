import { randomUUID } from "node:crypto";
import type { PoolClient, QueryResultRow } from "pg";
import { pool } from "../db/pool";
import { HttpError } from "../errors";
import type { DashboardActor, ScheduledMessage } from "../types";
import type { MessageInput } from "./validation";

export async function listVisibleMessages(accountId: number, conversationId: number) {
  const result = await pool.query(
    `SELECT * FROM scheduled_messages
     WHERE account_id = $1 AND conversation_id = $2 AND status IN ('pending', 'failed')
     ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, scheduled_at ASC`,
    [accountId, conversationId],
  );
  return result.rows.map(fromRow);
}

export async function createScheduledMessage(input: MessageInput & {
  accountId: number;
  conversationId: number;
  inboxId: number;
  baselineMessageId: number | null;
  actor: DashboardActor;
}) {
  const id = randomUUID();
  const result = await pool.query(
    `INSERT INTO scheduled_messages (
       id, account_id, conversation_id, inbox_id, content, scheduled_at, status,
       cancel_if_contact_replies, cancel_if_not_open, baseline_message_id,
       created_by_id, created_by_name, updated_by_id, updated_by_name
     ) VALUES ($1,$2,$3,$4,$5,$6,'pending',$7,$8,$9,$10,$11,$10,$11)
     RETURNING *`,
    [id, input.accountId, input.conversationId, input.inboxId, input.content, input.scheduledAt,
      input.cancelIfContactReplies, input.cancelIfNotOpen, input.baselineMessageId, input.actor.id, input.actor.name],
  );
  return fromRow(result.rows[0]);
}

export async function updateScheduledMessage(input: MessageInput & {
  id: string;
  accountId: number;
  conversationId: number;
  version: number;
  baselineMessageId: number | null;
  actor: DashboardActor;
}) {
  const result = await pool.query(
    `UPDATE scheduled_messages SET
       content=$1, scheduled_at=$2, next_attempt_at=NULL, status='pending',
       cancel_if_contact_replies=$3, cancel_if_not_open=$4, baseline_message_id=$5,
       updated_by_id=$6, updated_by_name=$7, attempts=0, last_error=NULL,
       version=version+1, updated_at=now()
     WHERE id=$8 AND account_id=$9 AND conversation_id=$10
       AND version=$11 AND status IN ('pending','failed')
     RETURNING *`,
    [input.content, input.scheduledAt, input.cancelIfContactReplies, input.cancelIfNotOpen,
      input.baselineMessageId, input.actor.id, input.actor.name, input.id, input.accountId,
      input.conversationId, input.version],
  );
  if (!result.rowCount) throw new HttpError(409, "scheduled_message_changed");
  return fromRow(result.rows[0]);
}

export async function cancelScheduledMessage(input: {
  id: string;
  accountId: number;
  conversationId: number;
  version: number;
  actor: DashboardActor;
}) {
  const result = await pool.query(
    `UPDATE scheduled_messages SET status='cancelled', cancellation_reason='agent_deleted',
       updated_by_id=$1, updated_by_name=$2, version=version+1, updated_at=now()
     WHERE id=$3 AND account_id=$4 AND conversation_id=$5 AND version=$6
       AND status IN ('pending','failed') RETURNING id`,
    [input.actor.id, input.actor.name, input.id, input.accountId, input.conversationId, input.version],
  );
  if (!result.rowCount) throw new HttpError(409, "scheduled_message_changed");
}

export async function reclaimAndClaim(workerId: string, leaseMs: number) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE scheduled_messages SET status='pending', locked_at=NULL, locked_by=NULL
       WHERE status='processing' AND locked_at < now() - ($1 * interval '1 millisecond')`,
      [leaseMs],
    );
    const result = await client.query(
      `WITH candidate AS (
         SELECT id FROM scheduled_messages
         WHERE status='pending' AND COALESCE(next_attempt_at, scheduled_at) <= now()
         ORDER BY COALESCE(next_attempt_at, scheduled_at), created_at
         FOR UPDATE SKIP LOCKED LIMIT 1
       )
       UPDATE scheduled_messages m SET status='processing', locked_at=now(), locked_by=$1,
         attempts=attempts+1, updated_at=now()
       FROM candidate WHERE m.id=candidate.id RETURNING m.*`,
      [workerId],
    );
    await client.query("COMMIT");
    return result.rowCount ? fromRow(result.rows[0]) : null;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function markSent(id: string, chatwootMessageId: number, lockedBy: string | null) {
  await finalize(id, "sent", lockedBy, { chatwootMessageId });
}

export async function markCancelled(id: string, reason: string, lockedBy: string | null) {
  await finalize(id, "cancelled", lockedBy, { reason });
}

export async function markFailure(id: string, error: string, retryAt: Date | null, lockedBy: string | null) {
  const status = retryAt ? "pending" : "failed";
  await pool.query(
    `UPDATE scheduled_messages SET status=$2, last_error=$3, next_attempt_at=$4,
       locked_at=NULL, locked_by=NULL, version=version+1, updated_at=now()
     WHERE id=$1 AND status='processing' AND locked_by IS NOT DISTINCT FROM $5`,
    [id, status, error.slice(0, 2000), retryAt, lockedBy],
  );
}

async function finalize(id: string, status: "sent" | "cancelled", lockedBy: string | null, extra: { chatwootMessageId?: number; reason?: string }) {
  await pool.query(
    `UPDATE scheduled_messages SET status=$2, chatwoot_message_id=$3, cancellation_reason=$4,
       last_error=NULL, next_attempt_at=NULL, locked_at=NULL, locked_by=NULL,
       version=version+1, updated_at=now()
     WHERE id=$1 AND status='processing' AND locked_by IS NOT DISTINCT FROM $5`,
    [id, status, extra.chatwootMessageId ?? null, extra.reason ?? null, lockedBy],
  );
}

function fromRow(row: QueryResultRow): ScheduledMessage {
  return {
    id: row.id,
    accountId: Number(row.account_id),
    conversationId: Number(row.conversation_id),
    inboxId: Number(row.inbox_id),
    content: row.content,
    scheduledAt: new Date(row.scheduled_at),
    nextAttemptAt: row.next_attempt_at ? new Date(row.next_attempt_at) : null,
    status: row.status,
    cancelIfContactReplies: row.cancel_if_contact_replies,
    cancelIfNotOpen: row.cancel_if_not_open,
    baselineMessageId: row.baseline_message_id ? Number(row.baseline_message_id) : null,
    createdById: Number(row.created_by_id),
    createdByName: row.created_by_name,
    updatedById: Number(row.updated_by_id),
    updatedByName: row.updated_by_name,
    attempts: row.attempts,
    lastError: row.last_error,
    lockedBy: row.locked_by,
    version: row.version,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}
