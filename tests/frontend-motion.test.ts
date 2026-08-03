import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

function source(path: string) {
  return readFileSync(path, "utf8");
}

describe("frontend motion contracts", () => {
  it("uses interruptible state transitions instead of UI keyframes", () => {
    const css = source("src/app/globals.css");
    assert.doesNotMatch(css, /@keyframes ui-/);
    assert.doesNotMatch(css, /0\.001ms/);
    assert.match(css, /\.ui-overlay\[data-state="open"\]/);
    assert.match(css, /\.ui-popover\[data-state="open"\]/);
    assert.match(css, /\.ui-toast\[data-state="closed"\]/);
    assert.match(css, /prefers-reduced-motion: reduce/);
  });

  it("keeps shared press feedback subtle and reduced-motion safe", () => {
    const button = source("src/shared/components/ui/button.tsx");
    assert.match(button, /active:scale-\[0\.97\]/);
    assert.match(button, /motion-reduce:active:scale-100/);
    assert.match(button, /transition-\[transform,color,background-color,border-color,box-shadow\]/);
  });

  it("keeps reversible overlays mounted and state driven", () => {
    const mobileNav = source("src/shared/components/layout/mobile-nav.tsx");
    const userMenu = source("src/shared/components/layout/user-menu.tsx");
    const header = source("src/shared/components/layout/header.tsx");
    for (const component of [mobileNav, userMenu]) {
      assert.match(component, /data-state=\{open \? "open" : "closed"\}/);
      assert.match(component, /inert=\{!open\}/);
    }
    assert.doesNotMatch(header, /backdrop-blur/);
  });

  it("isolates translucent material from the viewport-fixed mobile drawer", () => {
    const css = source("src/app/globals.css");
    const header = source("src/shared/components/layout/header.tsx");
    assert.match(header, /ui-toolbar/);
    assert.match(css, /\.ui-toolbar::before/);
    assert.match(css, /pointer-events: none/);
    assert.match(css, /prefers-reduced-transparency: reduce/);
    assert.match(css, /prefers-contrast: more/);
  });

  it("uses circular transparent chrome around the circular avatar", () => {
    const userMenu = source("src/shared/components/layout/user-menu.tsx");
    assert.match(userMenu, /rounded-full bg-transparent/);
    assert.doesNotMatch(userMenu, /rounded-xl bg-primary text-sm font-semibold text-primary-foreground/);
  });

  it("lets toasts exit before removal and drops the hover-only project preview", () => {
    const toast = source("src/shared/components/ui/toast.tsx");
    const projects = source("src/features/projects/components/project-list.tsx");
    assert.match(toast, /setClosing\(true\)/);
    assert.match(toast, /window\.setTimeout\(\(\) => onDismiss\(item\.id\), 160\)/);
    assert.doesNotMatch(projects, /data-project-preview|canPreview/);
  });
});
