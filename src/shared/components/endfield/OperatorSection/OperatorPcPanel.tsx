"use client";

import { cn } from "@/lib/utils";
import { MicIcon, PlusIcon, RecTicksIcon, RuleGlyphIcon } from "./OperatorIcons";
import type { StageMode } from "./OperatorStage";
import { cvLabels, formatPosition, metaTags, type OperatorView } from "./operatorView";
import styles from "./OperatorSection.module.css";

interface OperatorPcPanelProps {
  view: OperatorView;
  mode: StageMode;
  onToggleMode: () => void;
  onTop?: boolean;
}

/**
 * The landscape HUD: the `[ REC ]` block and rarity stars at the top left, the
 * bracketed name over the tri-colour rule, the metadata chips and biography,
 * plus every decorative layer that sits behind the art.
 *
 * The three `*InnerContainer` elements are what the original slides up inside
 * its parent's `clip-path`; the reveal is driven by the `inView` class on the
 * section root.
 */
export function OperatorPcPanel({ view, mode, onToggleMode, onTop = false }: OperatorPcPanelProps) {
  const { operator } = view;

  return (
    <div className={styles.pcContainer} style={onTop ? { position: "relative", zIndex: 1 } : undefined}>
      <div className={styles.backgroundDeco}>
        <div className={styles.shallowBg} />
        <div className={styles.decoFlag} />
        <div className={styles.decoText}>{operator.codename}</div>
        <div className={styles.decoTape}>
          <span className={styles.decoLineTri} />
        </div>
        <div className={styles.decoLine}>
          <RuleGlyphIcon className={styles.decoLineIcon} />
        </div>
        <PlusIcon className={styles.decoPlus} />
      </div>

      <div className={styles.headerDeco}>
        <div className={styles.headerInnerContainer}>
          <div className={styles.decoText}>
            <span className={styles.leftBracket}>[</span>
            <span className={styles.title}>REC</span>
            <span className={styles.rightBracket}>]</span>
          </div>
          <RecTicksIcon className={styles.decoTextIcon} />
          <div key={operator.key} className={cn(styles.nameContainer, styles.swap)}>
            <span>{operator.codename}</span>
            <span>{formatPosition(view)}</span>
          </div>
          <div key={`${operator.key}-stars`} className={cn(styles.stars, styles.swap)}>
            {Array.from({ length: operator.rarity }, (_, i) => (
              <span key={i} className={styles.star} />
            ))}
          </div>
        </div>
      </div>

      <div className={styles.titleContainer}>
        <div className={styles.titleInnerContainer}>
          <div key={`${operator.key}-icons`} className={cn(styles.icons, styles.swap)}>
            <span className={styles.icon} data-key={operator.elem} />
            <span className={styles.icon} data-key={operator.prof} />
          </div>
          <div key={operator.key} className={cn(styles.nameContainer, styles.swap)}>
            <span className={styles.leftBracket}>[</span>
            <span className={styles.title}>{operator.name}</span>
            <span className={styles.rightBracket}>]</span>
          </div>
          <div className={styles.decoLine} />
        </div>
      </div>

      <div className={styles.contentContainer}>
        <div className={styles.contentInnerContainer}>
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

      <div className={styles.switchLayer}>
        <button
          type="button"
          aria-label="2D / 3D"
          aria-pressed={mode === "2d"}
          onClick={onToggleMode}
          className={cn(styles.switcher3d, mode === "2d" && styles.active)}
        />
      </div>
    </div>
  );
}
