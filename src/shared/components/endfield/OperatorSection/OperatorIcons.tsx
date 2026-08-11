/**
 * Inline SVG glyphs for 02-Operator.
 *
 * The production markup loads these as sprite symbols that the CSS only ever
 * sizes and colours (`width`, `height`, `color`), so each one is redrawn here
 * against the same box the extracted rules expect and paints with
 * `currentColor`.
 */

interface GlyphProps {
  className?: string;
}

const CHEVRON_TICKS = [40, 47, 54, 61, 68, 75, 82, 89, 96, 103, 110, 117, 124, 131, 138, 145, 152];

/**
 * The tick strip that trails the `[ REC ]` label. Drawn on a 160x20 box so the
 * CSS `width: 10rem; height: auto` resolves to the extracted proportions.
 */
export function RecTicksIcon({ className }: GlyphProps) {
  return (
    <svg className={className} viewBox="0 0 160 20" fill="none" aria-hidden="true">
      <path
        d="M2 4 L8 10 L2 16 M12 4 L18 10 L12 16 M22 4 L28 10 L22 16"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      {CHEVRON_TICKS.map((x) => (
        <rect key={x} x={x} y="8" width="2" height="4" fill="currentColor" />
      ))}
    </svg>
  );
}

const RULE_BLOCKS = [0, 18, 36, 54, 78, 96, 120, 138, 156, 180, 204, 222, 246];

/**
 * The hatched technical rule that sits in the gap of `decoLine`, both in the
 * landscape background deco (`width: 17.8125rem`) and in the portrait drawer
 * header (`height: 1.1875rem`, clipped to 8.125rem).
 */
export function RuleGlyphIcon({ className }: GlyphProps) {
  return (
    <svg className={className} viewBox="0 0 285 20" fill="none" aria-hidden="true">
      {RULE_BLOCKS.map((x, i) => (
        <rect
          key={x}
          x={x}
          y={i % 2 === 0 ? 4 : 8}
          width={i % 3 === 0 ? 12 : 6}
          height={i % 2 === 0 ? 12 : 4}
          fill="currentColor"
        />
      ))}
      <path
        d="M262 4 L268 10 L262 16 M272 4 L278 10 L272 16"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

/** The lone crosshair plus at the far left of the landscape background. */
export function PlusIcon({ className }: GlyphProps) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M16 2 V30 M2 16 H30" stroke="currentColor" strokeWidth="4" />
    </svg>
  );
}

/**
 * The rail arrow. It points left in its natural orientation — the extracted
 * rules rotate it +90deg for the top button and -90deg for the bottom one.
 */
export function RailArrowIcon({ className }: GlyphProps) {
  return (
    <svg className={className} viewBox="0 0 18 27" fill="none" aria-hidden="true">
      <path
        d="M14 2 L4 13.5 L14 25"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="square"
      />
    </svg>
  );
}

const RETICLE_DASHES = [0, 45, 90, 135, 180, 225, 270, 315];

/** The targeting reticle that fades in behind the selected avatar. */
export function ReticleIcon({ className }: GlyphProps) {
  return (
    <svg className={className} viewBox="0 0 200 200" fill="none" aria-hidden="true">
      <circle cx="100" cy="100" r="78" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
      <circle
        cx="100"
        cy="100"
        r="88"
        stroke="currentColor"
        strokeWidth="1"
        strokeDasharray="4 10"
        opacity="0.8"
      />
      {RETICLE_DASHES.map((angle) => (
        <rect
          key={angle}
          x="99"
          y="4"
          width="2"
          height="12"
          fill="currentColor"
          transform={`rotate(${angle} 100 100)`}
        />
      ))}
      <path
        d="M6 30 V6 H30 M170 6 H194 V30 M194 170 V194 H170 M30 194 H6 V170"
        stroke="currentColor"
        strokeWidth="2.5"
      />
    </svg>
  );
}

/** The microphone that marks a CV row. */
export function MicIcon({ className }: GlyphProps) {
  return (
    <svg className={className} viewBox="0 0 29 34" fill="none" aria-hidden="true">
      <rect x="10" y="2" width="9" height="17" rx="4.5" fill="currentColor" />
      <path
        d="M5 15 a9.5 9.5 0 0 0 19 0"
        stroke="currentColor"
        strokeWidth="2.5"
        fill="none"
      />
      <path d="M14.5 25 V31" stroke="currentColor" strokeWidth="2.5" />
    </svg>
  );
}

/** The close cross inside the portrait drawer handle. */
export function CloseIcon({ className }: GlyphProps) {
  return (
    <svg className={className} viewBox="0 0 42 42" fill="none" aria-hidden="true">
      <path d="M11 11 L31 31 M31 11 L11 31" stroke="currentColor" strokeWidth="4" />
    </svg>
  );
}
