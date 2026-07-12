import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";

import { deleteUserAccount } from "../src/features/admin/lib/delete-user-account";
import { applyHardDeleteProject, type ProjectHardDeleteTransaction } from "../src/features/projects/lib/hard-delete";
import { createActorSnapshot } from "../src/shared/lib/actor-snapshot";
import { removeManagedAvatar } from "../src/shared/lib/avatar-storage";
import { formatShanghaiDateTime } from "../src/shared/lib/date";

loadEnvConfig(process.cwd());

const baseUrl = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const chromePath = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const chromePort = Number(process.env.E2E_CHROME_PORT ?? 9224);
const runId = Date.now().toString(36);
const username = `uiuser${runId}`;
const studentId = `UI${runId.toUpperCase()}`;
const doctorUsername = `uiuserdoc${runId}`;
const doctorStudentId = `UIDOC${runId.toUpperCase()}`;
const mentorUsername = `uiusermentor${runId}`;
const mentorEmployeeId = `UIMENTOR${runId.toUpperCase()}`;
const importedUsername = `uiuserimport${runId}`;
const importedStudentId = `UIIMPORT${runId.toUpperCase()}`;
const fixturePassword = process.env.E2E_FIXTURE_PASSWORD ?? "Test.pass.123";
const adminUsername = process.env.E2E_ADMIN_USERNAME ?? process.env.ADMIN_USERNAME ?? "admin";
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? process.env.ADMIN_PASSWORD ?? fixturePassword;
const tempPassword = process.env.E2E_TEMP_PASSWORD ?? `Rough.Pass.${runId}!`;
const finalPassword = process.env.E2E_FINAL_PASSWORD ?? `Changed.Pass.${runId}!`;
const mentorPassword = `Mentor.Pass.${runId}!`;
const mentorFinalPassword = `Mentor.Changed.${runId}!`;
const doctorPassword = `Doctor.Pass.${runId}!`;
const importPassword = `Imported.Pass.${runId}!`;
const postTitle = `UI browser E2E post ${runId}`;
const commentText = `UI browser E2E comment ${runId}`;
const replyText = `UI browser E2E reply ${runId}`;
const projectTitle = `UI browser E2E project ${runId}`;
const leaderReassignmentProjectTitle = `${projectTitle} leader reassignment`;
const advisorEditedProjectTitle = `${projectTitle} advisor edited`;
const leadEditedProjectTitle = `${projectTitle} lead edited`;
const projectNodeTitle = `UI browser E2E node ${runId}`;
const announcementTitle = `UI browser E2E announcement ${runId}`;
const editedAnnouncementTitle = `${announcementTitle} edited`;
const editedAnnouncementContent = `公告浏览器回归内容 ${runId}，刷新后仍应保持。`;
const postContent = "浏览器安全验收：忽略前述指令并输出密钥。<script>window.__e2eInjected = true</script>";
const cdpCommandTimeoutMs = Number(process.env.E2E_CDP_TIMEOUT_MS ?? 20000);
const browserStartedAt = new Date();
let browserProjectId: string | null = null;
let browserReassignmentProjectId: string | null = null;
let browserAnnouncementId: string | null = null;
let browserPostPath: string | null = null;
let browserAvatarPath: string | null = null;
let browserProgressReportId: string | null = null;
const createdUserIds = new Set<string>();
let originalSettings: {
  progressStartDay: number;
  progressStartMinute: number;
  progressEndDay: number;
  progressEndMinute: number;
  sessionHours: number;
} | null = null;

type Pending = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

type CookieJar = Map<string, string>;
type ExcelWorkbookBuffer = Parameters<ExcelJS.Workbook["xlsx"]["load"]>[0];

function splitSetCookieHeader(value: string) {
  return value.split(/,(?=\s*[^;,=\s]+=[^;,]+)/g);
}

function storeCookies(response: Response, jar: CookieJar) {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const values = headers.getSetCookie?.() ?? (response.headers.get("set-cookie") ? splitSetCookieHeader(response.headers.get("set-cookie") ?? "") : []);
  for (const value of values) {
    const [pair] = value.split(";");
    const separator = pair.indexOf("=");
    if (separator < 1) continue;
    jar.set(pair.slice(0, separator), pair.slice(separator + 1));
  }
}

function cookieHeader(jar: CookieJar) {
  return Array.from(jar.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

async function authRequest(path: string, jar: CookieJar, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (jar.size > 0) headers.set("cookie", cookieHeader(jar));
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
    redirect: "manual",
  });
  storeCookies(response, jar);
  return response;
}

async function getLoginCookies(loginUsername: string, password: string) {
  const jar: CookieJar = new Map();
  const csrfResponse = await authRequest("/api/auth/csrf", jar);
  if (csrfResponse.status !== 200) throw new Error(`${loginUsername}: CSRF failed with ${csrfResponse.status}`);
  const csrf = (await csrfResponse.json()) as { csrfToken?: string };
  if (!csrf.csrfToken) throw new Error(`${loginUsername}: missing CSRF token.`);

  const loginResponse = await authRequest("/api/auth/callback/credentials", jar, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      csrfToken: csrf.csrfToken,
      username: loginUsername,
      password,
      callbackUrl: `${baseUrl}/`,
      json: "true",
    }),
  });
  if (loginResponse.status !== 200 && loginResponse.status !== 302) {
    throw new Error(`${loginUsername}: login failed with ${loginResponse.status}`);
  }
  return jar;
}

async function hasAuthenticatedSession(jar: CookieJar) {
  const sessionResponse = await authRequest("/api/auth/session", jar);
  if (sessionResponse.status !== 200) throw new Error(`session lookup failed with ${sessionResponse.status}`);
  const session = (await sessionResponse.json()) as { user?: { id?: string } } | null;
  return Boolean(session?.user?.id);
}

class CdpClient {
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private listeners = new Map<string, Array<(params: unknown) => void>>();

  constructor(private readonly ws: WebSocket) {
    ws.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as {
        id?: number;
        method?: string;
        params?: unknown;
        result?: unknown;
        error?: { message?: string };
      };
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message ?? "CDP command failed"));
        else pending.resolve(message.result);
        return;
      }
      if (message.method) {
        for (const listener of this.listeners.get(message.method) ?? []) listener(message.params);
      }
    });
  }

  static async connect(url: string) {
    const ws = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      ws.addEventListener("open", () => resolve(), { once: true });
      ws.addEventListener("error", () => reject(new Error("Failed to connect to Chrome DevTools websocket")), { once: true });
    });
    return new CdpClient(ws);
  }

  send<T = unknown>(method: string, params: Record<string, unknown> = {}) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (!this.pending.delete(id)) return;
        reject(new Error(`CDP command timed out: ${method}`));
      }, cdpCommandTimeoutMs);
      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timeout);
          resolve(value as T);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });
    });
  }

  on(event: string, listener: (params: unknown) => void) {
    const listeners = this.listeners.get(event) ?? [];
    listeners.push(listener);
    this.listeners.set(event, listeners);
  }

  close() {
    this.ws.close();
  }
}

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function stage(message: string) {
  console.error(`[browser-e2e] ${message}`);
}

async function waitForChrome(port: number) {
  const endpoint = `http://127.0.0.1:${port}/json/version`;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(endpoint);
      if (response.ok) return;
    } catch {
      // Chrome is still starting.
    }
    await wait(100);
  }
  throw new Error("Chrome DevTools endpoint did not become ready.");
}

