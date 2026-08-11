"use client";

import { useLayoutEffect } from "react";

const BASE_FONT_SIZE = 16;

function fitViewport(width: number, height: number, designWidth: number, designHeight: number) {
  return width / height > designWidth / designHeight ? height / designHeight : width / designWidth;
}

export function ViewportScale() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const previousFontSize = root.style.fontSize;
    const previousVhOffset = root.style.getPropertyValue("--vh-offset");
    const previousVh = root.style.getPropertyValue("--vh");

    const apply = () => {
      const { innerWidth: width, innerHeight: height } = window;
      const scale = height >= width
        ? fitViewport(width, height, 1080, 1920)
        : fitViewport(width, height, 2560, 1440);
      root.style.fontSize = `${BASE_FONT_SIZE * scale}px`;
      root.style.setProperty("--vh-offset", "0px");
      root.style.setProperty("--vh", `${height / 100}px`);
    };

    apply();
    window.addEventListener("resize", apply, { passive: true });
    window.addEventListener("orientationchange", apply, { passive: true });
    return () => {
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
      root.style.fontSize = previousFontSize;
      if (previousVhOffset) root.style.setProperty("--vh-offset", previousVhOffset);
      else root.style.removeProperty("--vh-offset");
      if (previousVh) root.style.setProperty("--vh", previousVh);
      else root.style.removeProperty("--vh");
    };
  }, []);

  return null;
}
