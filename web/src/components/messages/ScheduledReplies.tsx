import { AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useScheduledMessages } from "@/hooks/useScheduledMessages";
import { DeleteReplyDialog } from "./DeleteReplyDialog";
import { EditReplyDialog } from "./EditReplyDialog";
import { MessageList } from "./MessageList";
import { ReplyForm } from "./ReplyForm";

export function ScheduledReplies() {
  const {
    authorized,
    context,
    messages,
    editor,
    setEditor,
    editEditor,
    setEditEditor,
    editError,
    loading,
    saving,
    deleteTarget,
    setDeleteTarget,
    deleting,
    error,
    save,
    remove,
    edit,
  } = useScheduledMessages();
  const sortedMessages = [...messages].sort(
    (a, b) => Number(b.status === "failed") - Number(a.status === "failed"),
  );

  return (
    <main className="dashboard-shell">
      <div className="dashboard-flow">
        {error && (
          <div
            role="alert"
            className="flex gap-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <span>{error}</span>
          </div>
        )}
        <Card className="gap-0">
          <CardHeader className="pb-4">
            <div>
              <CardTitle>Отложенные сообщения</CardTitle>
            </div>
          </CardHeader>
          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : (
            <MessageList messages={sortedMessages} onEdit={edit} />
          )}
          <CardContent
            className={messages.length > 0 ? "border-t pt-4" : undefined}
          >
            <ReplyForm
              editor={editor}
              setEditor={setEditor}
              saving={saving}
              disabled={!context || !authorized}
              onSubmit={(event) => void save(event, editor)}
            />
          </CardContent>
        </Card>
      </div>
      <EditReplyDialog
        editor={editEditor}
        setEditor={setEditEditor}
        error={editError}
        saving={saving}
        disabled={!context}
        onSubmit={(event, draft) => void save(event, draft)}
        onDelete={() => {
          const message = messages.find(
            (item) => item.id === editEditor?.messageId,
          );
          if (message) setDeleteTarget(message);
        }}
      />
      <DeleteReplyDialog
        open={deleteTarget !== null}
        deleting={deleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) void remove(deleteTarget);
        }}
      />
    </main>
  );
}