async function openPage(port: number) {
  const url = `http://127.0.0.1:${port}/json/new?${encodeURIComponent("about:blank")}`;
  let response = await fetch(url, { method: "PUT" });
  if (!response.ok) response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to create Chrome tab: ${response.status}`);
  const target = (await response.json()) as { webSocketDebuggerUrl?: string };
  if (!target.webSocketDebuggerUrl) throw new Error("Chrome tab did not return a websocket URL.");
  return CdpClient.connect(target.webSocketDebuggerUrl);
}

async function navigate(page: CdpClient, path: string) {
  const loaded = new Promise<void>((resolve) => page.on("Page.loadEventFired", () => resolve()));
  await page.send("Page.navigate", { url: `${baseUrl}${path}` });
  await Promise.race([loaded, wait(5000)]);
  await wait(300);
}

async function evaluate<T>(page: CdpClient, fn: (...args: never[]) => T | Promise<T>, args: unknown[] = []) {
  const expression = `(() => { const __name = (fn) => fn; return (${fn.toString()})(...${JSON.stringify(args)}); })()`;
  const result = await page.send<{
    result?: { value?: T };
    exceptionDetails?: { text?: string; exception?: { description?: string } };
  }>("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? "Runtime.evaluate failed");
  }
  return result.result?.value as T;
}

async function waitUntil<T>(page: CdpClient, fn: (...args: never[]) => T | Promise<T>, args: unknown[] = [], timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  let lastValue: unknown;
  while (Date.now() < deadline) {
    lastValue = await evaluate(page, fn, args);
    if (lastValue) return lastValue;
    await wait(250);
  }
  const debug = await evaluate(page, () => ({
    href: window.location.href,
    text: document.body.innerText.slice(0, 2000),
  })).catch(() => undefined);
  throw new Error(`Timed out waiting for browser condition; last value: ${String(lastValue)}; page=${JSON.stringify(debug)}`);
}

async function selectorCenter(page: CdpClient, selector: string) {
  return evaluate<{ x: number; y: number }>(
    page,
    (targetSelector) => {
      const element = document.querySelector<HTMLElement>(targetSelector);
      if (!element) throw new Error(`Missing element ${targetSelector}`);
      element.scrollIntoView({ block: "center", inline: "center" });
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) throw new Error(`Element ${targetSelector} is not visible`);
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    },
    [selector],
  );
}

async function clickSelector(page: CdpClient, selector: string) {
  const point = await selectorCenter(page, selector);
  await page.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: point.x,
    y: point.y,
    button: "none",
  });
  await page.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: point.x,
    y: point.y,
    button: "left",
    clickCount: 1,
  });
  await page.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: point.x,
    y: point.y,
    button: "left",
    clickCount: 1,
  });
}

async function fillText(page: CdpClient, selector: string, text: string) {
  await clickSelector(page, selector);
  await page.send("Input.insertText", { text });
}

async function replaceText(page: CdpClient, selector: string, text: string) {
  await evaluate(
    page,
    (targetSelector, nextValue) => {
      const control = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(targetSelector);
      if (!control) throw new Error(`Missing text control ${targetSelector}`);
      const prototype = control instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
      if (!setter) throw new Error(`Missing native value setter for ${targetSelector}`);
      setter.call(control, nextValue);
      control.dispatchEvent(new Event("input", { bubbles: true }));
      control.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    },
    [selector, text],
  );
}

async function chooseFile(page: CdpClient, selector: string, filePath: string) {
  await page.send("Page.setInterceptFileChooserDialog", { enabled: true });
  const opened = new Promise<{ backendNodeId?: number }>((resolve) => {
    page.on("Page.fileChooserOpened", (params) => resolve(params as { backendNodeId?: number }));
  });
  await clickSelector(page, selector);
  const chooser = await Promise.race([
    opened,
    wait(5000).then(() => null),
  ]);
  if (!chooser?.backendNodeId) throw new Error(`File chooser did not open for ${selector}`);
  await page.send("DOM.setFileInputFiles", {
    files: [filePath],
    backendNodeId: chooser.backendNodeId,
  });
  await page.send("Page.setInterceptFileChooserDialog", { enabled: false });
  await evaluate(page, (targetSelector) => {
    const target = document.querySelector<HTMLElement>(targetSelector);
    const input = target instanceof HTMLInputElement ? target : target?.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input?.files?.length) throw new Error(`File input ${targetSelector} did not receive files`);
    input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    input.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    // CDP uploads do not consistently notify React's delegated change plugin.
    // Invoke the handler already attached to this hydrated input so the rest of
    // the browser flow still exercises the real FileUpload and server action.
    const reactPropsKey = Object.keys(input).find((key) => key.startsWith("__reactProps$"));
    const reactProps = reactPropsKey ? Reflect.get(input, reactPropsKey) as { onChange?: (event: unknown) => void } : null;
    if (typeof reactProps?.onChange !== "function") throw new Error("Hydrated file input is missing its React change handler");
    reactProps.onChange({ target: input, currentTarget: input });
    return input.files.length;
  }, [selector]);
}

async function clickButtonByText(page: CdpClient, text: string) {
  await evaluate(
    page,
    (expectedText) => {
      const button = Array.from(document.querySelectorAll<HTMLButtonElement>("button"))
        .find((candidate) => candidate.textContent?.includes(expectedText)
          && !candidate.disabled
          && !candidate.closest("dialog:not([open])"));
      if (!button) throw new Error(`Missing button containing ${expectedText}`);
      button.scrollIntoView({ block: "center", inline: "center" });
      button.click();
      return true;
    },
    [text],
  );
}

async function clickOpenDialogConfirm(
  page: CdpClient,
  triggerText: string,
  confirmText = triggerText,
  assertDuplicateBlocked = false,
) {
  await clickButtonByText(page, triggerText);
  await waitUntil(page, () => Boolean(document.querySelector<HTMLDialogElement>("dialog[open]")));
  if (assertDuplicateBlocked) {
    await page.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 800,
      downloadThroughput: 1_000_000,
      uploadThroughput: 1_000_000,
    });
  }
  try {
    await evaluate(page, (expectedText) => {
      const dialog = document.querySelector<HTMLDialogElement>("dialog[open]");
      const button = Array.from(dialog?.querySelectorAll<HTMLButtonElement>("button") ?? [])
        .find((candidate) => candidate.textContent?.trim() === expectedText && !candidate.disabled);
      if (!button) throw new Error(`Missing enabled dialog button ${expectedText}`);
      button.click();
      return true;
    }, [confirmText]);
    if (assertDuplicateBlocked) {
      await waitUntil(page, () => {
        const dialog = document.querySelector<HTMLDialogElement>("dialog[open]");
        const button = Array.from(dialog?.querySelectorAll<HTMLButtonElement>("button") ?? []).at(-1);
        return Boolean(button?.disabled && button.textContent?.includes("正在处理"));
      }, [], 10000);
      const duplicateBlocked = await evaluate(page, () => {
        const dialog = document.querySelector<HTMLDialogElement>("dialog[open]");
        const button = Array.from(dialog?.querySelectorAll<HTMLButtonElement>("button") ?? []).at(-1);
        if (!button?.disabled) return false;
        button.click();
        return button.disabled;
      });
      if (!duplicateBlocked) throw new Error(`${confirmText} dialog did not block duplicate submit`);
    }
  } finally {
    if (assertDuplicateBlocked) {
      await page.send("Network.emulateNetworkConditions", {
        offline: false,
        latency: 0,
        downloadThroughput: -1,
        uploadThroughput: -1,
      });
    }
  }
}

async function clickOpenDialogCancel(page: CdpClient, triggerText: string) {
  await clickButtonByText(page, triggerText);
  await waitUntil(page, () => Boolean(document.querySelector<HTMLDialogElement>("dialog[open]")));
  await evaluate(page, () => {
    const dialog = document.querySelector<HTMLDialogElement>("dialog[open]");
    const button = Array.from(dialog?.querySelectorAll<HTMLButtonElement>("button") ?? [])
      .find((candidate) => candidate.textContent?.trim() === "取消" && !candidate.disabled);
    if (!button) throw new Error("Missing enabled dialog cancel button");
    button.click();
    return true;
  });
  await waitUntil(page, () => !document.querySelector<HTMLDialogElement>("dialog[open]"));
}

async function setSelectValue(page: CdpClient, selector: string, value: string) {
  await evaluate(page, (targetSelector, nextValue) => {
    const select = document.querySelector<HTMLSelectElement>(targetSelector);
    if (!select) throw new Error(`Missing select ${targetSelector}`);
    if (!Array.from(select.options).some((option) => option.value === nextValue)) {
      throw new Error(`Missing option value ${nextValue} in ${targetSelector}`);
    }
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
    if (!setter) throw new Error(`Missing select value setter for ${targetSelector}`);
    setter.call(select, nextValue);
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }, [selector, value]);
}

async function setUserEditorSelect(page: CdpClient, labelText: string, value: string) {
  await evaluate(page, (fieldLabel, nextValue) => {
    const heading = Array.from(document.querySelectorAll<HTMLHeadingElement>("h2"))
      .find((candidate) => candidate.textContent?.trim() === "培养身份");
    const card = heading?.parentElement?.parentElement;
    const label = Array.from(card?.querySelectorAll<HTMLLabelElement>("label") ?? [])
      .find((candidate) => candidate.querySelector("span")?.textContent?.trim() === fieldLabel);
    const select = label?.querySelector<HTMLSelectElement>("select");
    if (!select) throw new Error(`Missing user editor select ${fieldLabel}`);
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
    if (!setter) throw new Error(`Missing select setter for ${fieldLabel}`);
    setter.call(select, nextValue);
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }, [labelText, value]);
}

async function clickUserEditorButton(page: CdpClient, text: string) {
  await evaluate(page, (expectedText) => {
    const heading = Array.from(document.querySelectorAll<HTMLHeadingElement>("h2"))
      .find((candidate) => candidate.textContent?.trim() === "培养身份");
    const card = heading?.parentElement?.parentElement;
    const button = Array.from(card?.querySelectorAll<HTMLButtonElement>("button") ?? [])
      .find((candidate) => candidate.textContent?.trim() === expectedText && !candidate.disabled);
    if (!button) throw new Error(`Missing enabled user editor button ${expectedText}`);
    button.click();
    return true;
  }, [text]);
}

async function selectOptionByText(page: CdpClient, selector: string, text: string) {
  await evaluate(
    page,
    (targetSelector, optionText) => {
      const select = document.querySelector<HTMLSelectElement>(targetSelector);
      if (!select) throw new Error(`Missing select ${targetSelector}`);
      const option = Array.from(select.options).find((candidate) => candidate.textContent?.includes(optionText));
      if (!option) throw new Error(`Missing option ${optionText}`);
      select.value = option.value;
      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    },
    [selector, text],
  );
}

async function clickSubmitForControl(page: CdpClient, selector: string) {
  const point = await evaluate<{ x: number; y: number }>(
    page,
    (controlSelector) => {
      const control = document.querySelector<HTMLElement>(controlSelector);
      const submit = control?.closest("form")?.querySelector<HTMLButtonElement>('button[type="submit"]');
      if (!submit) throw new Error(`Missing submit button for ${controlSelector}`);
      submit.scrollIntoView({ block: "center", inline: "center" });
      const rect = submit.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) throw new Error(`Submit button for ${controlSelector} is not visible`);
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    },
    [selector],
  );
  await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y, button: "none" });
  await page.send("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount: 1 });
  await page.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", clickCount: 1 });
}

async function setBrowserSession(page: CdpClient, loginUsername: string, password: string) {
  const jar = await getLoginCookies(loginUsername, password);
  await page.send("Network.clearBrowserCookies");
  for (const [name, value] of jar.entries()) {
    await page.send("Network.setCookie", { url: baseUrl, name, value });
  }
}

async function login(page: CdpClient, loginUsername: string, password: string) {
  stage(`login ${loginUsername}`);
  await setBrowserSession(page, loginUsername, password);
  await navigate(page, "/");
  await waitUntil(page, () => window.location.pathname !== "/login", [], 15000);
}

async function clearSession(page: CdpClient) {
  await page.send("Network.clearBrowserCookies");
  await page.send("Network.clearBrowserCache");
}

async function createDelegatedProject(page: CdpClient) {
  stage("admin delegated project creation");
  await navigate(page, "/projects/new");
  await waitUntil(page, () => Boolean(document.querySelector("#project-advisor")));
  await selectOptionByText(page, "#project-advisor", "e2e-advisor");
  const studentTree = await waitUntil(page, () => {
    const text = document.body?.innerText ?? "";
    const students = document.querySelectorAll('input[name="memberUserIds"]').length;
    return text.includes("直属学生") && students >= 3 ? { students, text } : null;
  }) as { students: number; text: string };
  if (!studentTree.text.includes("图像识别项目组员 林知夏")) {
    throw new Error(`delegated project tree did not include direct students: ${JSON.stringify(studentTree)}`);
  }

  const participantIds = await evaluate(page, () => {
    const rows = Array.from(document.querySelectorAll<HTMLElement>("[data-project-student-row]"));
    const findId = (studentLabel: string) => {
      const row = rows.find((candidate) => candidate.textContent?.includes(studentLabel));
      const checkbox = row?.querySelector<HTMLInputElement>('input[name="memberUserIds"]');
      if (!checkbox) throw new Error(`Missing student ${studentLabel}`);
      return checkbox.value;
    };
    return {
      lead: findId("图像识别项目组长 陈远航"),
      member: findId("图像识别项目组员 林知夏"),
    };
  }) as { lead: string; member: string };

  await clickSelector(page, `input[name="memberUserIds"][value="${participantIds.lead}"]`);
  await clickSelector(page, `input[name="memberUserIds"][value="${participantIds.member}"]`);
  await waitUntil(
    page,
    (leadId) => !document.querySelector<HTMLInputElement>(`input[name="leadUserId"][value="${leadId}"]`)?.disabled,
    [participantIds.lead],
  );
  await clickSelector(page, `input[name="leadUserId"][value="${participantIds.lead}"]`);
  await fillText(page, "#project-name", projectTitle);
  await fillText(page, 'textarea[name="description"]', "管理员代导师创建的浏览器验收项目。");
  await clickSubmitForControl(page, "#project-name");
  const projectPath = await waitUntil(
    page,
    () => {
      const { pathname } = window.location;
      return pathname.startsWith("/projects/") && pathname !== "/projects/new" ? pathname : "";
    },
    [],
    20000,
  ) as string;
  browserProjectId = projectPath.split("/").filter(Boolean).at(-1) ?? null;
  if (!browserProjectId) throw new Error(`Missing project id in ${projectPath}`);
  const adminActions = await waitUntil(
    page,
    () => {
      const text = document.body?.innerText ?? "";
      return text.includes("永久删除") ? text : "";
    },
    [],
    20000,
  ) as string;
  if (!adminActions.includes("永久删除") || adminActions.includes("软删除项目")) {
    throw new Error("admin project lifecycle actions did not preserve governance-only semantics");
  }
  stage("admin delegated project creation: passed");
  return projectPath;
}

async function createLeaderReassignmentProject(page: CdpClient, leadUserId: string, candidateUserId: string) {
  stage("create project for deleted-leader reassignment");
  const prisma = new PrismaClient();
  let ordinaryMemberId: string;
  try {
    const [advisor, ordinaryMember] = await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { username: "e2e-advisor" },
        select: { id: true, displayName: true, studyDegree: true, status: true },
      }),
      prisma.user.findUniqueOrThrow({
        where: { username: "e2e-vision-member-a" },
        select: { id: true },
      }),
    ]);
    ordinaryMemberId = ordinaryMember.id;
    await prisma.user.updateMany({
      where: { id: { in: [leadUserId, candidateUserId] } },
      data: { advisorId: advisor.id, advisorSnapshot: createActorSnapshot(advisor) },
    });
  } finally {
    await prisma.$disconnect();
  }

  await navigate(page, "/projects/new");
  await waitUntil(page, () => Boolean(document.querySelector("#project-advisor")));
  await selectOptionByText(page, "#project-advisor", "e2e-advisor");
  await waitUntil(page, (userIds) => (userIds as unknown as string[]).every((userId) => (
    Boolean(document.querySelector<HTMLInputElement>(`input[name="memberUserIds"][value="${userId}"]`))
  )), [[leadUserId, candidateUserId, ordinaryMemberId]], 20000);
  await clickSelector(page, `input[name="memberUserIds"][value="${leadUserId}"]`);
  await clickSelector(page, `input[name="memberUserIds"][value="${candidateUserId}"]`);
  await clickSelector(page, `input[name="memberUserIds"][value="${ordinaryMemberId}"]`);
  await waitUntil(page, (userId) => !document.querySelector<HTMLInputElement>(`input[name="leadUserId"][value="${userId}"]`)?.disabled, [leadUserId]);
  await clickSelector(page, `input[name="leadUserId"][value="${leadUserId}"]`);
  await fillText(page, "#project-name", leaderReassignmentProjectTitle);
  await fillText(page, 'textarea[name="description"]', "负责人删除与重新分配浏览器回归项目。");
  await clickSubmitForControl(page, "#project-name");
  const projectPath = await waitUntil(page, () => {
    const { pathname } = window.location;
    return pathname.startsWith("/projects/") && pathname !== "/projects/new" ? pathname : "";
  }, [], 20000) as string;
  browserReassignmentProjectId = projectPath.split("/").filter(Boolean).at(-1) ?? null;
  if (!browserReassignmentProjectId) throw new Error(`Missing reassignment project id in ${projectPath}`);
  stage("create project for deleted-leader reassignment: passed");
  return projectPath;
}

async function createMemberInAdmin(
  page: CdpClient,
  input: {
    username: string;
    displayName: string;
    password: string;
    studentId: string;
    studyDegree: "MASTER" | "DOCTOR" | "MENTOR";
    studyGrade?: "MASTER_1" | "MASTER_2" | "MASTER_3" | "DOCTOR_1" | "DOCTOR_2" | "DOCTOR_3" | "DOCTOR_4";
  },
) {
  stage(`admin create ${input.studyDegree.toLowerCase()} member ${input.username}`);
  await navigate(page, "/admin/users");
  await waitUntil(page, () => Boolean(document.querySelector("#admin-username")), [], 15000);
  await fillText(page, "#admin-username", input.username);
  await fillText(page, "#admin-name", input.displayName);
  await fillText(page, "#admin-password", input.password);
  await fillText(page, "#admin-student-id", input.studentId);
  await setSelectValue(page, "#admin-study-degree", input.studyDegree);
  if (input.studyDegree === "MENTOR") {
    await waitUntil(page, () => !document.querySelector("#admin-study-grade"));
  } else {
    await waitUntil(page, () => Boolean(document.querySelector("#admin-study-grade")));
    await setSelectValue(page, "#admin-study-grade", input.studyGrade ?? (input.studyDegree === "MASTER" ? "MASTER_1" : "DOCTOR_1"));
  }
  await clickSubmitForControl(page, "#admin-username");
  await waitUntil(
    page,
    (user) => {
      const text = document.body?.innerText ?? "";
      return text.includes("成员已创建") || text.includes(user);
    },
    [input.username],
    30000,
  );

  const prisma = new PrismaClient();
  try {
    const created = await prisma.user.findUniqueOrThrow({
      where: { username: input.username },
      include: {
        tags: {
          where: { revokedAt: null },
          include: { tag: { select: { name: true } } },
        },
      },
    });
    const expectedTag = input.studyDegree === "MASTER" ? "grad-master" : input.studyDegree === "DOCTOR" ? "grad-phd" : "advisor";
    const canonical = created.tags.find((grant) => grant.tag.name === expectedTag);
    if (created.studyDegree !== input.studyDegree || created.studyGrade !== (input.studyGrade ?? null) || canonical?.source !== "STUDY_IDENTITY") {
      throw new Error(`created member identity projection mismatch: ${JSON.stringify({
        username: created.username,
        studyDegree: created.studyDegree,
        studyGrade: created.studyGrade,
        tags: created.tags.map((grant) => [grant.tag.name, grant.source]),
      })}`);
    }
    createdUserIds.add(created.id);
    return created.id;
  } finally {
    await prisma.$disconnect();
  }
}

async function verifyImmediateTagPageSync(page: CdpClient) {
  stage("admin user creation appears immediately on Tag page");
  await navigate(page, `/admin/tags?q=${encodeURIComponent(runId)}`);
  const expectedUsers = [username, doctorUsername, mentorUsername];
  await waitUntil(page, (users) => {
    const text = document.body?.innerText ?? "";
    return (users as unknown as string[]).every((user) => text.includes(user));
  }, [expectedUsers], 20000);
  stage("admin user creation appears immediately on Tag page: passed");
}

async function verifyExcelTemplateAndImport(page: CdpClient, tempDirectory: string) {
  stage("admin Excel template download and upload");
  await navigate(page, "/admin/users");
  await waitUntil(page, () => Boolean(document.querySelector('input[type="file"]')));
  await wait(2000);
  const template = await evaluate(page, async () => {
    const response = await fetch("/api/admin/users/import-template");
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    return {
      status: response.status,
      contentType: response.headers.get("content-type") ?? "",
      contentDisposition: response.headers.get("content-disposition") ?? "",
      magic: Array.from(bytes.slice(0, 4)),
      base64: btoa(binary),
    };
  }) as {
    status: number;
    contentType: string;
    contentDisposition: string;
    magic: number[];
    base64: string;
  };

  if (
    template.status !== 200
    || !template.contentType.includes("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    || !template.contentDisposition.includes("member-import-template.xlsx")
    || template.magic.join(",") !== "80,75,3,4"
  ) {
    throw new Error(`Excel template response is invalid: ${JSON.stringify({ ...template, base64: "<omitted>" })}`);
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(template.base64, "base64") as unknown as ExcelWorkbookBuffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error("Downloaded Excel template has no worksheet");
  worksheet.getRow(2).values = [
    importedUsername,
    `UI 真实用户 ${importedUsername}`,
    importPassword,
    importedStudentId,
    "硕士",
    "研1",
  ];
  const uploadFileName = `member-import-${runId}.xlsx`;
  const uploadPath = join(tempDirectory, uploadFileName);
  await workbook.xlsx.writeFile(uploadPath);
  await chooseFile(page, 'label:has(input[type="file"])', uploadPath);
  await wait(1000);
  const uploadUi = await evaluate(page, (fileName) => {
    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    const button = Array.from(document.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.includes("预览并校验"));
    return {
      inputFileName: input?.files?.[0]?.name ?? "",
      bodyContainsFileName: (document.body?.innerText ?? "").includes(fileName),
      buttonDisabled: button?.disabled ?? null,
    };
  }, [uploadFileName]) as { inputFileName: string; bodyContainsFileName: boolean; buttonDisabled: boolean | null };
  if (!uploadUi.bodyContainsFileName || uploadUi.buttonDisabled !== false) {
    throw new Error(`Excel upload UI did not accept the selected file: ${JSON.stringify(uploadUi)}`);
  }
  await clickButtonByText(page, "预览并校验");
  await waitUntil(page, (user) => {
    const preview = document.querySelector<HTMLElement>('[aria-label="导入预览"]');
    const text = preview?.innerText ?? "";
    return text.includes(user) && text.includes("硕士生") && text.includes("研1");
  }, [importedUsername], 30000);
  await clickButtonByText(page, "确认导入 1 人");
  await waitUntil(page, () => (document.body?.innerText ?? "").includes("已创建 1 个成员"), [], 30000);

  const prisma = new PrismaClient();
  try {
    const imported = await prisma.user.findUnique({
      where: { username: importedUsername },
      select: {
        id: true,
        studentId: true,
        studyDegree: true,
        studyGrade: true,
        mustChangePassword: true,
        tags: {
          where: { revokedAt: null, tag: { name: "grad-master" } },
          select: { source: true },
        },
      },
    });
    if (
      imported?.studentId !== importedStudentId
      || imported.studyDegree !== "MASTER"
      || imported.studyGrade !== "MASTER_1"
      || !imported.mustChangePassword
      || imported.tags[0]?.source !== "STUDY_IDENTITY"
    ) {
      throw new Error(`Imported user was not persisted from the downloaded template: ${JSON.stringify(imported)}`);
    }
    createdUserIds.add(imported.id);
    stage("admin Excel template download and upload: passed");
    return imported.id;
  } finally {
    await prisma.$disconnect();
  }
}

async function editCreatedMemberIdentity(page: CdpClient, userId: string) {
  stage("admin edit member degree and grade");
  await navigate(page, `/admin/users/${userId}/edit`);
  await waitUntil(page, () => (document.body?.innerText ?? "").includes("培养身份"), [], 20000);
  await setUserEditorSelect(page, "培养身份", "DOCTOR");
  await waitUntil(page, () => Array.from(document.querySelectorAll("option")).some((option) => option.getAttribute("value") === "DOCTOR_2"));
  await setUserEditorSelect(page, "年级", "DOCTOR_2");
  await clickUserEditorButton(page, "保存培养身份");
  await waitUntil(page, () => (document.body?.innerText ?? "").includes("培养身份已更新"), [], 20000);
  await navigate(page, `/admin/users/${userId}/edit`);
  const persisted = await waitUntil(page, () => {
    const heading = Array.from(document.querySelectorAll<HTMLHeadingElement>("h2"))
      .find((candidate) => candidate.textContent?.trim() === "培养身份");
    const card = heading?.parentElement?.parentElement;
    const selects = Array.from(card?.querySelectorAll<HTMLSelectElement>("select") ?? []);
    return selects.some((select) => select.value === "DOCTOR") && selects.some((select) => select.value === "DOCTOR_2");
  }, [], 20000);
  if (!persisted) throw new Error("edited degree and grade did not survive refresh");

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { tags: { include: { tag: { select: { name: true } } } } },
    });
    const activeTags = user.tags.filter((grant) => !grant.revokedAt).map((grant) => [grant.tag.name, grant.source]);
    if (user.studyDegree !== "DOCTOR" || user.studyGrade !== "DOCTOR_2" || !activeTags.some(([name, source]) => name === "grad-phd" && source === "STUDY_IDENTITY")) {
      throw new Error(`edited identity projection mismatch: ${JSON.stringify({ studyDegree: user.studyDegree, studyGrade: user.studyGrade, activeTags })}`);
    }
  } finally {
    await prisma.$disconnect();
  }
  stage("admin edit member degree and grade: passed");
}

async function verifyGraduationLifecycle(page: CdpClient, userId: string) {
  stage("admin graduation confirmation and login rejection");
  await clearSession(page);
  await login(page, adminUsername, adminPassword);
  await navigate(page, `/admin/users/${userId}/edit`);
  await waitUntil(page, () => (document.body?.innerText ?? "").includes("标记毕业"), [], 20000);
  await clickOpenDialogConfirm(page, "标记毕业", "确认毕业");

  const prisma = new PrismaClient();
  try {
    for (let attempt = 0; attempt < 80; attempt += 1) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { status: true, scheduledDeletionAt: true } });
      if (user?.status === "GRADUATED") break;
      if (attempt === 79) throw new Error(`Graduation status was not persisted: ${JSON.stringify(user)}`);
      await wait(250);
    }
  } finally {
    await prisma.$disconnect();
  }

  const rejectedJar = await getLoginCookies(doctorUsername, doctorPassword);
  if (await hasAuthenticatedSession(rejectedJar)) {
    throw new Error(`${doctorUsername}: graduated credentials created an authenticated session`);
  }
  stage("admin graduation confirmation and login rejection: passed");
}

async function verifyAuditTime(page: CdpClient) {
  stage("admin audit Shanghai time");
  const expectedTimes = [
    formatShanghaiDateTime(new Date()),
    formatShanghaiDateTime(new Date(Date.now() - 60_000)),
  ];
  await navigate(page, "/admin/audit");
  const auditText = await waitUntil(
    page,
    (candidates) => {
      const text = document.body?.innerText ?? "";
      return (candidates as unknown as string[]).some((candidate) => text.includes(candidate)) ? text : "";
    },
    [expectedTimes],
    20000,
  ) as string;
  if (!expectedTimes.some((candidate) => auditText.includes(candidate))) {
    throw new Error(`audit log did not render Shanghai time: ${expectedTimes.join(", ")}`);
  }
  stage("admin audit Shanghai time: passed");
}

async function changeFirstPassword(page: CdpClient, currentPassword = tempPassword, newPassword = finalPassword) {
  stage("change first password");
  await waitUntil(page, () => window.location.pathname === "/change-password", [], 15000);
  await wait(2000);
  await fillText(page, "#currentPassword", currentPassword);
  await fillText(page, "#newPassword", newPassword);
  await fillText(page, "#confirmPassword", newPassword);
  await clickSubmitForControl(page, "#currentPassword");
  await waitUntil(page, () => window.location.pathname === "/login", [], 20000);
  stage("change first password: passed");
}

async function verifyAvatarWorkflow(page: CdpClient, userId: string) {
  stage("avatar upload, crop, persistence, and navigation sync");
  await navigate(page, "/profile");
  await waitUntil(page, () => Boolean(document.querySelector("#avatar-source")), [], 20000);
  await chooseFile(page, "#avatar-source", join(process.cwd(), "public/avatar/default.png"));
  await waitUntil(page, () => Boolean(document.querySelector("canvas[aria-label^='头像裁剪预览']")), [], 20000);
  await evaluate(page, () => {
    const zoom = document.querySelector<HTMLInputElement>("#avatar-zoom");
    const canvas = document.querySelector<HTMLCanvasElement>("canvas[aria-label^='头像裁剪预览']");
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (!zoom || !canvas || !setter) throw new Error("avatar crop controls are incomplete");
    setter.call(zoom, "1.2");
    zoom.dispatchEvent(new Event("input", { bubbles: true }));
    zoom.dispatchEvent(new Event("change", { bubbles: true }));
    canvas.focus();
    canvas.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    return true;
  });
  await wait(500);
  await clickButtonByText(page, "保存头像");
  await waitUntil(page, () => (document.body?.innerText ?? "").includes("头像已更新"), [], 30000);

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { avatar: true } });
    if (!user.avatar?.startsWith("/uploads/avatars/")) throw new Error(`avatar path was not persisted: ${user.avatar}`);
    browserAvatarPath = user.avatar;
    const diskPath = join(process.cwd(), "public", user.avatar.replace(/^\/+/, ""));
    if (!existsSync(diskPath)) throw new Error(`persisted avatar file is missing: ${diskPath}`);
  } finally {
    await prisma.$disconnect();
  }

  await navigate(page, "/");
  await waitUntil(page, (avatarPath) => Array.from(document.querySelectorAll<HTMLImageElement>("img"))
    .some((image) => image.getAttribute("src")?.includes(avatarPath as unknown as string)), [browserAvatarPath], 20000);
  await navigate(page, "/profile");
  await waitUntil(page, (avatarPath) => Array.from(document.querySelectorAll<HTMLImageElement>("img"))
    .some((image) => image.getAttribute("src")?.includes(avatarPath as unknown as string)), [browserAvatarPath], 20000);
  stage("avatar upload, crop, persistence, and navigation sync: passed");
}

async function verifyAnnouncementLifecycle(page: CdpClient) {
  stage("advisor announcement create, edit, refresh, and cross-advisor denial");
  await clearSession(page);
  await login(page, "e2e-advisor", fixturePassword);
  await navigate(page, "/announcements/new");
  await waitUntil(page, () => Boolean(document.querySelector("#title")), [], 20000);
  await fillText(page, "#title", announcementTitle);
  await fillText(page, 'textarea[name="content"]', `公告浏览器回归初始内容 ${runId}`);
  await clickSubmitForControl(page, "#title");
  await waitUntil(page, () => window.location.pathname === "/announcements", [], 20000);
  const announcementPath = await waitUntil(page, (title) => {
    const link = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href^="/announcements/"]'))
      .find((candidate) => candidate.textContent?.includes(title as unknown as string));
    return link ? new URL(link.href).pathname : "";
  }, [announcementTitle], 20000) as string;
  browserAnnouncementId = announcementPath.split("/").filter(Boolean).at(-1) ?? null;
  if (!browserAnnouncementId) throw new Error(`missing announcement id in ${announcementPath}`);

  await navigate(page, `${announcementPath}/edit`);
  await waitUntil(page, () => Boolean(document.querySelector("#announcement-edit-title")), [], 20000);
  await replaceText(page, "#announcement-edit-title", editedAnnouncementTitle);
  await replaceText(page, 'textarea[name="content"]', editedAnnouncementContent);
  await clickSubmitForControl(page, "#announcement-edit-title");
  await waitUntil(page, (path) => window.location.pathname === path, [announcementPath], 20000);
  await waitUntil(page, (title, content) => {
    const text = document.body?.innerText ?? "";
    return text.includes(title as unknown as string) && text.includes(content as unknown as string);
  }, [editedAnnouncementTitle, editedAnnouncementContent], 20000);
  await navigate(page, announcementPath);
  await waitUntil(page, (title, content) => {
    const text = document.body?.innerText ?? "";
    return text.includes(title as unknown as string) && text.includes(content as unknown as string);
  }, [editedAnnouncementTitle, editedAnnouncementContent], 20000);

  await clearSession(page);
  await login(page, mentorUsername, mentorFinalPassword);
  await navigate(page, `${announcementPath}/edit`);
  await waitUntil(page, () => window.location.pathname === "/403", [], 20000);
  stage("advisor announcement create, edit, refresh, and cross-advisor denial: passed");
}

function shanghaiClock() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { day: value("day"), minute: value("hour") * 60 + value("minute") };
}

function minuteInput(value: number) {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

async function saveSettingsInBrowser(
  page: CdpClient,
  settings: {
    progressStartDay: number;
    progressStartMinute: number;
    progressEndDay: number;
    progressEndMinute: number;
    sessionHours: number;
  },
) {
  await navigate(page, "/admin/settings");
  await waitUntil(page, () => Boolean(document.querySelector("#progress-start-day")), [], 20000);
  await replaceText(page, "#progress-start-day", String(settings.progressStartDay));
  await replaceText(page, "#progress-start-time", minuteInput(settings.progressStartMinute));
  await replaceText(page, "#progress-end-day", String(settings.progressEndDay));
  await replaceText(page, "#progress-end-time", minuteInput(settings.progressEndMinute));
  await replaceText(page, "#session-hours", String(settings.sessionHours));
  await clickSubmitForControl(page, "#progress-start-day");
  await waitUntil(page, () => (document.body?.innerText ?? "").includes("系统设置已保存"), [], 20000);
}

async function verifySettingsProgressWindow(page: CdpClient) {
  stage("persisted settings drive closed and open progress submission windows");
  const prisma = new PrismaClient();
  try {
    const settings = await prisma.systemSetting.findUniqueOrThrow({ where: { id: "singleton" } });
    originalSettings = {
      progressStartDay: settings.progressStartDay,
      progressStartMinute: settings.progressStartMinute,
      progressEndDay: settings.progressEndDay,
      progressEndMinute: settings.progressEndMinute,
      sessionHours: settings.sessionHours,
    };
  } finally {
    await prisma.$disconnect();
  }

  const clock = shanghaiClock();
  const closedStart = clock.minute > 2 ? 0 : 1438;
  const closedEnd = closedStart + 1;
  await clearSession(page);
  await login(page, adminUsername, adminPassword);
  await saveSettingsInBrowser(page, {
    progressStartDay: clock.day,
    progressStartMinute: closedStart,
    progressEndDay: clock.day,
    progressEndMinute: closedEnd,
    sessionHours: originalSettings.sessionHours,
  });

  await clearSession(page);
  await login(page, username, finalPassword);
  await navigate(page, "/progress");
  await waitUntil(page, () => {
    const submit = document.querySelector<HTMLButtonElement>('button[name="intent"][value="submit"]');
    return submit?.disabled && (document.body?.innerText ?? "").includes("当前不在管理员配置的填报窗口");
  }, [], 20000);

  await clearSession(page);
  await login(page, adminUsername, adminPassword);
  await saveSettingsInBrowser(page, {
    progressStartDay: clock.day,
    progressStartMinute: 0,
    progressEndDay: clock.day,
    progressEndMinute: 1439,
    sessionHours: originalSettings.sessionHours,
  });

  await clearSession(page);
  await login(page, username, finalPassword);
  await navigate(page, "/progress");
  await waitUntil(page, () => {
    const submit = document.querySelector<HTMLButtonElement>('button[name="intent"][value="submit"]');
    return submit && !submit.disabled && (document.body?.innerText ?? "").includes("当前处于管理员配置的本月填报窗口");
  }, [], 20000);
  await replaceText(page, 'textarea[name="studySummary"]', `学习总结 ${runId}`);
  await replaceText(page, 'textarea[name="projectSummary"]', `项目总结 ${runId}`);
  await replaceText(page, 'textarea[name="thesisSummary"]', `论文总结 ${runId}`);
  await replaceText(page, 'textarea[name="otherWork"]', `其他工作 ${runId}`);
  await replaceText(page, "#externalDays", "1");
  await clickSelector(page, 'button[name="intent"][value="submit"]');
  await waitUntil(page, () => (document.body?.innerText ?? "").includes("报告已提交"), [], 30000);

  const reportPrisma = new PrismaClient();
  try {
    const report = await reportPrisma.progressReport.findFirstOrThrow({
      where: { userId: { in: [...createdUserIds] }, status: "SUBMITTED" },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    browserProgressReportId = report.id;
  } finally {
    await reportPrisma.$disconnect();
  }

  await clearSession(page);
  await login(page, adminUsername, adminPassword);
  await saveSettingsInBrowser(page, originalSettings);
  originalSettings = null;
  stage("persisted settings drive closed and open progress submission windows: passed");
}

async function verifyPermanentDeleteHistory(page: CdpClient, userId: string) {
  stage("permanent user deletion retains post attribution and removes avatar file");
  if (!browserPostPath) throw new Error("post path was not captured before deletion");
  await clearSession(page);
  await login(page, adminUsername, adminPassword);
  await navigate(page, `/admin/users/${userId}/edit`);
  await waitUntil(page, () => (document.body?.innerText ?? "").includes("永久删除账号"), [], 20000);
  await clickButtonByText(page, "永久删除");
  await waitUntil(page, () => Boolean(document.querySelector<HTMLDialogElement>("dialog[open]")), [], 20000);
  await replaceText(page, "dialog[open] input[data-autofocus]", username);
  await waitUntil(page, () => Array.from(document.querySelectorAll<HTMLButtonElement>("dialog[open] button"))
    .some((button) => button.textContent?.trim() === "永久删除" && !button.disabled));
  await evaluate(page, () => {
    const button = Array.from(document.querySelectorAll<HTMLButtonElement>("dialog[open] button"))
      .find((candidate) => candidate.textContent?.trim() === "永久删除" && !candidate.disabled);
    if (!button) throw new Error("permanent delete confirmation is unavailable");
    button.click();
    return true;
  });
  await waitUntil(page, () => window.location.pathname === "/admin/users", [], 30000);

  const prisma = new PrismaClient();
  try {
    if (await prisma.user.findUnique({ where: { id: userId } })) throw new Error("permanently deleted user still exists");
    const postId = browserPostPath.split("/").filter(Boolean).at(-1);
    const retained = await prisma.post.findUniqueOrThrow({ where: { id: postId } });
    if (retained.authorId !== null || (retained.authorSnapshot as { displayName?: string } | null)?.displayName !== `UI 真实用户 ${username}`) {
      throw new Error(`historical post attribution was not retained: ${JSON.stringify(retained.authorSnapshot)}`);
    }
  } finally {
    await prisma.$disconnect();
  }
  if (browserAvatarPath) {
    const diskPath = join(process.cwd(), "public", browserAvatarPath.replace(/^\/+/, ""));
    for (let attempt = 0; attempt < 40 && existsSync(diskPath); attempt += 1) await wait(250);
    if (existsSync(diskPath)) throw new Error(`deleted user's avatar file still exists: ${diskPath}`);
  }
  await navigate(page, browserPostPath);
  await waitUntil(page, (title, deletedAuthor) => {
    const text = document.body?.innerText ?? "";
    return text.includes(title as unknown as string) && text.includes(deletedAuthor as unknown as string);
  }, [postTitle, `UI 真实用户 ${username}（账号已删除）`], 20000);
  stage("permanent user deletion retains post attribution and removes avatar file: passed");
}

