import type { DashboardContext } from "../types/messages";

const headerKeys = ["access-token", "token-type", "client", "expiry", "uid"] as const;
type RawRecord = Record<string, unknown>;
export type EmbeddedTheme = "light" | "dark";

export function getChatwootAuthHeaders() {
  const cookie = readCookie("cw_d_session_info");
  if (!cookie) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(cookie)) as Record<string, string>;
    const headers = Object.fromEntries(headerKeys.flatMap((key) => parsed[key] ? [[key, parsed[key]]] : []));
    return headerKeys.every((key) => headers[key]) ? headers : null;
  } catch { return null; }
}

export function subscribeToDashboardContext(onContext: (context: DashboardContext) => void) {
  const expectedOrigin = window.location.origin;
  const listener = (event: MessageEvent) => {
    if (event.source !== window.parent || event.origin !== expectedOrigin) return;
    const context = extractContext(event.data);
    if (context) onContext(context);
  };
  window.addEventListener("message", listener);
  window.parent?.postMessage("chatwoot-dashboard-app:fetch-info", expectedOrigin);
  return () => window.removeEventListener("message", listener);
}

export function getEmbeddedTheme(): EmbeddedTheme | null {
  const parent = parentDocument();
  return parent ? themeFrom(parent) : null;
}

export function subscribeToEmbeddedTheme(onTheme: (theme: EmbeddedTheme) => void) {
  const parent = parentDocument();
  if (!parent) return () => {};
  const emit = () => onTheme(themeFrom(parent));
  emit();
  const observer = new MutationObserver(emit);
  observer.observe(parent.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
  if (parent.body) observer.observe(parent.body, { attributes: true, attributeFilter: ["class", "data-theme"] });
  return () => observer.disconnect();
}

function extractContext(input: unknown): DashboardContext | null {
  const record = toRecord(parseJson(input)) || {};
  const data = toRecord(parseJson(record.data));
  const raw = toRecord(parseJson(record.appContext)) || toRecord(parseJson(data?.appContext)) || data || record;
  const conversation = toRecord(raw.conversation);
  const contact = toRecord(raw.contact) || toRecord(toRecord(conversation?.meta)?.sender) || toRecord(conversation?.contact);
  const accountId = positiveInt(conversation?.account_id ?? raw.account_id ?? raw.accountId);
  const inboxId = positiveInt(conversation?.inbox_id ?? raw.inbox_id ?? raw.inboxId);
  const conversationId = positiveInt(conversation?.id ?? raw.conversationId);
  const contactId = positiveInt(contact?.id ?? raw.contact_id ?? raw.contactId);
  if (!accountId || !inboxId || !conversationId || !contactId) return null;
  return {
    accountId, inboxId, conversationId, contactId,
    contactName: text(contact?.name) || text(contact?.identifier) || `#${contactId}`,
  };
}

function parentDocument() {
  if (window.parent === window) return null;
  try { return window.parent.document; } catch { return null; }
}
function themeFrom(doc: Document): EmbeddedTheme {
  return doc.documentElement.getAttribute("data-theme") === "dark" || doc.body?.getAttribute("data-theme") === "dark" ||
    doc.documentElement.classList.contains("dark") || doc.body?.classList.contains("dark") ? "dark" : "light";
}
function readCookie(name: string) {
  const match = document.cookie.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${name}=`));
  return match?.slice(name.length + 1) || null;
}
function parseJson(value: unknown) { if (typeof value !== "string") return value; try { return JSON.parse(value); } catch { return value; } }
function toRecord(value: unknown) { return value && typeof value === "object" && !Array.isArray(value) ? value as RawRecord : null; }
function positiveInt(value: unknown) { const number = Number(value); return Number.isInteger(number) && number > 0 ? number : null; }
function text(value: unknown) { return typeof value === "string" && value.trim() ? value.trim() : null; }
