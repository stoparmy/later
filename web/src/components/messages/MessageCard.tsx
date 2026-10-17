import { Clock3, TriangleAlert } from "lucide-react";
import { CardContent, CardHeader } from "@/components/ui/card";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { ScheduledMessage } from "@/types/messages";
import { formatDate } from "@/utils/dates";
import { deliveryErrorText } from "@/utils/errors";
import { MetadataIcon } from "./MetadataIcon";

export function MessageCard({
  message,
  onEdit,
}: {
  message: ScheduledMessage;
  onEdit: (message: ScheduledMessage) => void;
}) {
  const effectiveTime = message.nextAttemptAt || message.scheduledAt;
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Редактировать сообщение: ${message.content}`}
      onClick={() => onEdit(message)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onEdit(message);
        }
      }}
      className="cursor-pointer transition-colors hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
    >
      <CardHeader className="pt-3 pb-1">
        <div className="flex min-w-0 flex-1 items-center gap-3 leading-5">
          <p
            className={`min-w-0 flex-1 truncate text-sm font-medium ${message.status === "failed" ? "text-destructive" : ""}`}
          >
            {message.content}
          </p>
          <TooltipProvider delayDuration={200}>
            <div className="flex h-5 shrink-0 items-center gap-3 text-muted-foreground">
              {message.status !== "failed" && (
                <MetadataIcon
                  text={[
                    "Запланировано.",
                    message.cancelIfContactReplies
                      ? "Только если собеседник не ответит."
                      : "",
                    message.cancelIfNotOpen
                      ? "Только когда диалог открыт."
                      : "",
                  ]
                    .filter(Boolean)
                    .join("\n")}
                >
                  <Clock3 className="h-4 w-4" />
                </MetadataIcon>
              )}
              {message.lastError && (
                <MetadataIcon
                  text={`Ошибка: ${deliveryErrorText(message.lastError)}`}
                >
                  <TriangleAlert className="h-4 w-4 text-destructive" />
                </MetadataIcon>
              )}
            </div>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent
        className={`pb-3 text-sm ${message.status === "failed" ? "text-destructive" : "text-muted-foreground"}`}
      >
        <div className="flex items-center gap-2 leading-5">
          <time dateTime={effectiveTime} className="shrink-0">
            {formatDate(effectiveTime)}
          </time>
          <span aria-hidden="true">&bull;</span>
          <span className="min-w-0 truncate">
            {message.createdBy.name}
            {message.updatedBy.id !== message.createdBy.id
              ? `, ${message.updatedBy.name}`
              : ""}
          </span>
        </div>
      </CardContent>
    </div>
  );
}