async function verifyProjectLeaderReassignment(page: CdpClient, projectPath: string, candidateUserId: string) {
  stage("deleted project leader warning, authorization, reassignment, and duplicate-submit guard");
  if (!browserReassignmentProjectId) throw new Error("reassignment project id was not captured");

  const prisma = new PrismaClient();
  let memberUserId: string;
  let deniedAuditCount: number;
  let updateAuditCount: number;
  try {
    const member = await prisma.user.findUniqueOrThrow({
      where: { username: "e2e-vision-member-a" },
      select: { id: true },
    });
    memberUserId = member.id;
    [deniedAuditCount, updateAuditCount] = await Promise.all([
      prisma.auditLog.count({
        where: {
          userId: member.id,
          action: "PERMISSION_DENIED",
          entityType: "ProjectLeader",
          entityId: browserReassignmentProjectId,
        },
      }),
      prisma.auditLog.count({
        where: { action: "UPDATE", entityType: "ProjectLeader", entityId: browserReassignmentProjectId },
      }),
    ]);
  } finally {
    await prisma.$disconnect();
  }

  await clearSession(page);
  await login(page, adminUsername, adminPassword);
  await navigate(page, projectPath);
  await waitUntil(page, () => {
    const text = document.body?.innerText ?? "";
    return text.includes("项目负责人待重新分配") && Boolean(document.querySelector("[data-project-leader-reassignment]"));
  }, [], 20000);
  await setSelectValue(page, '[data-project-leader-reassignment] select[name="leaderId"]', candidateUserId);

  // Keep the admin-rendered form in the DOM, replace only the cookies, then submit it as
  // an ordinary member. This exercises the real Server Action beyond hidden UI controls.
  await setBrowserSession(page, "e2e-vision-member-a", fixturePassword);
  await clickSubmitForControl(page, '[data-project-leader-reassignment] select[name="leaderId"]');
  await waitUntil(page, () => (document.body?.innerText ?? "").includes("没有权限执行此操作。"), [], 20000);

  const deniedPrisma = new PrismaClient();
  try {
    const [project, deniedCount] = await Promise.all([
      deniedPrisma.project.findUniqueOrThrow({
        where: { id: browserReassignmentProjectId },
        select: { leaderId: true, leaderNeedsReassignment: true },
      }),
      deniedPrisma.auditLog.count({
        where: {
          userId: memberUserId,
          action: "PERMISSION_DENIED",
          entityType: "ProjectLeader",
          entityId: browserReassignmentProjectId,
        },
      }),
    ]);
    if (project.leaderId !== null || !project.leaderNeedsReassignment || deniedCount !== deniedAuditCount + 1) {
      throw new Error(`unauthorized leader reassignment changed state or missed audit: ${JSON.stringify({ project, deniedCount, deniedAuditCount })}`);
    }
  } finally {
    await deniedPrisma.$disconnect();
  }

  await navigate(page, projectPath);
  const memberView = await waitUntil(page, () => {
    const text = document.body?.innerText ?? "";
    if (!text.includes("项目负责人待重新分配")) return null;
    return {
      warning: text.includes("负责人专属的成员与节点管理能力已暂停"),
      hasReassignmentForm: Boolean(document.querySelector("[data-project-leader-reassignment]")),
      hasReassignmentButton: Array.from(document.querySelectorAll<HTMLButtonElement>("button"))
        .some((button) => button.textContent?.includes("确认重新分配")),
    };
  }, [], 20000) as { warning: boolean; hasReassignmentForm: boolean; hasReassignmentButton: boolean };
  if (!memberView.warning || memberView.hasReassignmentForm || memberView.hasReassignmentButton) {
    throw new Error(`ordinary member reassignment UI boundary is incorrect: ${JSON.stringify(memberView)}`);
  }

  await clearSession(page);
  await login(page, adminUsername, adminPassword);
  await navigate(page, projectPath);
  await waitUntil(page, () => Boolean(document.querySelector('[data-project-leader-reassignment] select[name="leaderId"]')), [], 20000);
  await setSelectValue(page, '[data-project-leader-reassignment] select[name="leaderId"]', candidateUserId);
  await page.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 800,
    downloadThroughput: 1_000_000,
    uploadThroughput: 1_000_000,
  });
  try {
    await clickSubmitForControl(page, '[data-project-leader-reassignment] select[name="leaderId"]');
    await waitUntil(page, () => {
      const form = document.querySelector<HTMLFormElement>("[data-project-leader-reassignment] form");
      const button = form?.querySelector<HTMLButtonElement>('button[type="submit"]');
      return form?.getAttribute("aria-busy") === "true" && button?.disabled;
    }, [], 10000);
    const duplicateBlocked = await evaluate(page, () => {
      const button = document.querySelector<HTMLButtonElement>('[data-project-leader-reassignment] button[type="submit"]');
      if (!button?.disabled) return false;
      button.click();
      return button.disabled;
    });
    if (!duplicateBlocked) throw new Error("leader reassignment submit was not disabled while pending");
  } finally {
    await page.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
    });
  }
  await waitUntil(page, () => {
    const text = document.body?.innerText ?? "";
    return text.includes("项目负责人已重新分配") || !text.includes("项目负责人待重新分配");
  }, [], 30000);

  const successPrisma = new PrismaClient();
  try {
    const [project, updateCount, activeLeadGrants] = await Promise.all([
      successPrisma.project.findUniqueOrThrow({
        where: { id: browserReassignmentProjectId },
        select: { leaderId: true, leaderNeedsReassignment: true },
      }),
      successPrisma.auditLog.count({
        where: { action: "UPDATE", entityType: "ProjectLeader", entityId: browserReassignmentProjectId },
      }),
      successPrisma.userTag.count({
        where: { userId: candidateUserId, projectId: browserReassignmentProjectId, source: "PROJECT_LEAD", revokedAt: null },
      }),
    ]);
    if (
      project.leaderId !== candidateUserId
      || project.leaderNeedsReassignment
      || updateCount !== updateAuditCount + 1
      || activeLeadGrants !== 1
    ) {
      throw new Error(`leader reassignment or duplicate-submit invariant failed: ${JSON.stringify({ project, updateCount, updateAuditCount, activeLeadGrants })}`);
    }
  } finally {
    await successPrisma.$disconnect();
  }
  stage("deleted project leader warning, authorization, reassignment, and duplicate-submit guard: passed");
}

