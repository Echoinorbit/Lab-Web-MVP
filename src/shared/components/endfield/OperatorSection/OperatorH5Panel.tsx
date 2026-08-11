"use client";

import { cn } from "@/lib/utils";
import { CloseIcon, MicIcon, RecTicksIcon, RuleGlyphIcon } from "./OperatorIcons";
import type { StageMode } from "./OperatorStage";
import { cvLabels, formatPosition, metaTags, type OperatorView } from "./operatorView";
import styles from "./OperatorSection.module.css";

/** Names longer than this switch the drawer heading to its `small` size. */
const LONG_NAME_LENGTH = 3;

interface OperatorH5PanelProps {
  view: OperatorView;
  mode: StageMode;
  drawerOpen: boolean;
  onToggleMode: () => void;
  onToggleDrawer: () => void;
}

/**
 * The portrait layout: the same operator rendered as a bottom drawer that
 * slides up over the artwork. `pcContainer` and `h5Container` are swapped by
 * the extract's own `@media (orientation: …)` rules, so both are always in the
 * tree and only one is ever painted.
 */
export function OperatorH5Panel({
  view,
  mode,
  drawerOpen,
  onToggleMode,
  onToggleDrawer,
}: OperatorH5PanelProps) {
  const { operator } = view;
  const position = formatPosition(view);

  return (
    <div className={styles.h5Container}>
      <div className={styles.headerDeco}>
        <div className={styles.decoText}>
          <span className={styles.leftBracket}>[</span>
          <span className={styles.title}>REC</span>
          <span className={styles.rightBracket}>]</span>
        </div>
        <RecTicksIcon className={styles.decoTextIcon} />
      </div>

      <div className={styles.backgroundDeco}>
        <div className={styles.shallowBg} />
        <div className={styles.decoText}>{operator.codename}</div>
        <div className={styles.whiteCover} />
      </div>

      <div className={cn(styles.drawerWrapper, drawerOpen && styles.active)}>
        <div className={styles.contentContainer}>
          <div className={styles.header}>
            <div key={`${operator.key}-icons`} className={cn(styles.icons, styles.swap)}>
              <span className={styles.icon} data-key={operator.elem} />
              <span className={styles.icon} data-key={operator.prof} />
            </div>

            <div className={styles.decoLine}>
              <RuleGlyphIcon className={styles.decoLineIcon} />
            </div>

            <div
              key={operator.key}
              className={cn(
                styles.nameContainer,
                operator.name.length > LONG_NAME_LENGTH && styles.small,
                styles.swap,
              )}
            >
              <span className={styles.leftBracket}>[</span>
              <span className={styles.title}>{operator.name}</span>
              <span className={styles.rightBracket}>]</span>
            </div>

            <div
              key={`${operator.key}-en`}
              className={cn(styles.nameEnContainer, styles.swap)}
            >
              <span>{operator.codename}</span>
              <span>{position}</span>
            </div>

            <div key={`${operator.key}-stars`} className={cn(styles.stars, styles.swap)}>
              {Array.from({ length: operator.rarity }, (_, i) => (
                <span key={i} className={styles.star} />
              ))}
            </div>

            <div className={styles.deco} />
          </div>

          <button
            type="button"
            aria-label="Operator detail"
            aria-expanded={drawerOpen}
            onClick={onToggleDrawer}
            className={styles.detailButton}
          >
            <span className={styles.inner} />
            {drawerOpen ? <CloseIcon className={styles.closeIcon} /> : null}
          </button>

          <button
            type="button"
            aria-label="2D / 3D"
            aria-pressed={mode === "2d"}
            onClick={onToggleMode}
            className={cn(
              styles.switcher3d,
              mode === "2d" && styles.active,
              drawerOpen && styles.hidden,
            )}
          />

          <div className={styles.detail}>
            <div key={operator.key} className={styles.swap}>
              <div className={styles.tagContainer}>
                {metaTags(view).map((tag) => (
                  <div key={tag.label} className={styles.tag}>
                    <span className={styles.label}>{tag.label}</span>
                    <span className={styles.value}>{tag.value}</span>
                  </div>
                ))}
              </div>

              <div className={styles.tagContainer}>
              {cvLabels(view).map((label) => (
                  <div key={label} className={styles.tag}>
                    <span className={cn(styles.label, styles.cv, styles.showText)}>
                      <MicIcon className={styles.icon} />
                      {label}
                    </span>
                  </div>
                ))}
              </div>

              <div className={styles.detail}>
                {view.lines.map((line, i) => (
                  <p key={i} className={styles.line}>
                    {line}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.index}>{position}</div>
    </div>
  );
}
