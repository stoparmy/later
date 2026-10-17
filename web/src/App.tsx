import { useEffect, useState } from "react";
import { ScheduledReplies } from "./components/messages/ScheduledReplies";
import { getEmbeddedTheme, subscribeToEmbeddedTheme } from "./lib/chatwoot";

type Theme = "light" | "dark";

export function App() {
  const [systemTheme, setSystemTheme] = useState<Theme>(() => getSystemTheme());
  const [embeddedTheme, setEmbeddedTheme] = useState<Theme | null>(() =>
    getEmbeddedTheme(),
  );
  const theme = embeddedTheme ?? systemTheme;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    return () => document.documentElement.classList.remove("dark");
  }, [theme]);

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const change = (event: MediaQueryListEvent) =>
      setSystemTheme(event.matches ? "dark" : "light");
    setSystemTheme(query.matches ? "dark" : "light");
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);

  useEffect(() => subscribeToEmbeddedTheme(setEmbeddedTheme), []);
  return <ScheduledReplies />;
}

function getSystemTheme(): Theme {
  return typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}