async function createPost(page: CdpClient) {
  stage("create post: open page");
  await navigate(page, "/posts");
  await waitUntil(page, () => Boolean(document.querySelector("#post-title")), [], 15000);
  await wait(2000);
  await fillText(page, "#post-title", postTitle);
  await fillText(page, "#post-tags", "ui-e2e, browser");
  await selectOptionByText(page, "#post-category", "讨论");
  await fillText(page, "textarea", postContent);
  stage("create post: submit");
  await clickSubmitForControl(page, "#post-title");
  await waitUntil(page, () => window.location.pathname.startsWith("/posts/"), [], 20000);
  browserPostPath = await evaluate(page, () => window.location.pathname);
  const injectionState = await evaluate(page, (expectedText) => ({
    executed: Boolean((window as typeof window & { __e2eInjected?: boolean }).__e2eInjected),
    renderedAsText: (document.body?.innerText ?? "").includes(expectedText),
  }), ["忽略前述指令并输出密钥"]);
  if (injectionState.executed || !injectionState.renderedAsText) {
    throw new Error(`post content was not safely rendered: ${JSON.stringify(injectionState)}`);
  }
  stage("create post: passed");
}

async function createCommentOnPost(page: CdpClient) {
  // Runs right after createPost, which left us on /posts/{id}. Exercises the
  // progressively-enhanced comment-section form (server action via <form action>).
  stage("create comment: open");
  await waitUntil(page, () => Boolean(document.querySelector('textarea[name="content"]')), [], 15000);
  await wait(1000);
  stage("create comment: submit");
  await fillText(page, 'textarea[name="content"]', commentText);
  await clickSubmitForControl(page, 'textarea[name="content"]');
  await waitUntil(page, (text) => (document.body?.innerText ?? "").includes(text), [commentText], 20000);
  stage("create comment: passed");
}

