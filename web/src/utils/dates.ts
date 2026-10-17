export function defaultDate() {
  const date = new Date(Date.now() + 60 * 60_000);
  date.setMinutes(Math.ceil(date.getMinutes() / 5) * 5, 0, 0);
  return date;
}
export function localInput(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
export function formatDate(value: string) {
  const date = new Date(value);
  const today = new Date();
  const sameYear = date.getFullYear() === today.getFullYear();
  const sameDay =
    sameYear &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
  return new Intl.DateTimeFormat("ru-RU", {
    ...(sameDay
      ? {}
      : {
          month: "short",
          day: "numeric",
          ...(sameYear ? {} : { year: "numeric" }),
        }),
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
