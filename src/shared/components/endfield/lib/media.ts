/**
 * Asset resolution for the Endfield clone.
 *
 * Images and fonts are vendored into `public/`. Video is streamed from the
 * origin CDN, exactly as the real site does — the 31 operator entrance/idle
 * clips alone are ~750 MB, which does not belong in git.
 *
 * To vendor video locally instead: download the files listed in
 * `scripts/asset-urls.txt` (re-add the `static/media/video/` lines) plus
 * `scripts/cdn-video-urls.txt`, then set `USE_LOCAL_VIDEO` to `true`.
 */

const CDN_BASE = "https://web.hycdn.cn/endfield/official-v4/_next/";

const USE_LOCAL_VIDEO = false;

/**
 * Resolves a bundle-relative asset path (e.g. `"static/media/video/enter.a66d56.mp4"`)
 * to a playable URL.
 */
export function videoUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http") || path.startsWith("/")) return path;
  if (USE_LOCAL_VIDEO) return `/videos/${path.split("/").pop()}`;
  return CDN_BASE + path;
}

/** Resolves a CMS upload URL (news covers, PV trailers) served from the CDN. */
export function cdnUrl(path: string): string {
  return path.startsWith("http") ? path : `https://web.hycdn.cn/${path.replace(/^\/+/, "")}`;
}