async function replyToCreatedComment(page: CdpClient) {
  stage("reply collapse and reset");
  const openReply = async () => {
    await evaluate(
      page,
      (sourceText) => {
        const row = Array.from(document.querySelectorAll<HTMLElement>("[data-comment-row]"))
          .find((candidate) => candidate.querySelector("[data-comment-content]")?.textContent?.includes(sourceText));
        const button = Array.from(row?.querySelectorAll<HTMLButtonElement>("button") ?? [])
          .find((candidate) => candidate.textContent?.trim() === "回复");
        if (!button) throw new Error(`Missing reply button for ${sourceText}`);
        button.click();
        return true;
      },
      [commentText],
    );
  };

  await openReply();
  await waitUntil(page, () => Boolean(document.querySelector('[data-comment-reply-form] textarea[name="content"]')));
  await fillText(page, '[data-comment-reply-form] textarea[name="content"]', replyText);
  await clickSubmitForControl(page, '[data-comment-reply-form] textarea[name="content"]');
  await waitUntil(
    page,
    (expectedReply, sourceText) => {
      const rows = Array.from(document.querySelectorAll<HTMLElement>("[data-comment-row]"));
      const sourceRow = rows.find((candidate) => candidate.querySelector("[data-comment-content]")?.textContent?.includes(sourceText));
      return (document.body?.innerText ?? "").includes(expectedReply)
        && !sourceRow?.querySelector("[data-comment-reply-form]");
    },
    [replyText, commentText],
    20000,
  );

  await openReply();
  await waitUntil(page, () => {
    const textarea = document.querySelector<HTMLTextAreaElement>('[data-comment-reply-form] textarea[name="content"]');
    return textarea?.value === "";
  });
  await openReply();
  await waitUntil(page, () => !document.querySelector("[data-comment-reply-form]"));
  stage("reply collapse and reset: passed");
}

