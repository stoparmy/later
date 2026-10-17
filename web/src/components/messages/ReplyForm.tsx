import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { Editor } from "@/types/messages";
import { CancellationRule } from "./CancellationRule";

export function ReplyForm({
  editor,
  setEditor,
  saving,
  disabled,
  onSubmit,
  onCancel,
  onDelete,
}: {
  editor: Editor;
  setEditor: (editor: Editor) => void;
  saving: boolean;
  disabled: boolean;
  onSubmit: (event: React.FormEvent) => void;
  onCancel?: () => void;
  onDelete?: () => void;
}) {
  const prefix = editor.messageId ? "edit" : "reply";
  return (
    <form onSubmit={onSubmit}>
      <fieldset disabled={disabled || saving} className="m-0 grid min-w-0 gap-4 border-0 p-0">
        <div className="space-y-1.5">
          <label htmlFor={`${prefix}-content`} className="sr-only">
            Сообщение
          </label>
          <Textarea
            id={`${prefix}-content`}
            className="rounded-none border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
            required
            maxLength={150000}
            placeholder="Напишите сообщение…"
            value={editor.content}
            onChange={(event) =>
              setEditor({ ...editor, content: event.target.value })
            }
          />
        </div>
        <div className="grid gap-2 text-sm">
          <CancellationRule
            checked={editor.cancelIfContactReplies}
            onChange={(checked) =>
              setEditor({ ...editor, cancelIfContactReplies: checked })
            }
          >
            Только если собеседник не ответит
          </CancellationRule>
          <CancellationRule
            checked={editor.cancelIfNotOpen}
            onChange={(checked) =>
              setEditor({ ...editor, cancelIfNotOpen: checked })
            }
          >
            Только когда диалог открыт
          </CancellationRule>
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${prefix}-time`} className="sr-only">
            Время отправки
          </label>
          <div className="flex flex-wrap items-end gap-2">
            <DateTimePicker
              id={`${prefix}-time`}
              value={editor.scheduledLocal}
              onChange={(value) =>
                setEditor({ ...editor, scheduledLocal: value })
              }
            />
            {!editor.messageId && (
              <Button
                type="submit"
                className="ml-auto"
                disabled={disabled || saving}
              >
                Запланировать
                {saving ? (
                  <Spinner className="h-4 w-4" />
                ) : (
                  <ArrowUp className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </div>
        {editor.messageId && (
          <div className="flex flex-wrap justify-end gap-2">
            {onDelete && (
              <Button
                type="button"
                variant="outline"
                className="mr-auto text-destructive hover:text-destructive"
                disabled={saving}
                onClick={onDelete}
              >
                Удалить
              </Button>
            )}
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={onCancel}
              >
                Отмена
              </Button>
            )}
            <Button type="submit" disabled={disabled || saving}>
              {saving ? "Сохранение…" : "Сохранить"}
            </Button>
          </div>
        )}
      </fieldset>
    </form>
  );
}
