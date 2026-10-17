import { useEffect, useRef, useState } from "react";
import { ApiError, apiFetch, embeddedApiBase, queryUrl } from "@/lib/api";
import {
  getChatwootAuthHeaders,
  subscribeToDashboardContext,
} from "@/lib/chatwoot";
import type {
  DashboardContext,
  ScheduledMessage,
  Editor,
} from "@/types/messages";
import { defaultDate, localInput } from "@/utils/dates";
import { emptyEditor } from "@/utils/editor";
import { errorText } from "@/utils/errors";

export function useScheduledMessages() {
  const generation = useRef(0);
  const loadSequence = useRef(0);
  const sessionKey = useRef("");
  const currentContext = useRef<DashboardContext | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [context, setContext] = useState<DashboardContext | null>(null);
  const [messages, setMessages] = useState<ScheduledMessage[]>([]);
  const [editor, setEditor] = useState<Editor>(() => emptyEditor());
  const [editEditor, setEditEditor] = useState<Editor | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ScheduledMessage | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function clearPrivateState() {
    generation.current += 1;
    setAuthorized(false);
    setMessages([]);
    setEditor(emptyEditor());
    setEditEditor(null);
    setDeleteTarget(null);
    setEditError(null);
    setError(null);
    setSaving(false);
    setDeleting(false);
    setLoading(false);
  }

  function freshAuth() {
    const auth = getChatwootAuthHeaders();
    const key = auth ? `${auth.uid}:${auth.client}` : "";
    if (key !== sessionKey.current) {
      clearPrivateState();
      sessionKey.current = key;
    }
    if (!auth) {
      clearPrivateState();
      setError(
        "Не удалось получить сессию Chatwoot. Откройте приложение из панели диалога в Chatwoot.",
      );
    }
    return auth;
  }

  function handleFailure(cause: unknown, epoch: number, editing = false) {
    if (!isCurrent(epoch)) return;
    if (
      cause instanceof ApiError &&
      (cause.status === 401 || cause.status === 403)
    ) {
      clearPrivateState();
      setError(errorText(cause));
    } else if (editing) setEditError(errorText(cause));
    else setError(errorText(cause));
  }

  function isCurrent(epoch: number) {
    if (epoch !== generation.current) return false;
    const auth = getChatwootAuthHeaders();
    if ((auth ? `${auth.uid}:${auth.client}` : "") !== sessionKey.current)
      freshAuth();
    return epoch === generation.current;
  }

  useEffect(() => {
    return subscribeToDashboardContext((next) => {
      const previous = currentContext.current;
      if (
        previous?.accountId === next.accountId &&
        previous?.conversationId === next.conversationId &&
        previous?.inboxId === next.inboxId
      )
        return;
      clearPrivateState();
      currentContext.current = next;
      setContext(next);
    });
  }, []);

  useEffect(() => {
    const revalidate = () => {
      if (document.visibilityState === "hidden") {
        clearPrivateState();
        return;
      }
      void loadMessages(false);
    };
    const restore = () => {
      clearPrivateState();
      revalidate();
    };
    window.addEventListener("focus", restore);
    window.addEventListener("pageshow", restore);
    window.addEventListener("pagehide", clearPrivateState);
    document.addEventListener("visibilitychange", restore);
    const timer = window.setInterval(revalidate, 10_000);
    return () => {
      generation.current += 1;
      window.clearInterval(timer);
      window.removeEventListener("focus", restore);
      window.removeEventListener("pageshow", restore);
      window.removeEventListener("pagehide", clearPrivateState);
      document.removeEventListener("visibilitychange", restore);
    };
  }, []);

  useEffect(() => {
    void loadMessages(true);
  }, [context]);

  async function loadMessages(showLoading: boolean) {
    const auth = freshAuth();
    const scope = currentContext.current;
    if (!auth || !scope) {
      setLoading(false);
      return;
    }
    const epoch = generation.current;
    const sequence = ++loadSequence.current;
    if (showLoading) setLoading(true);
    try {
      const payload = await apiFetch<{ messages: ScheduledMessage[] }>(
        scopedUrl("/scheduled-messages", scope),
        {},
        auth,
      );
      if (!isCurrent(epoch) || sequence !== loadSequence.current) return;
      setMessages(payload.messages);
      setAuthorized(true);
      setError(null);
    } catch (cause) {
      handleFailure(cause, epoch);
    } finally {
      if (epoch === generation.current && sequence === loadSequence.current)
        setLoading(false);
    }
  }

  async function save(event: React.FormEvent, draft: Editor) {
    event.preventDefault();
    const previousEpoch = generation.current;
    const auth = freshAuth();
    if (
      !context ||
      !auth ||
      !authorized ||
      previousEpoch !== generation.current
    )
      return;
    const epoch = generation.current;
    setSaving(true);
    try {
      const body = JSON.stringify({
        content: draft.content,
        scheduledAt: new Date(draft.scheduledLocal).toISOString(),
        cancelIfContactReplies: draft.cancelIfContactReplies,
        cancelIfNotOpen: draft.cancelIfNotOpen,
        ...(draft.version ? { version: draft.version } : {}),
      });
      const path = draft.messageId
        ? `/scheduled-messages/${draft.messageId}`
        : "/scheduled-messages";
      await apiFetch(
        scopedUrl(path),
        { method: draft.messageId ? "PUT" : "POST", body },
        auth,
      );
      if (!isCurrent(epoch)) return;
      if (draft.messageId) setEditEditor(null);
      else setEditor(emptyEditor());
      await loadMessages(false);
    } catch (cause) {
      handleFailure(cause, epoch, !!draft.messageId);
    } finally {
      if (epoch === generation.current) setSaving(false);
    }
  }

  async function remove(message: ScheduledMessage) {
    const previousEpoch = generation.current;
    const auth = freshAuth();
    if (!auth || !authorized || previousEpoch !== generation.current) return;
    const epoch = generation.current;
    setDeleting(true);
    try {
      await apiFetch(
        `${scopedUrl(`/scheduled-messages/${message.id}`)}&version=${message.version}`,
        { method: "DELETE" },
        auth,
      );
      if (!isCurrent(epoch)) return;
      if (editEditor?.messageId === message.id) setEditEditor(null);
      setDeleteTarget(null);
      await loadMessages(false);
    } catch (cause) {
      handleFailure(cause, epoch);
    } finally {
      if (epoch === generation.current) setDeleting(false);
    }
  }

  function edit(message: ScheduledMessage) {
    const scheduled = new Date(message.scheduledAt);
    setEditError(null);
    setEditEditor({
      messageId: message.id,
      version: message.version,
      content: message.content,
      scheduledLocal: localInput(
        scheduled.getTime() > Date.now() ? scheduled : defaultDate(),
      ),
      cancelIfContactReplies: message.cancelIfContactReplies,
      cancelIfNotOpen: message.cancelIfNotOpen,
    });
  }

  function scopedUrl(path: string, scope = currentContext.current) {
    if (!scope) return "";
    return queryUrl(`${embeddedApiBase()}${path}`, {
      conversationId: scope.conversationId,
      inboxId: scope.inboxId,
    });
  }

  return {
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
  };
}
