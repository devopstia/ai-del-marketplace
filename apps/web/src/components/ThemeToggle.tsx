"use client";
import { Moon, Sun } from "lucide-react";

// Dark is the default for every visitor (owner, 2026-11-25); a saved choice of light from the toggle wins.
// Dark is the default for every visitor (owner, 2026-11-25). Choices saved before dark became the default ("del-theme")
// are dropped; only a choice made with the toggle since then ("del-theme-v2") is kept.
export const THEME_KEY = "del-theme-v2";
export const themeScript = `(function(){var d=document.documentElement;try{localStorage.removeItem('del-theme');if(localStorage.getItem('${THEME_KEY}')==='light'){d.classList.remove('dark');d.classList.add('light');return}}catch(e){}d.classList.remove('light');d.classList.add('dark')})();`;

export function ThemeToggle({ className = "" }: { className?: string }) {
  function toggle() {
    const d = document.documentElement;
    const isDark = d.classList.contains("dark") || (!d.classList.contains("light") && matchMedia("(prefers-color-scheme: dark)").matches);
    d.classList.remove("dark", "light");
    d.classList.add(isDark ? "light" : "dark");
    try {
      localStorage.setItem(THEME_KEY, isDark ? "light" : "dark");
    } catch {
      /* storage blocked: theme still switches for this page */
    }
  }
  return (
    <button type="button" onClick={toggle} className={`btn btn-ghost btn-sm !px-2.5 ${className}`} aria-label="Switch light or dark theme" title="Switch theme">
      <Sun className="size-[18px] dark:hidden" />
      <Moon className="hidden size-[18px] dark:block" />
    </button>
  );
}
