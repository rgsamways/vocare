import { useState } from "react";
import { applyTheme, getStoredTheme, type Theme } from "../lib/theme";

function LightbulbIcon({ on }: { on: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M9 18h6" />
      <path d="M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.5 10.9c.4.3.5.8.5 1.3V16h6v-.8c0-.5.1-1 .5-1.3A6 6 0 0 0 12 3Z" />
      {on && (
        <g>
          <path d="M12 1v1" />
          <path d="M4 12H3" />
          <path d="M21 12h-1" />
          <path d="M5.6 5.6l.7.7" />
          <path d="M17.7 6.3l.7-.7" />
        </g>
      )}
    </svg>
  );
}

/**
 * Shared by AppShell (signed-in, adds tabs) and the sign-up/sign-in screen
 * (signed-out, no tabs) — the brand mark, wordmark, and theme toggle don't
 * depend on auth state, so they don't belong duplicated in both places.
 */
export function AppHeader() {
  const [theme, setTheme] = useState<Theme>(getStoredTheme());

  function toggleTheme() {
    const next: Theme = theme === "light" ? "dark" : "light";
    applyTheme(next);
    setTheme(next);
  }

  return (
    <header className="appbar">
      <div className="brand-lockup">
        {/* Placeholder mark — two Lucide chevron-rights (chevron-right's own
            path, twice, at different sizes/offsets/opacity) standing in for
            the arc logo pending a redesign. Bold chevron points at the
            wordmark; smaller, fainter one trails behind as an echo. */}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3f5d54" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 7l6 5-6 5" strokeWidth="2" opacity="0.5" />
          <path d="M11 6l7 6-7 6" strokeWidth="2.5" />
        </svg>
        <span className="wordmark">vocare</span>
      </div>
      <button
        className="theme-toggle"
        type="button"
        onClick={toggleTheme}
        aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
      >
        <LightbulbIcon on={theme === "light"} />
      </button>
    </header>
  );
}
