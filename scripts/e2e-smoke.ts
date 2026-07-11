import { loadEnvConfig } from "@next/env";

import type { NotificationPageData } from "../src/features/notifications/types";

loadEnvConfig(process.cwd());

const baseUrl = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const fixturePassword = process.env.E2E_FIXTURE_PASSWORD ?? "Test.pass.123";
const adminUsername = process.env.E2E_ADMIN_USERNAME ?? process.env.ADMIN_USERNAME ?? "admin";
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? process.env.ADMIN_PASSWORD ?? fixturePassword;

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

async function request(path: string, jar: CookieJar, init: RequestInit = {}) {
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

async function attemptLogin(username: string, password: string) {
  const jar: CookieJar = new Map();
  const csrfResponse = await request("/api/auth/csrf", jar);
  if (csrfResponse.status !== 200) throw new Error(`${username}: csrf failed with ${csrfResponse.status}`);
  const csrf = (await csrfResponse.json()) as { csrfToken?: string };
  if (!csrf.csrfToken) throw new Error(`${username}: missing csrf token`);

  const body = new URLSearchParams({
    csrfToken: csrf.csrfToken,
    username,
    password,
    callbackUrl: `${baseUrl}/`,
    json: "true",
  });

  const loginResponse = await request("/api/auth/callback/credentials", jar, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (loginResponse.status !== 200 && loginResponse.status !== 302) {
    throw new Error(`${username}: login failed with ${loginResponse.status}`);
  }
  return jar;
}

async function hasAuthenticatedSession(jar: CookieJar) {
  const sessionResponse = await request("/api/auth/session", jar);
  if (sessionResponse.status !== 200) throw new Error(`session lookup failed with ${sessionResponse.status}`);
  const session = (await sessionResponse.json()) as { user?: { id?: string } } | null;
  return Boolean(session?.user?.id);
}

async function login(username: string, password: string) {
  const jar = await attemptLogin(username, password);
  if (!(await hasAuthenticatedSession(jar))) throw new Error(`${username}: credentials did not create an authenticated session`);
  return jar;
}

async function expectLoginRejected(username: string, password: string) {
  const jar = await attemptLogin(username, password);
  if (await hasAuthenticatedSession(jar)) throw new Error(`${username}: expected login to be rejected`);
}

async function expectStatus(username: string, jar: CookieJar, path: string, expected: number) {
  const response = await request(path, jar);
  if (response.status !== expected) {
    throw new Error(`${username}: expected ${path} -> ${expected}, got ${response.status}`);
  }
  return response;
}

async function expectAccessDenied(username: string, jar: CookieJar, path: string, protectedMarker: string) {
  const response = await request(path, jar);
  if (response.status >= 300 && response.status < 400) {
    if (response.headers.get("location") !== "/403") {
      throw new Error(`${username}: expected ${path} to redirect to /403, got ${response.headers.get("location")}`);
    }
    return response;
  }
  if (response.status === 200) {
    const body = await response.text();
    if (!body.includes("NEXT_REDIRECT") || (!body.includes("/403") && !body.includes("\\u002f403")) || body.includes(protectedMarker)) {
      throw new Error(`${username}: ${path} rendered protected content instead of a streamed /403 redirect`);
    }
    return response;
  }
  throw new Error(`${username}: expected ${path} to be denied, got ${response.status}`);
}

async function expectBodyContains(username: string, jar: CookieJar, path: string, expected: string) {
  const response = await expectStatus(username, jar, path, 200);
  const body = await response.text();
  if (!body.includes(expected)) throw new Error(`${username}: expected ${path} to contain ${expected}`);
  return body;
}

function assertNotificationPage(value: unknown, expectedPage: number): asserts value is NotificationPageData {
  if (!value || typeof value !== "object") throw new Error("notification API returned a non-object envelope");
  const page = value as Partial<NotificationPageData>;
  if (!Array.isArray(page.items)) throw new Error("notification API envelope is missing items");
  if (page.page !== expectedPage || page.pageSize !== 5) {
    throw new Error(`notification API expected page ${expectedPage} with pageSize 5, got ${page.page}/${page.pageSize}`);
  }
  if (typeof page.total !== "number" || typeof page.totalPages !== "number" || typeof page.unreadCount !== "number") {
    throw new Error("notification API envelope is missing pagination totals");
  }
}

function countRenderedMarkers(body: string, marker: string) {
  const escapedMarker = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return body.match(new RegExp(`<[a-zA-Z][^>]*\\s${escapedMarker}(?:="[^"]*")?[^>]*>`, "g"))?.length ?? 0;
}

async function main() {
  const admin = await login(adminUsername, adminPassword);
  await expectStatus(adminUsername, admin, "/", 200);
  await expectStatus(adminUsername, admin, "/admin/audit", 200);
  const adminProjectForm = await expectBodyContains(adminUsername, admin, "/projects/new", "负责导师");
  if (!adminProjectForm.includes("e2e-advisor") || !adminProjectForm.includes("选择负责导师")) {
    throw new Error(`${adminUsername}: delegated project form did not expose advisor selection`);
  }
  const dashboard = await expectBodyContains(adminUsername, admin, "/", "E2E 公告 15");
  const dashboardAnnouncementRows = countRenderedMarkers(dashboard, "data-announcement-row");
  if (dashboardAnnouncementRows !== 3) {
    throw new Error(`${adminUsername}: dashboard expected 3 announcement rows, got ${dashboardAnnouncementRows}`);
  }
  if (dashboard.includes("搜索公告、项目、成员")) {
    throw new Error(`${adminUsername}: removed global search control is still rendered`);
  }

  const master = await login("e2e-master", fixturePassword);
  await expectStatus("e2e-master", master, "/", 200);
  await expectStatus("e2e-master", master, "/posts", 200);
  const progressBody = await expectBodyContains("e2e-master", master, "/progress", "（本月）");
  if (!progressBody.includes("报告已提交，不能重复提交")) {
    throw new Error("e2e-master: submitted progress report state was not rendered");
  }
  await expectAccessDenied("e2e-master", master, "/admin/users", "账号与身份");
  const notifications = await expectStatus("e2e-master", master, "/api/notifications", 200);
  const notificationPageOne = (await notifications.json()) as unknown;
  assertNotificationPage(notificationPageOne, 1);
  if (notificationPageOne.items.length !== 5 || notificationPageOne.total < 15 || notificationPageOne.totalPages < 3) {
    throw new Error("e2e-master: expected at least three five-item notification pages");
  }
  const notificationPageTwoResponse = await expectStatus("e2e-master", master, "/api/notifications?page=2", 200);
  const notificationPageTwo = (await notificationPageTwoResponse.json()) as unknown;
  assertNotificationPage(notificationPageTwo, 2);
  if (notificationPageTwo.items.length !== 5) throw new Error("e2e-master: expected five notification rows on page two");
  const malformedPageResponse = await expectStatus("e2e-master", master, "/api/notifications?page=-99", 200);
  const malformedPage = (await malformedPageResponse.json()) as unknown;
  assertNotificationPage(malformedPage, 1);

  const advisor = await login("e2e-advisor", fixturePassword);
  const announcementPageOne = await expectBodyContains("e2e-advisor", advisor, "/announcements", "E2E 公告 15");
  const announcementPageOneRows = countRenderedMarkers(announcementPageOne, "data-announcement-row");
  if (announcementPageOneRows !== 10) {
    throw new Error(`e2e-advisor: announcement page one expected 10 rows, got ${announcementPageOneRows}`);
  }
  const announcementPageTwoResponse = await expectStatus("e2e-advisor", advisor, "/announcements?page=2", 200);
  const announcementPageTwo = await announcementPageTwoResponse.text();
  const announcementPageTwoRows = countRenderedMarkers(announcementPageTwo, "data-announcement-row");
  if (announcementPageTwoRows < 1 || announcementPageTwoRows > 10) {
    throw new Error(`e2e-advisor: announcement page two expected 1-10 rows, got ${announcementPageTwoRows}`);
  }
  await expectStatus("e2e-advisor", advisor, "/projects", 200);

  const progressMgr = await login("e2e-progress-mgr", fixturePassword);
  await expectStatus("e2e-progress-mgr", progressMgr, "/progress", 200);

  const visionLead = await login("e2e-vision-lead", fixturePassword);
  await expectStatus("e2e-vision-lead", visionLead, "/projects", 200);
  await expectStatus("e2e-vision-lead", visionLead, "/progress", 200);
  await expectAccessDenied("e2e-vision-lead", visionLead, "/admin/tags", "全局 Tag 清单");

  const visionMember = await login("e2e-vision-member-a", fixturePassword);
  const memberProjects = await expectBodyContains("e2e-vision-member-a", visionMember, "/projects", "图像识别误检分析项目");
  if (!memberProjects.includes("data-project-preview")) {
    throw new Error("e2e-vision-member-a: own project did not render its preview surface");
  }
  await expectStatus("e2e-vision-member-a", visionMember, "/posts", 200);
  await expectAccessDenied("e2e-vision-member-a", visionMember, "/admin/users", "账号与身份");
  await expectLoginRejected("e2e-graduated", fixturePassword);

  console.log(
    JSON.stringify(
      {
        baseUrl,
        checks: [
          `${adminUsername} dashboard/audit 200`,
          "dashboard renders 3 announcements; announcement pages render at most 10",
          "e2e-master current progress state and three notification pages verified",
          "e2e-advisor announcements/projects 200",
          "e2e-progress-mgr progress 200",
          "e2e-vision-lead projects/progress 200, admin/tags rejected",
          "e2e-vision-member-a project preview/posts 200, admin/users rejected",
          "e2e-graduated login rejected",
        ],
        notificationRows: notificationPageOne.total,
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