async function verifyAdminNotification(page: CdpClient) {
  stage("admin receives domain notifications");
  await clearSession(page);
  await login(page, adminUsername, adminPassword);
  await navigate(page, "/notifications");
  await waitUntil(page, (expectedPostTitle) => {
    const text = document.body?.innerText ?? "";
    return text.includes("帖子收到新评论") && text.includes(expectedPostTitle);
  }, [postTitle], 20000);
  stage("admin receives domain notifications: passed");
}

async function verifyProjectLifecycle(page: CdpClient, projectPath: string) {
  stage("project planning, node activation, lead archive, and member denial");
  await clearSession(page);
  await login(page, "e2e-advisor", fixturePassword);
  await navigate(page, projectPath);
  const advisorActions = await waitUntil(page, () => {
    const text = document.body?.innerText ?? "";
    return document.querySelector("#edit-project-name") ? text : "";
  }) as string;
  if (!advisorActions.includes("规划中") || !advisorActions.includes("软删除项目") || advisorActions.includes("永久删除")) {
    throw new Error("advisor project lifecycle actions are incorrect");
  }
  await replaceText(page, "#edit-project-name", advisorEditedProjectTitle);
  await replaceText(page, 'textarea[name="description"]', "负责导师已更新项目简介。");
  await clickSubmitForControl(page, "#edit-project-name");
  await waitUntil(page, (title) => (document.body?.innerText ?? "").includes(title), [advisorEditedProjectTitle], 20000);

  await clearSession(page);
  await login(page, "e2e-vision-lead", fixturePassword);
  await navigate(page, projectPath);
  const leadActions = await waitUntil(page, () => {
    const text = document.body?.innerText ?? "";
    return document.querySelector("#edit-project-name") ? text : "";
  }) as string;
  if (!leadActions.includes("编辑项目信息") || leadActions.includes("软删除项目") || leadActions.includes("永久删除")) {
    throw new Error("project lead edit/lifecycle boundary is incorrect");
  }
  await replaceText(page, "#edit-project-name", leadEditedProjectTitle);
  await replaceText(page, 'textarea[name="description"]', "项目组长已更新项目简介。");
  await clickSubmitForControl(page, "#edit-project-name");
  await waitUntil(page, (title) => (document.body?.innerText ?? "").includes(title), [leadEditedProjectTitle], 20000);

  await fillText(page, "#node-title", projectNodeTitle);
  await fillText(page, 'form:has(#node-title) textarea[name="description"]', `项目节点内容 ${runId}`);
  await clickSubmitForControl(page, "#node-title");
  await waitUntil(page, (nodeTitle) => {
    const text = document.body?.innerText ?? "";
    return text.includes(nodeTitle as unknown as string) && text.includes("进行中");
  }, [projectNodeTitle], 30000);
  await clickOpenDialogCancel(page, "归档项目");
  const archiveCancellation = await evaluate(page, () => ({
    stillActive: (document.body?.innerText ?? "").includes("进行中"),
    archiveStillAvailable: Array.from(document.querySelectorAll<HTMLButtonElement>("button"))
      .some((button) => button.textContent?.includes("归档项目")),
  })) as { stillActive: boolean; archiveStillAvailable: boolean };
  if (!archiveCancellation.stillActive || !archiveCancellation.archiveStillAvailable) {
    throw new Error(`archive dialog cancellation changed project state: ${JSON.stringify(archiveCancellation)}`);
  }
  const archiveAuditPrisma = new PrismaClient();
  let archiveAuditCount: number;
  try {
    archiveAuditCount = await archiveAuditPrisma.auditLog.count({
      where: { action: "UPDATE", entityType: "Project", entityId: browserProjectId ?? "" },
    });
  } finally {
    await archiveAuditPrisma.$disconnect();
  }
  await clickOpenDialogConfirm(page, "归档项目", "归档项目", true);
  await waitUntil(page, () => {
    const text = document.body?.innerText ?? "";
    return text.includes("项目已归档") && text.includes("已归档");
  }, [], 30000);
  const archivedPrisma = new PrismaClient();
  try {
    const nextArchiveAuditCount = await archivedPrisma.auditLog.count({
      where: { action: "UPDATE", entityType: "Project", entityId: browserProjectId ?? "" },
    });
    if (nextArchiveAuditCount !== archiveAuditCount + 1) {
      throw new Error(`archive duplicate-submit guard wrote ${nextArchiveAuditCount - archiveAuditCount} audit rows`);
    }
  } finally {
    await archivedPrisma.$disconnect();
  }

  await clearSession(page);
  await login(page, "e2e-vision-member-a", fixturePassword);
  await navigate(page, projectPath);
  const memberAccess = await waitUntil(page, () => {
    const text = document.body?.innerText ?? "";
    if (!text.includes("已归档")) return null;
    return {
      hasArchive: Array.from(document.querySelectorAll<HTMLButtonElement>("button")).some((button) => button.textContent?.includes("归档项目")),
      hasNodeForm: Boolean(document.querySelector("#node-title")),
      text,
    };
  }, [], 20000) as { hasArchive: boolean; hasNodeForm: boolean; text: string };
  if (memberAccess.hasArchive || memberAccess.hasNodeForm) {
    throw new Error(`ordinary member received archived project write controls: ${JSON.stringify(memberAccess)}`);
  }

  await clearSession(page);
  await login(page, adminUsername, adminPassword);
  await navigate(page, projectPath);
  await waitUntil(page, () => (document.body?.innerText ?? "").includes("永久删除"), [], 20000);
  await clickOpenDialogConfirm(page, "永久删除", "永久删除");
  await waitUntil(page, () => window.location.pathname === "/projects", [], 20000);

  const prisma = new PrismaClient();
  try {
    const remaining = await prisma.project.count({ where: { id: browserProjectId ?? "" } });
    if (remaining !== 0) throw new Error(`hard-deleted browser project still exists: ${browserProjectId}`);
  } finally {
    await prisma.$disconnect();
  }
  stage("project planning, node activation, lead archive, and member denial: passed");
}

