import type { Editor } from "@/types/messages";
import { defaultDate, localInput } from "./dates";

export function emptyEditor(): Editor {
  return {
    messageId: null,
    version: null,
    content: "",
    scheduledLocal: localInput(defaultDate()),
    cancelIfContactReplies: true,
    cancelIfNotOpen: true,
  };
}
