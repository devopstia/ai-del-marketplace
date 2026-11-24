"use client";
import { Moon, Sun } from "lucide-react";

export const themeScript = `(function(){try{var t=localStorage.getItem('del-theme');var d=document.documentElement;if(t==='dark'){d.classList.add('dark')}else if(t==='light'){d.classList.add('light')}}catch(e){}})();`;

export function ThemeToggle({ className = "" }: { className?: string }) {
  function toggle() {
    const d = document.documentElement;
    const isDark = d.classList.contains("dark") || (!d.classList.contains("light") && matchMedia("(prefers-color-scheme: dark)").matches);
    d.classList.remove("dark", "light");
    d.classList.add(isDark ? "light" : "dark");
    try {
      localStorage.setItem("del-theme", isDark ? "light" : "dark");
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
