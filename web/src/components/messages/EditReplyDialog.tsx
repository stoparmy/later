import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { Editor } from "@/types/messages";
import { ReplyForm } from "./ReplyForm";

type Props = {
  editor: Editor | null;
  setEditor: (editor: Editor | null) => void;
  error: string | null;
  saving: boolean;
  disabled: boolean;
  onSubmit: (event: React.FormEvent, editor: Editor) => void;
  onDelete: () => void;
};

export function EditReplyDialog({
  editor,
  setEditor,
  error,
  saving,
  disabled,
  onSubmit,
  onDelete,
}: Props) {
  return (
    <Dialog
      open={editor !== null}
      onOpenChange={(open) => {
        if (!open && !saving) setEditor(null);
      }}
    >
      <DialogContent aria-describedby={undefined}>
        <div className="space-y-1.5 pr-6">
          <DialogTitle className="text-base font-medium">
            Редактирование
          </DialogTitle>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {editor && (
          <ReplyForm
            editor={editor}
            setEditor={setEditor}
            saving={saving}
            disabled={disabled}
            onSubmit={(event) => onSubmit(event, editor)}
            onCancel={() => setEditor(null)}
            onDelete={onDelete}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
