/**
 * Vector furniture shared by 05-Gameplay and 08-AIC.
 *
 * The production bundle inlines these as SVG sprites, so there is no file in
 * `public/images` to point at. They are redrawn here at the same optical weight
 * and all sizing comes from the section CSS, exactly as `Header/HeaderIcons`
 * does for the nav rail.
 */
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

/**
 * The "ENDFIELD" wordmark. Used at 15.625rem tall in the `.endfieldPre` strip,
 * at 22.125rem wide on the album's yellow `.rightDeco` blade and at 15.3125rem
 * wide on the portrait `.H5DecoLine`.
 */
export function EndfieldWordmark(props: IconProps) {
  return (
    <svg viewBox="0 0 354 40" role="img" aria-label="ENDFIELD" {...props}>
      <text
        x="0"
        y="32"
        fill="currentColor"
        fontFamily="Novecentosanswide-DemiBold, sans-serif"
        fontSize="40"
        letterSpacing="1.5"
      >
        ENDFIELD
      </text>
    </svg>
  );
}

/** Three stacked squares — the small `.blocks` mark under `.decoLeft .title`. */
export function DecoBlocks(props: IconProps) {
  return (
    <svg viewBox="0 0 63 58" aria-hidden="true" {...props}>
      <g fill="currentColor">
        <rect x="0" y="0" width="17" height="17" />
        <rect x="23" y="0" width="17" height="17" />
        <rect x="23" y="23" width="17" height="17" />
        <rect x="46" y="23" width="17" height="17" />
        <rect x="46" y="41" width="17" height="17" />
      </g>
    </svg>
  );
}

/** Crossed tools — the 05-Gameplay section glyph. */
export function GameplayGlyph(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M4 20 20 4M14 4h6v6M4 8V4h4M8 14l6 6" />
    </svg>
  );
}

/** Factory silhouette — the 08-AIC section glyph. */
export function AicGlyph(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M3 20V10l6 4V10l6 4V6l6 3v11z" />
      <path d="M3 20h18" />
    </svg>
  );
}

/** Left-pointing chevron used by both pagination buttons (the right one is
 *  mirrored by `.arrow.right`). */
export function PaginationArrow(props: IconProps) {
  return (
    <svg
      viewBox="0 0 12 18"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      {...props}
    >
      <path d="M10 1 2 9l8 8" />
    </svg>
  );
}
