/**
 * Trailer catalogue for the 04-Information section.
 *
 * The 20 MP4s the site plays in its media modal are CMS uploads served from
 * `web.hycdn.cn/upload/video/<YYYYMMDD>/<hash>.mp4` (up to ~337 MB each), so
 * they are streamed rather than vendored — see `scripts/cdn-video-urls.txt`.
 *
 * What the CDN paths actually tell us is the **publish date**, and nothing
 * else: there is no title, no category and no cover reference in the URL. So:
 *
 * - `date` is parsed straight out of the path segment and rendered with the
 *   site's own `information.displayTimeFormat` pattern.
 * - `title` is composed from that date plus the category label. No marketing
 *   copy is invented here.
 * - `category` is our own deterministic grouping (the three site categories
 *   cycled over the date-ordered list) because the CDN carries no such tag.
 * - `poster` is one of the real CMS stills vendored under `/images/cms`,
 *   paired to the trailers in publish-date order. The CMS gives no
 *   cover-to-trailer mapping, so the pairing is positional; the final trailer
 *   reuses the last still because there are 19 trailers and 18 stills.
 *
 * One of the 20 URLs is the section's ambience loop rather than a trailer, and
 * is exported separately as `backgroundVideoUrl`.
 */
import type { MediaCategory } from "@/types/site";
import { t } from "@/content";

export interface MediaItem {
  /** Stable key: the CDN date segment plus the first 8 chars of the hash. */
  id: string;
  /** Which of the three site categories this trailer is filed under. */
  category: MediaCategory;
  /** Localised category label, e.g. `"版本PV"`. */
  categoryLabel: string;
  /** Publish date formatted with `information.displayTimeFormat`. */
  date: string;
  /** Card and modal heading, derived from date + category. */
  title: string;
  /** Streaming MP4 on the origin CDN. */
  src: string;
  /** Vendored CMS still used as the card art and the modal poster. */
  poster: string;
}

/** The muted ambience loop that runs behind the whole section. */
export const backgroundVideoUrl =
  "https://web.hycdn.cn/upload/video/20260710/b37e139e9494bd716410c7fa8a7f39ca.mp4";

/** CDN date segment + file name, in publish order. */
const TRAILER_PATHS: readonly string[] = [
  "20260303/189cdae5338591753609aaffb9543df2.mp4",
  "20260303/bd9793adc1bdbbd946c7bf413faae56f.mp4",
  "20260312/cb5fa425565cf2852cdb9eabdabf250a.mp4",
  "20260312/d9bad1882d6d74a6db532747fa741cce.mp4",
  "20260327/0de519a0d94e9241c26b73132ff6d2bd.mp4",
  "20260327/6c22dfbd49c0b3787d948819bf315260.mp4",
  "20260411/b7a641750de2947491aada86f7c302eb.mp4",
  "20260411/c9a70d82c6a4d896046e6594e8f0ed80.mp4",
  "20260416/2ad0a60412eb2cb298b96c9f77a86052.mp4",
  "20260416/ed1866f9752d51ef06105b9b97bea923.mp4",
  "20260522/4c6b963722105991cd49e846a779b489.mp4",
  "20260522/daa424b2bd015f67bfbf863594ac3324.mp4",
  "20260602/436a0c9185d1b40006fe6574062f9e32.mp4",
  "20260602/db445d307e19ea5df70bd039f53b586b.mp4",
  "20260624/2eeff09a0c9fbda22d62ae1a352c9850.mp4",
  "20260624/76a422d1140dadf2b57ea7f1eb197275.mp4",
  "20260710/e8d8075648248beac16cc94f0591297e.mp4",
  "20260714/00240a644851abbdf0153120ebb5e26f.mp4",
  "20260714/bec3f62887893932812e48502969027e.mp4",
];

/** Real CMS stills vendored under `public/images/cms`, in publish order. */
const COVERS: readonly string[] = [
  "20260303-418b73ff34245a937c7db67b082a8a18.jpg",
  "20260312-ae7b296513b1bf28d6fc66181a46d63e.png",
  "20260327-09077cb6f1c03328a89fc3d65ad0dc04.jpg",
  "20260411-dde7c30f64cb985113539ec6c7a03c38.jpg",
  "20260416-357e2dff498d2d67905864c6863ce8e5.png",
  "20260522-ce183308cef90060fb45bf3b48cf2b9a.png",
  "20260602-38ce571934dafe453b9f0a6033f353bc.jpg",
  "20260624-eb1662f1d08bdd804d3e29a904b1b1b2.png",
  "20260707-9ff7c1725355749cff77b5e7718ce2e9.jpg",
  "20260710-0ffe54e3ecf2e1eae71e4e67afe9514d.jpg",
  "20260714-e4c3c1219db9fe092bbb6a8df8bc265a.png",
  "20260715-093954f7fa35a27aa3e79702ef6f3edb.jpg",
  "20260715-a816d526872e655f6324a2f026e6be2f.jpg",
  "20260716-19894e902a41f9a1c4cb00079abedeb7.jpg",
  "20260717-3f48e2990c87ea0611f5d82ede622d96.jpg",
  "20260718-03e19620fbbb1b4a974055720158cc00.png",
  "20260730-582e9e65b618415860f7771e8b439325.jpg",
  "20260730-9e816139877ce8a07a30b1d001d7341d.jpg",
];

/** The three site categories, cycled over the date-ordered trailer list. */
export const MEDIA_CATEGORIES: readonly MediaCategory[] = [
  "VERSION",
  "CHARACTER",
  "SPECIAL",
];

/** Renders `YYYYMMDD` through the site's own `YYYY.MM.DD` pattern. */
function formatDisplayTime(compact: string): string {
  return t("information.displayTimeFormat")
    .replace("YYYY", compact.slice(0, 4))
    .replace("MM", compact.slice(4, 6))
    .replace("DD", compact.slice(6, 8));
}

/** Localised label for a category, e.g. `"角色展示"`. */
export function categoryLabel(category: MediaCategory): string {
  return t(`information.cate.${category}`);
}

export const mediaItems: MediaItem[] = TRAILER_PATHS.map((path, index) => {
  const [segment, file] = path.split("/");
  const category = MEDIA_CATEGORIES[index % MEDIA_CATEGORIES.length];
  const label = categoryLabel(category);
  const date = formatDisplayTime(segment);

  return {
    id: `${segment}-${file.slice(0, 8)}`,
    category,
    categoryLabel: label,
    date,
    title: `${date} ${label}`,
    src: `https://web.hycdn.cn/upload/video/${path}`,
    poster: `/images/cms/${COVERS[Math.min(index, COVERS.length - 1)]}`,
  };
});
