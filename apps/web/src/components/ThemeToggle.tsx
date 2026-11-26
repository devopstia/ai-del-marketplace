"use client";
import { Moon, Sun } from "lucide-react";

// Light is the default for every visitor (owner, 2026-11-25, replacing the earlier dark default); a theme chosen with
// the toggle ("del-theme-v2") is remembered and wins. The OS preference is not used: new visitors always see light.
export const THEME_KEY = "del-theme-v2";
export const themeScript = `(function(){var d=document.documentElement,t='light';try{localStorage.removeItem('del-theme');if(localStorage.getItem('${THEME_KEY}')==='dark')t='dark'}catch(e){}d.classList.remove(t==='dark'?'light':'dark');d.classList.add(t);var m=document.querySelector('meta[name=theme-color]');if(m)m.setAttribute('content',t==='dark'?'#0c0f22':'#f4f5fa')})();`;

export function ThemeToggle({ className = "" }: { className?: string }) {
  function toggle() {
    const d = document.documentElement;
    const isDark = d.classList.contains("dark");
    d.classList.remove("dark", "light");
    d.classList.add(isDark ? "light" : "dark");
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", isDark ? "#f4f5fa" : "#0c0f22");
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
