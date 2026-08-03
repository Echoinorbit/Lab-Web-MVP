"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/shared/components/ui/button";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const shouldUseDark = stored ? stored === "dark" : prefersDark;
    document.documentElement.classList.toggle("dark", shouldUseDark);
    setDark(shouldUseDark);
  }, []);

  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
    setDark(next);
  };

  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label={dark ? "切换到浅色主题" : "切换到深色主题"}>
      <span className="grid place-items-center" aria-hidden="true">
        <Sun
          className={`ui-icon-swap col-start-1 row-start-1 h-[18px] w-[18px] transition-[opacity,transform] duration-[var(--motion-fast)] ease-[var(--ease-out)] ${dark ? "scale-100 opacity-100" : "scale-90 opacity-0"}`}
        />
        <Moon
          className={`ui-icon-swap col-start-1 row-start-1 h-[18px] w-[18px] transition-[opacity,transform] duration-[var(--motion-fast)] ease-[var(--ease-out)] ${dark ? "scale-90 opacity-0" : "scale-100 opacity-100"}`}
        />
      </span>
    </Button>
  );
}
