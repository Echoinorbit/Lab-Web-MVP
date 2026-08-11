/**
 * Reproduces the root-font-size scaling used by endfield.hypergryph.com.
 *
 * The whole site is laid out in `rem` against a fixed design canvas and scaled
 * to "contain" within the viewport, so a 2560x1440 mock renders identically at
 * any landscape size. The original ships this as a blocking inline script in
 * <head>; we do the same so the first paint is already scaled and there is no
 * reflow flash.
 *
 * Landscape: 2560 x 1440 design canvas, base 16px  ->  1rem = 16 design px
 * Portrait:  1080 x 1920 design canvas, base 16px
 *
 * `--vh-offset` mirrors the original and stays 0 outside the HarmonyOS branch.
 */

const BASE_FONT_SIZE = 16;

/** Serialised verbatim into a blocking inline <script>. Keep it ES5-safe. */
const SCALE_SCRIPT = `
(function () {
  var BASE = ${BASE_FONT_SIZE};
  var lastW = 0, lastH = 0;

  function fit(w, h, designW, designH) {
    return w / h > designW / designH ? h / designH : w / designW;
  }

  function apply() {
    var w = window.innerWidth, h = window.innerHeight;
    if (w === lastW && h === lastH) return;
    lastW = w; lastH = h;

    var scale = h >= w ? fit(w, h, 1080, 1920) : fit(w, h, 2560, 1440);
    var root = document.documentElement;
    root.style.fontSize = BASE * scale + "px";
    root.style.setProperty("--vh-offset", "0px");
    root.style.setProperty("--vh", h / 100 + "px");
  }

  apply();
  window.addEventListener("resize", apply, { passive: true });
  window.addEventListener("orientationchange", apply, { passive: true });
})();
`;

export function ViewportScale() {
  return (
    <script
      // Runs before paint so the first frame is already at the right scale.
      dangerouslySetInnerHTML={{ __html: SCALE_SCRIPT }}
    />
  );
}
