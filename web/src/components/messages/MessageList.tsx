import type { ScheduledMessage } from "@/types/messages";
import { MessageCard } from "./MessageCard";

export function MessageList({
  messages,
  onEdit,
}: {
  messages: ScheduledMessage[];
  onEdit: (message: ScheduledMessage) => void;
}) {
  if (messages.length === 0) return null;
  return (
    <section aria-label="Отложенные сообщения" className="divide-y">
      {messages.map((message) => (
        <MessageCard key={message.id} message={message} onEdit={onEdit} />
      ))}
    </section>
  );
}
