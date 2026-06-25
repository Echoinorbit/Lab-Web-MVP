import { loadEnvConfig } from "@next/env";

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

async function login(username: string, password: string) {
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

async function expectStatus(username: string, jar: CookieJar, path: string, expected: number) {
  const response = await request(path, jar);
  if (response.status !== expected) {
    throw new Error(`${username}: expected ${path} -> ${expected}, got ${response.status}`);
  }
  return response;
}

async function expectNotStatus(username: string, jar: CookieJar, path: string, forbidden: number) {
  const response = await request(path, jar);
  if (response.status === forbidden) {
    throw new Error(`${username}: expected ${path} not to return ${forbidden}`);
  }
  return response;
}

async function main() {
  const admin = await login(adminUsername, adminPassword);
  await expectStatus(adminUsername, admin, "/", 200);
  await expectStatus(adminUsername, admin, "/admin/audit", 200);

  const master = await login("e2e-master", fixturePassword);
  await expectStatus("e2e-master", master, "/", 200);
  await expectStatus("e2e-master", master, "/posts", 200);
  await expectStatus("e2e-master", master, "/progress", 200);
  await expectNotStatus("e2e-master", master, "/admin/users", 200);
  const notifications = await expectStatus("e2e-master", master, "/api/notifications", 200);
  const notificationRows = (await notifications.json()) as unknown[];
  if (!Array.isArray(notificationRows) || notificationRows.length === 0) {
    throw new Error("e2e-master: expected non-empty notification rows");
  }

  const advisor = await login("e2e-advisor", fixturePassword);
  await expectStatus("e2e-advisor", advisor, "/announcements", 200);
  await expectStatus("e2e-advisor", advisor, "/projects", 200);

  const progressMgr = await login("e2e-progress-mgr", fixturePassword);
  await expectStatus("e2e-progress-mgr", progressMgr, "/progress", 200);

  const visionLead = await login("e2e-vision-lead", fixturePassword);
  await expectStatus("e2e-vision-lead", visionLead, "/projects", 200);
  await expectStatus("e2e-vision-lead", visionLead, "/progress", 200);
  await expectNotStatus("e2e-vision-lead", visionLead, "/admin/tags", 200);

  const visionMember = await login("e2e-vision-member-a", fixturePassword);
  await expectStatus("e2e-vision-member-a", visionMember, "/projects", 200);
  await expectStatus("e2e-vision-member-a", visionMember, "/posts", 200);
  await expectNotStatus("e2e-vision-member-a", visionMember, "/admin/users", 200);

  console.log(
    JSON.stringify(
      {
        baseUrl,
        checks: [
          `${adminUsername} dashboard/audit 200`,
          "e2e-master read pages 200, admin/users rejected, notifications non-empty",
          "e2e-advisor announcements/projects 200",
          "e2e-progress-mgr progress 200",
          "e2e-vision-lead projects/progress 200, admin/tags rejected",
          "e2e-vision-member-a projects/posts 200, admin/users rejected",
        ],
        notificationRows: notificationRows.length,
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
