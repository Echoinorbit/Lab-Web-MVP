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

  it("keeps the navigation reveal state-driven and turns workbench navigation into scroll targets", () => {
    const navigation = source("src/shared/components/layout/endfield-navigation.tsx");
    assert.match(navigation, /onMouseEnter=\{\(\) => setDetailActive\(true\)\}/);
    assert.match(navigation, /onFocus=\{\(\) => setDetailActive\(true\)\}/);
    assert.match(navigation, /inert=\{!menuOpen\}/);
    assert.match(navigation, /menuBottomButtons/);
    assert.match(navigation, /window\.addEventListener\("scroll", onScroll/);
    assert.match(navigation, /`\/#\$\{key\}`/);
    assert.doesNotMatch(navigation, /buttonFrameBg/);
    assert.match(navigation, /workbenchHeader/);
    assert.match(navigation, /logoutForm/);
  });

  it("composes the common workbench areas into one scrollable document", () => {
    const dashboard = source("src/app/(dashboard)/page.tsx");
    for (const id of ["home", "projects", "progress", "posts", "announcements", "notifications", "profile"]) {
      assert.match(dashboard, new RegExp(`data-section="${id}"`));
    }
    assert.match(dashboard, /<ProjectsPage searchParams=\{Promise\.resolve\(\{\}\)\}/);
    assert.match(dashboard, /<ProgressPage searchParams=\{Promise\.resolve\(\{\}\)\}/);
  });

  it("keeps Endfield's fixed-canvas scaling out of the product workbench", () => {
    const rootLayout = source("src/app/layout.tsx");
    const previewLayout = source("src/app/%5Fendfield/layout.tsx");
    const viewportScale = source("src/shared/components/viewport-scale.tsx");
    assert.doesNotMatch(rootLayout, /ViewportScale/);
    assert.match(previewLayout, /<ViewportScale \/>/);
    assert.match(viewportScale, /root\.style\.fontSize = previousFontSize/);
  });

  it("uses Endfield's fixed-canvas hero treatment in the dashboard", () => {
    const dashboardHome = source("src/shared/components/endfield/dashboard-home.tsx");
    const dashboardHomeStyles = source("src/shared/components/endfield/dashboard-home.module.css");
    assert.doesNotMatch(dashboardHome, /HomeSection\/HomeSection\.module\.css/);
    assert.match(dashboardHomeStyles, /--hero-unit: min\(0\.625vw, 1\.111111vh\)/);
    assert.match(dashboardHomeStyles, /left: calc\(50% - 100em\)/);
    assert.match(dashboardHomeStyles, /@media \(orientation: portrait\)/);
  });

  it("keeps authentication screens responsive instead of positioning the form on a fixed reference canvas", () => {
    const authShellStyles = source("src/shared/components/layout/auth-shell.module.css");
    assert.match(authShellStyles, /grid-template-areas/);
    assert.match(authShellStyles, /@media \(max-width: 900px\)/);
    assert.doesNotMatch(authShellStyles, /left: calc\(50% - 100rem\)/);
  });

  it("uses one expandable panel instead of retaining unused sidebar chrome", () => {
    const headerStyles = source("src/shared/components/endfield/Header/Header.module.css");
    const viewerStyles = source("src/shared/components/endfield/SectionViewer/SectionViewer.module.css");
    const navigation = source("src/shared/components/layout/endfield-navigation.tsx");
    assert.match(headerStyles, /\.pcHeaderContainer\.detailActive \.navItem \.textWrapper/);
    assert.doesNotMatch(navigation, /buttonPreserveBg|ProjectOperatorBrowser/);
    assert.match(viewerStyles, /position: sticky/);
  });

  it("lets toasts exit before removal and keeps the project view timeline-based", () => {
    const toast = source("src/shared/components/ui/toast.tsx");
    const projects = source("src/features/projects/components/project-list.tsx");
    const calendar = source("src/features/projects/components/project-version-calendar.tsx");
    assert.match(toast, /setClosing\(true\)/);
    assert.match(toast, /window\.setTimeout\(\(\) => onDismiss\(item\.id\), 160\)/);
    assert.doesNotMatch(projects, /data-project-preview|canPreview/);
    assert.match(calendar, /aria-label=\{`\$\{project\.name\}：\$\{milestone\.title\}/);
  });
});
