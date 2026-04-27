import "./globals.css";

import type { ReactNode } from "react";
import { cookies } from "next/headers";
import Script from "next/script";

import { AppPreferencesProvider } from "@/components/app-preferences-provider";
import { APP_PREFERENCES_COOKIE, parseAppPreferences } from "@/lib/app-preferences-shared";

const STORAGE_KEY = "wevlo-app-preferences";

const themeBootScript = `
(() => {
  const cookieName = "${APP_PREFERENCES_COOKIE}";
  const storageKey = "${STORAGE_KEY}";

  const normalize = (input) => ({
    density: input?.density === "compact" ? "compact" : "comfortable",
    theme: input?.theme === "dark" || input?.theme === "light" || input?.theme === "system" ? input.theme : "system"
  });

  const readCookie = () => {
    const entry = document.cookie.split("; ").find((part) => part.startsWith(cookieName + "="));

    if (!entry) {
      return null;
    }

    try {
      return JSON.parse(decodeURIComponent(entry.split("=").slice(1).join("=")));
    } catch {
      return null;
    }
  };

  let preferences = null;

  try {
    const stored = window.localStorage.getItem(storageKey);
    preferences = stored ? JSON.parse(stored) : null;
  } catch {
    preferences = null;
  }

  const resolved = normalize(preferences ?? readCookie());
  const theme = resolved.theme === "system"
    ? (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")
    : resolved.theme;

  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.density = resolved.density;
  document.documentElement.style.colorScheme = theme;
})();
`;

export default async function RootLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const preferences = parseAppPreferences(cookieStore.get(APP_PREFERENCES_COOKIE)?.value);
  const initialTheme = preferences.theme === "dark" || preferences.theme === "light" ? preferences.theme : undefined;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-density={preferences.density}
      {...(initialTheme ? { "data-theme": initialTheme } : {})}
      style={{ colorScheme: initialTheme }}
    >
      <Script id="theme-boot" strategy="beforeInteractive">
        {themeBootScript}
      </Script>
      <body className="min-h-screen">
        <AppPreferencesProvider>{children}</AppPreferencesProvider>
      </body>
    </html>
  );
}
