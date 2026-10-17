import { ApiError } from "@/lib/api";

export function errorText(error: unknown) {
  if (!(error instanceof ApiError))
    return "Не удалось выполнить запрос. Попробуйте ещё раз.";
  const messages: Record<string, string> = {
    scheduled_at_must_be_future: "Выберите время отправки в будущем.",
    scheduled_message_changed:
      "Сообщение изменено в другой сессии. Обновите страницу и попробуйте снова.",
    conversation_access_rejected: "У вас больше нет доступа к этому диалогу.",
    chatwoot_auth_rejected: "Сессия Chatwoot истекла. Войдите снова.",
    content_required: "Напишите сообщение.",
    content_too_long: "Сообщение слишком длинное.",
    scheduled_at_invalid: "Проверьте дату и время отправки.",
    chatwoot_auth_missing: "Не удалось получить сессию Chatwoot.",
    chatwoot_request_failed:
      "Не удалось связаться с Chatwoot. Попробуйте ещё раз.",
    chatwoot_app_token_missing: "Не настроен токен интеграции Chatwoot.",
  };
  return messages[error.code] || `Не удалось выполнить запрос (${error.code}).`;
}

export function deliveryErrorText(value: string) {
  if (/401|auth_rejected|Invalid Access Token/i.test(value))
    return "Токен интеграции Chatwoot недействителен.";
  if (/403|access_rejected/i.test(value))
    return "У интеграции нет доступа к этому диалогу.";
  if (/404/i.test(value)) return "Диалог не найден.";
  if (/429/i.test(value)) return "Превышен лимит запросов Chatwoot.";
  if (/503|502|504|unavailable/i.test(value))
    return "Chatwoot временно недоступен. Попробуйте запланировать сообщение ещё раз.";
  if (/timeout|timed out|aborted/i.test(value))
    return "Chatwoot не ответил вовремя.";
  if (/app_token_missing/i.test(value))
    return "Не настроен токен интеграции Chatwoot.";
  return "Не удалось отправить сообщение. Попробуйте запланировать его ещё раз.";
}
