import type { BulletinItem, BulletinResponse } from "@/types/site";
import fallback from "@/content/bulletin-fallback.json";

const ENDPOINT = "https://web-news.hypergryph.com/api/bulletin";

/**
 * Loads the news/announcement feed from the same public endpoint the target
 * site calls.
 *
 * The upstream is a third party we do not control, so a snapshot captured
 * during extraction ships alongside and is returned when the request fails —
 * the section is content-critical and rendering an empty board would look like
 * a bug rather than an outage.
 */
export async function fetchBulletin(
  page = 1,
  pageSize = 10,
): Promise<BulletinItem[]> {
  const url = `${ENDPOINT}?lang=zh-cn&code=endfield_web&page=${page}&pageSize=${pageSize}`;

  try {
    const res = await fetch(url, {
      headers: { Referer: "https://endfield.hypergryph.com/" },
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`bulletin: HTTP ${res.status}`);

    const body = (await res.json()) as BulletinResponse;
    const list = body?.data?.list;
    if (!Array.isArray(list) || list.length === 0) {
      throw new Error("bulletin: empty list");
    }
    return list;
  } catch {
    return fallback as BulletinItem[];
  }
}