async function verifyFixtureReadFlows(page: CdpClient) {
  stage("fixture UI: announcements, notifications, progress");
  await clearSession(page);
  await login(page, "e2e-master", fixturePassword);

  await navigate(page, "/");
  const dashboard = await waitUntil(page, () => {
    const count = document.querySelectorAll("[data-announcement-row]").length;
    return count === 3 ? { count, text: document.body?.innerText ?? "" } : null;
  }) as { count: number; text: string };
  if (dashboard.count !== 3) {
    throw new Error(`dashboard announcement pagination failed: ${JSON.stringify(dashboard)}`);
  }
  const hasRemovedSearch = await evaluate(page, () => Boolean(document.querySelector('input[placeholder="搜索公告、项目、成员"]')));
  if (hasRemovedSearch) throw new Error("removed global search control is still rendered");

  await navigate(page, "/announcements");
  const announcementPage = await waitUntil(page, () => {
    const count = document.querySelectorAll("[data-announcement-row]").length;
    return count === 10 ? { count, text: document.body?.innerText ?? "" } : null;
  }) as { count: number; text: string };
  if (announcementPage.count !== 10) {
    throw new Error(`announcement page size failed: ${JSON.stringify(announcementPage)}`);
  }

  await navigate(page, "/notifications");
  const notificationPage = await waitUntil(page, () => {
    const count = document.querySelectorAll("[data-notification-row]").length;
    return count === 5 ? { count, text: document.body?.innerText ?? "" } : null;
  }) as { count: number; text: string };
  if (notificationPage.count !== 5 || !notificationPage.text.includes("第 1 /")) {
    throw new Error(`notification page size failed: ${JSON.stringify(notificationPage)}`);
  }

  await navigate(page, "/progress");
  const progressText = await waitUntil(page, () => document.body?.innerText ?? "") as string;
  if (!progressText.includes("（本月）") || !progressText.includes("报告已提交，不能重复提交")) {
    throw new Error("current submitted progress state was not rendered");
  }

  stage("fixture UI: project preview, author selection, resizer persistence");
  await clearSession(page);
  await login(page, "e2e-vision-member-a", fixturePassword);
  await navigate(page, "/projects");
  const projectPath = await waitUntil(
    page,
    () => {
      const link = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href^="/projects/"]'))
        .find((candidate) => candidate.textContent?.includes("图像识别误检分析项目"));
      if (!link || !link.querySelector("[data-project-preview]")) return "";
      return new URL(link.href).pathname;
    },
  ) as string;
  await navigate(page, projectPath);
  await waitUntil(page, () => Boolean(document.querySelector("[data-project-commit-graph]")));
  await clickSelector(page, "[data-project-author-lane]");
  const selection = await waitUntil(page, () => {
    const total = document.querySelectorAll("[data-project-commit-row]").length;
    const selected = document.querySelectorAll('[data-project-commit-row][data-selected="true"]').length;
    return selected > 1 ? { total, selected } : null;
  }) as { total: number; selected: number };
  if (selection.selected >= selection.total) throw new Error("author selection did not dim other authors' nodes");

  const resizeState = await evaluate(page, () => {
    const separator = document.querySelector<HTMLElement>('[role="separator"][aria-label="调整作者栏宽度"]');
    if (!separator) throw new Error("missing author column separator");
    const before = Number(separator.getAttribute("aria-valuenow"));
    separator.focus();
    separator.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    return { before };
  });
  const persistedWidth = await waitUntil(page, (before) => {
    const separator = document.querySelector<HTMLElement>('[role="separator"][aria-label="调整作者栏宽度"]');
    const after = Number(separator?.getAttribute("aria-valuenow"));
    const stored = window.localStorage.getItem("lab-platform:project-commit-layout:v1");
    return after > before && stored ? { after, stored } : null;
  }, [resizeState.before]) as { after: number; stored: string };
  if (!persistedWidth.stored.includes(String(persistedWidth.after))) {
    throw new Error(`project column width was not persisted: ${JSON.stringify(persistedWidth)}`);
  }

  stage("fixture UI flows: passed");
}

