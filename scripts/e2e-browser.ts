import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const baseUrl = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const chromePath = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const chromePort = Number(process.env.E2E_CHROME_PORT ?? 9224);
const runId = Date.now().toString(36);
const username = `uiuser${runId}`;
const studentId = `UI${runId.toUpperCase()}`;
const fixturePassword = process.env.E2E_FIXTURE_PASSWORD ?? "Test.pass.123";
const adminUsername = process.env.E2E_ADMIN_USERNAME ?? process.env.ADMIN_USERNAME ?? "admin";
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? process.env.ADMIN_PASSWORD ?? fixturePassword;
const tempPassword = process.env.E2E_TEMP_PASSWORD ?? `Rough.Pass.${runId}!`;
const finalPassword = process.env.E2E_FINAL_PASSWORD ?? `Changed.Pass.${runId}!`;
const postTitle = `UI browser E2E post ${runId}`;
const commentText = `UI browser E2E comment ${runId}`;
const cdpCommandTimeoutMs = Number(process.env.E2E_CDP_TIMEOUT_MS ?? 20000);

type Pending = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

type CookieJar = Map<string, string>;

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

async function login(page: CdpClient, loginUsername: string, password: string) {
  stage(`login ${loginUsername}`);
  const jar = await getLoginCookies(loginUsername, password);
  await page.send("Network.clearBrowserCookies");
  for (const [name, value] of jar.entries()) {
    await page.send("Network.setCookie", { url: baseUrl, name, value });
  }
  await navigate(page, "/");
  await waitUntil(page, () => window.location.pathname !== "/login", [], 15000);
}

async function clearSession(page: CdpClient) {
  await page.send("Network.clearBrowserCookies");
  await page.send("Network.clearBrowserCache");
}

async function createMemberInAdmin(page: CdpClient) {
  stage("admin create member: open page");
  await navigate(page, "/admin/users");
  await waitUntil(page, () => Boolean(document.querySelector("#admin-username")), [], 15000);
  await wait(2000);
  stage("admin create member: fill fields");
  await fillText(page, "#admin-username", username);
  await fillText(page, "#admin-name", `UI 真实用户 ${username}`);
  await fillText(page, "#admin-password", tempPassword);
  await fillText(page, "#admin-student-id", studentId);
  await fillText(page, "#admin-grade", "2026级");
  stage("admin create member: submit");
  await clickSubmitForControl(page, "#admin-username");
  await waitUntil(
    page,
    (user) => {
      const text = document.body?.innerText ?? "";
      return text.includes("成员已创建") || text.includes(user);
    },
    [username],
    30000,
  );
  stage("admin create member: passed");
}

async function grantMasterTag(page: CdpClient) {
  stage("admin grant tag: open page");
  await navigate(page, "/admin/tags");
  await wait(2000);
  await waitUntil(page, (user) => (document.body?.innerText ?? "").includes(user), [username], 15000);
  stage("admin grant tag: select and submit");
  await selectOptionByText(page, 'select[name="userId"]', username);
  await selectOptionByText(page, 'select[name="tagId"]', "grad-master");
  await clickSubmitForControl(page, 'select[name="userId"]');
  await waitUntil(page, () => (document.body?.innerText ?? "").includes("Tag 已授予"), [], 20000);
  stage("admin grant tag: passed");
}

async function changeFirstPassword(page: CdpClient) {
  stage("change first password");
  await waitUntil(page, () => window.location.pathname === "/change-password", [], 15000);
  await wait(2000);
  await fillText(page, "#currentPassword", tempPassword);
  await fillText(page, "#newPassword", finalPassword);
  await fillText(page, "#confirmPassword", finalPassword);
  await clickSubmitForControl(page, "#currentPassword");
  await waitUntil(page, () => window.location.pathname === "/login", [], 20000);
  stage("change first password: passed");
}

async function createPost(page: CdpClient) {
  stage("create post: open page");
  await navigate(page, "/posts");
  await waitUntil(page, () => Boolean(document.querySelector("#post-title")), [], 15000);
  await wait(2000);
  await fillText(page, "#post-title", postTitle);
  await fillText(page, "#post-tags", "ui-e2e, browser");
  await selectOptionByText(page, "#post-category", "讨论");
  await fillText(page, "textarea", "这是一条通过真实 headless Chrome 浏览器提交的站内帖子。");
  stage("create post: submit");
  await clickSubmitForControl(page, "#post-title");
  await waitUntil(page, () => window.location.pathname.startsWith("/posts/"), [], 20000);
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
    await createMemberInAdmin(page);
    await grantMasterTag(page);
    await clearSession(page);
    await login(page, username, tempPassword);
    await changeFirstPassword(page);
    await login(page, username, finalPassword);
    await createPost(page);
    await createCommentOnPost(page);
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
          finalPath: await evaluate(page, () => window.location.pathname),
          screenshot,
        },
        null,
        2,
      ),
    );
  } finally {
    page?.close();
    await stopChrome(chrome, userDataDir);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
