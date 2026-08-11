/** Shared content types for the Arknights: Endfield clone. */

/** Combat class shown on the operator card. Matches `operator.prof.*` strings. */
export type OperatorProfession =
  | "assault"
  | "caster"
  | "guard"
  | "shielder"
  | "support"
  | "vanguard";

/** Damage element shown on the operator card. Matches `operator.elem.*` strings. */
export type OperatorElement =
  | "electric"
  | "fire"
  | "ice"
  | "nature"
  | "physic";

export interface Operator {
  /** Stable slug used for assets and i18n lookups, e.g. `"lizhiyan"`. */
  key: string;
  /** Latin codename displayed above the portrait, e.g. `"Arcane"`. */
  codename: string;
  /** Localised display name, e.g. `"诀"`. */
  name: string;
  /** Multi-paragraph biography; paragraphs are separated by `\n`. */
  intro: string;
  /** Index into `OperatorData.camps`. */
  camp: number;
  /** Index into `OperatorData.races`. */
  race: number;
  /** Star rating, 4–6. */
  rarity: 4 | 5 | 6;
  prof: OperatorProfession;
  elem: OperatorElement;
  /** 120x120 circular thumbnail for the switcher rail. */
  avatar: string | null;
  /** 303x386 portrait card. */
  card: string | null;
  /** 1760x1548 full illustration used by the 2D view. */
  illustration: string | null;
  /** CDN-relative path to the one-shot entrance clip. */
  enterVideo: string | null;
  /** CDN-relative path to the looping idle clip. */
  idleVideo: string | null;
  /** Lets a platform record keep its own stable key while borrowing a reference visual. */
  visualKey?: string;
  /** Optional live-product labels rendered by the shared Endfield panels. */
  presentation?: {
    metadata: readonly { label: string; value: string }[];
    secondaryLabels: readonly string[];
  };
}

export interface OperatorData {
  /** Faction names, indexed by `Operator.camp`. */
  camps: string[];
  /** Race names, indexed by `Operator.race`. */
  races: string[];
  operators: Operator[];
}

/** A tab in the 06-Notice section. */
export type BulletinTab = "notices" | "news" | "events";

/** One entry from `web-news.hypergryph.com/api/bulletin`. */
export interface BulletinItem {
  cid: string;
  tab: BulletinTab;
  sticky: boolean;
  title: string;
  author: string;
  /** Unix seconds. */
  displayTime: number;
  cover: string;
  extraCover: string;
  brief: string;
}

export interface BulletinResponse {
  code: number;
  msg: string;
  data: { list: BulletinItem[] };
}

/** Video categories in the 04-Information section. */
export type MediaCategory = "VERSION" | "CHARACTER" | "SPECIAL";

/** A generic titled item used by 05-Gameplay and 08-AIC. */
export interface FeatureItem {
  title: string;
  description: string;
  image?: string;
}

/** One of the eight stacked page sections, in visual order. */
export type SectionId =
  | "home"
  | "operator"
  | "lore"
  | "information"
  | "calendar"
  | "gameplay"
  | "aic"
  | "notice";