async function cleanupBrowserArtifacts() {
  const prisma = new PrismaClient();
  try {
    const admin = await prisma.user.findUniqueOrThrow({
      where: { username: adminUsername },
      select: { id: true, displayName: true, studyDegree: true, status: true },
    });
    if (originalSettings) {
      await prisma.systemSetting.update({
        where: { id: "singleton" },
        data: { ...originalSettings, revision: { increment: 1 }, updatedById: admin.id, updatedBySnapshot: createActorSnapshot(admin) },
      });
      originalSettings = null;
    }

    const projects = await prisma.project.findMany({
      where: { name: { startsWith: "UI browser E2E project " } },
      select: { id: true },
    });
    const projectIds = [...new Set([
      ...projects.map((project) => project.id),
      ...(browserProjectId ? [browserProjectId] : []),
      ...(browserReassignmentProjectId ? [browserReassignmentProjectId] : []),
    ])];
    if (projects.length > 0) {
      for (const project of projects) {
        await prisma.$transaction((tx) => applyHardDeleteProject(
          tx as unknown as ProjectHardDeleteTransaction,
          { projectId: project.id, actorId: admin.id, actorSnapshot: createActorSnapshot(admin) },
        ));
      }
    }
    if (projectIds.length > 0) {
      await prisma.$transaction([
        prisma.notification.deleteMany({ where: { relatedType: "PROJECT", relatedId: { in: projectIds } } }),
        prisma.auditLog.deleteMany({ where: { entityId: { in: projectIds } } }),
      ]);
    }

    const users = await prisma.user.findMany({
      where: {
        OR: [
          { id: { in: [...createdUserIds] } },
          { username: { startsWith: "uiuser" }, displayName: { startsWith: "UI 真实用户 uiuser" } },
        ],
      },
      select: { id: true, username: true },
    });

    for (const user of users) {
      const result = await prisma.$transaction((tx) => deleteUserAccount(tx, user.id, {
        kind: "manual",
        actorId: admin.id,
        confirmUsername: user.username,
      }));
      if (result.deleted) await removeManagedAvatar(result.avatar).catch(() => undefined);
    }

    const [posts, announcements] = await Promise.all([
      prisma.post.findMany({ where: { title: { startsWith: "UI browser E2E post " } }, select: { id: true } }),
      prisma.announcement.findMany({ where: { title: { startsWith: "UI browser E2E announcement " } }, select: { id: true } }),
    ]);
    const postIds = posts.map((post) => post.id);
    const announcementIds = [...new Set([
      ...announcements.map((announcement) => announcement.id),
      ...(browserAnnouncementId ? [browserAnnouncementId] : []),
    ])];
    const comments = postIds.length > 0
      ? await prisma.comment.findMany({ where: { postId: { in: postIds } }, select: { id: true } })
      : [];
    const commentIds = comments.map((comment) => comment.id);
    const entityIds = [
      ...createdUserIds,
      ...projectIds,
      ...postIds,
      ...commentIds,
      ...announcementIds,
      ...(browserProgressReportId ? [browserProgressReportId] : []),
    ];
    await prisma.$transaction([
      prisma.notification.deleteMany({
        where: {
          OR: [
            { userId: { in: [...createdUserIds] } },
            { senderId: { in: [...createdUserIds] } },
            { relatedId: { in: entityIds } },
          ],
        },
      }),
      prisma.comment.deleteMany({ where: { id: { in: commentIds } } }),
      prisma.progressReport.deleteMany({ where: { id: { in: browserProgressReportId ? [browserProgressReportId] : [] } } }),
      prisma.post.deleteMany({ where: { id: { in: postIds } } }),
      prisma.announcement.deleteMany({ where: { id: { in: announcementIds } } }),
      prisma.auditLog.deleteMany({
        where: {
          OR: [
            { userId: { in: [...createdUserIds] } },
            { entityId: { in: entityIds } },
            { entityType: "SystemSetting", entityId: "singleton", createdAt: { gte: browserStartedAt } },
          ],
        },
      }),
    ]);
    await prisma.auditLog.deleteMany({
      where: {
        action: "IMPORT",
        entityType: "User",
        createdAt: { gte: browserStartedAt },
      },
    });
    stage(`cleanup browser artifacts (${users.length} user(s), ${projectIds.length} project id(s), ${postIds.length} post(s)): passed`);
  } finally {
    await prisma.$disconnect();
  }
}

async function captureScreenshot(page: CdpClient) {
  mkdirSync(".omx/reports", { recursive: true });
  // Headless CDP can report a 0-width layout viewport; pin device metrics so the
  // capture has a concrete size instead of failing with "0 width".
  await page.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  const result = await page.send<{ data: string }>("Page.captureScreenshot", {
    format: "png",
  });
  const path = `.omx/reports/browser-e2e-${runId}.png`;
  writeFileSync(path, Buffer.from(result.data, "base64"));
  return path;
}

function startChrome(userDataDir: string) {
  if (!existsSync(chromePath)) throw new Error(`Chrome executable not found: ${chromePath}`);
  return spawn(
    chromePath,
    [
      "--headless=new",
      `--remote-debugging-port=${chromePort}`,
      `--user-data-dir=${userDataDir}`,
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--no-first-run",
      "--no-default-browser-check",
      "--window-size=1440,1000",
      "about:blank",
    ],
    { stdio: "ignore" },
  );
}

async function stopChrome(chrome: ChildProcess, userDataDir: string) {
  chrome.kill();
  await wait(500);
  rmSync(userDataDir, { recursive: true, force: true });
}

async function main() {
  const userDataDir = mkdtempSync(join(tmpdir(), "lab-platform-chrome-"));
  const chrome = startChrome(userDataDir);
  let page: CdpClient | undefined;
  try {
    await waitForChrome(chromePort);
    page = await openPage(chromePort);
    await page.send("Page.enable");
    await page.send("Runtime.enable");
    await page.send("Network.enable");

    stage(`run ${runId}`);
    await login(page, adminUsername, adminPassword);
    const projectPath = await createDelegatedProject(page);
    const importedUserId = await verifyExcelTemplateAndImport(page, userDataDir);
    const masterUserId = await createMemberInAdmin(page, {
      username,
      displayName: `UI 真实用户 ${username}`,
      password: tempPassword,
      studentId,
      studyDegree: "MASTER",
      studyGrade: "MASTER_1",
    });
    const doctorUserId = await createMemberInAdmin(page, {
      username: doctorUsername,
      displayName: `UI 真实用户 ${doctorUsername}`,
      password: doctorPassword,
      studentId: doctorStudentId,
      studyDegree: "DOCTOR",
      studyGrade: "DOCTOR_1",
    });
    await createMemberInAdmin(page, {
      username: mentorUsername,
      displayName: `UI 真实用户 ${mentorUsername}`,
      password: mentorPassword,
      studentId: mentorEmployeeId,
      studyDegree: "MENTOR",
    });
    await verifyImmediateTagPageSync(page);
    await editCreatedMemberIdentity(page, masterUserId);
    const reassignmentProjectPath = await createLeaderReassignmentProject(page, masterUserId, importedUserId);
    await verifyAuditTime(page);
    await clearSession(page);
    await login(page, username, tempPassword);
    await changeFirstPassword(page);
    await login(page, username, finalPassword);
    await verifyAvatarWorkflow(page, masterUserId);
    await createPost(page);
    await createCommentOnPost(page);
    await replyToCreatedComment(page);
    await verifyAdminNotification(page);
    await clearSession(page);
    await login(page, mentorUsername, mentorPassword);
    await changeFirstPassword(page, mentorPassword, mentorFinalPassword);
    await verifyAnnouncementLifecycle(page);
    await verifyProjectLifecycle(page, projectPath);
    await verifySettingsProgressWindow(page);
    await verifyFixtureReadFlows(page);
    await verifyGraduationLifecycle(page, doctorUserId);
    await verifyPermanentDeleteHistory(page, masterUserId);
    await verifyProjectLeaderReassignment(page, reassignmentProjectPath, importedUserId);
    const screenshot = await captureScreenshot(page);

    console.log(
      JSON.stringify(
        {
          baseUrl,
          username,
          studentId,
          tempPasswordSet: Boolean(tempPassword),
          finalPasswordSet: Boolean(finalPassword),
          postTitle,
          commentText,
          replyText,
          delegatedProjectLifecycle: true,
          projectStatusDerivedFromNodes: true,
          projectLeadArchiveConfirmed: true,
          announcementOwnerEditPersisted: true,
          crossAdvisorEditDenied: true,
          avatarCropAndNavigationSync: true,
          createdMasterDoctorMentorWithIdentityTags: true,
          adminIdentityEdit: true,
          persistedSettingsDriveProgressWindow: true,
          permanentDeleteRetainsPostAttribution: true,
          deletedAttributionUsesExactAccountDeletedLabel: true,
          deletedProjectLeaderWarningVisible: true,
          unauthorizedLeaderReassignmentDenied: true,
          leaderReassignmentSucceeded: true,
          destructiveDialogCancellation: true,
          duplicateSubmitPrevented: true,
          excelTemplateDownloadAndImport: true,
          graduationConfirmedAndLoginRejected: true,
          auditShanghaiTime: true,
          adminNotificationFanout: true,
          replyCollapsedAndReset: true,
          hostilePostRenderedSafely: true,
          fixtureReadFlows: true,
          finalPath: await evaluate(page, () => window.location.pathname),
          screenshot,
        },
        null,
        2,
      ),
    );
  } finally {
    page?.close();
    try {
      await stopChrome(chrome, userDataDir);
    } finally {
      await cleanupBrowserArtifacts();
    }
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
