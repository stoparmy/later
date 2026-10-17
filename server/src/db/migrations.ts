export const migrations = [
  {
    id: "001_scheduled_messages",
    sql: `
      CREATE TABLE scheduled_messages (
        id uuid PRIMARY KEY,
        account_id bigint NOT NULL,
        conversation_id bigint NOT NULL,
        inbox_id bigint NOT NULL,
        content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 150000),
        scheduled_at timestamptz NOT NULL,
        next_attempt_at timestamptz,
        status text NOT NULL CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
        cancel_if_contact_replies boolean NOT NULL DEFAULT false,
        cancel_if_not_open boolean NOT NULL DEFAULT false,
        baseline_message_id bigint,
        created_by_id bigint NOT NULL,
        created_by_name text NOT NULL,
        updated_by_id bigint NOT NULL,
        updated_by_name text NOT NULL,
        attempts integer NOT NULL DEFAULT 0,
        last_error text,
        locked_at timestamptz,
        locked_by text,
        chatwoot_message_id bigint,
        cancellation_reason text,
        version integer NOT NULL DEFAULT 1,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX scheduled_messages_due_idx
        ON scheduled_messages (COALESCE(next_attempt_at, scheduled_at)) WHERE status = 'pending';
      CREATE INDEX scheduled_messages_conversation_idx
        ON scheduled_messages (account_id, conversation_id, status, scheduled_at);
    `,
  },
];
