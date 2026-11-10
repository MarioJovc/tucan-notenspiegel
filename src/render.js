/**
 * Rendering-Layer für den TUCaN-Notenspiegel, gebaut aus TUDa UI.
 *
 * Nimmt das Objekt aus parseNotenspiegel() und setzt daraus das Pattern
 * „Notenspiegel" des Design Systems zusammen: Kopf mit dem Semester als
 * Dachzeile, Kennzahlenzeile, Ergebniskarte mit Status-Badge, Verteilung
 * (.tuda-chart--distribution) mit Anteilsbalken (.tuda-ratio) und die Tabelle.
 *
 * Eigene Gestaltung gibt es hier nicht mehr, nur Anordnung. Farben, Schrift,
 * Radien und Bewegung stehen im System (vendor/tuda-ui, eingebunden über
 * tuda.js). Wo das System und frühere Entscheidungen des Skins sich
 * widersprachen, gilt das System: graue Balken mit der eigenen Note in Blau,
 * Kennzahlenzeile statt Kacheln, Status als Badge statt Farbstreifen,
 * Segment-Control statt Sonne/Mond-Schalter, Bewegung bis 360 ms.
 */

/** Plothöhe in px. Die Balken nutzen davon 80 % (Faktor 0,8 in bundle.css). */
const PLOT_HEIGHT = 200;

/**
 * Freies Band über den Balken in Prozent der Plothöhe, für die Wertlabels und
 * die Kurve darüber. Muss zum Faktor 0,8 in .tuda-chart--distribution passen:
 * Ohne diese Reserve lief die Linie quer durch die Zahlen.
 */
const BARS_TOP = 20;

/**
 * Anhebung der Dekorationslinie über die Balken, als Anteil der Skalenspitze.
 * Bewusst eine ADDITIVE Verschiebung im Wertraum: Ein Klemmen auf die
 * Balkenhöhe hob Täler an, ohne die Gipfel mitzuheben, und stauchte genau die
 * Höhenverhältnisse, die die Linie zeigen soll.
 */
const CURVE_LIFT = 0.26;

/** Ab diesem Anteil passt der Prozentwert ins Segment des Anteilsbalkens. */
const RATIO_INNER_MIN = 0.12;

/**
 * Bewegung beim Öffnen: Startverzug je Baustein in ms. Der Dialog selbst
 * erscheint in 360 ms; die Balken wachsen ab 160 ms, je 30 ms versetzt, die
 * Zahlen zählen danach hoch, das Häkchen zeichnet sich in 480 ms.
 */
const ENTER = { chart: 160, ratio: 420, badge: 300, facts: 560 };
const COUNT_DURATION = 480; // duration-delight

const TSK_SKIN_CSS = `
/* Nur Anordnung. Blatt, Verteilung, Anteile, Ergebnis und Tabelle stehen im
   Design System; das Aussehen „matt" kommt aus dem Canvas Notenübersicht
   (notenspiegel-matt.css, unten eingebunden). */
.tsk-app { background: transparent; }
.tsk-ns [hidden] { display: none !important; }
.tsk-sheet.tuda-modal--static { box-shadow: var(--shadow-2); }
.tsk-ns { display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; }

.tsk-ns__heading { flex: 1 1 auto; min-width: 0; display: grid; gap: var(--space-2); }
.tsk-ns__heading .tuda-modal__title { padding-top: 0; font-size: var(--font-size-2xl); line-height: 34px; letter-spacing: -0.02em; }
.tsk-ns__meta { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2) var(--space-3); margin: 0; }
.tsk-ns__meta .tuda-badge { padding: 3px 10px; font-size: var(--font-size-sm); line-height: 18px; }
.tsk-ns__meta .tuda-badge .tuda-icon { width: 14px; height: 14px; }
.tsk-ns__code { font-family: var(--font-mono); font-size: var(--font-size-xs); line-height: 18px; color: var(--text-secondary); }
.tsk-ns__examiner { font-size: var(--font-size-sm); line-height: 18px; color: var(--text-secondary); }

/* Werkzeuge oben rechts in EINER Zeile, auf eine Mitte ausgerichtet:
   Noten-Umschalter, Einstellungen, Schließen. Vorher saß das X mit eigenem
   negativen Rand höher als der Schalter. */
.tsk-ns__tools { flex: none; display: flex; align-items: center; gap: var(--space-2); }
.tsk-ns__tools .tuda-modal__close { margin: 0 -6px 0 0; }
.tsk-ns__note { display: flex; align-items: center; gap: var(--space-2); }
.tsk-ns__note-label { font-size: var(--font-size-md); line-height: 20px; font-weight: var(--font-weight-medium); color: var(--text-secondary); }
.tsk-ns__iconbtn.tuda-btn--ghost { --_bg: var(--surface-fill); --_fg: var(--text-secondary); width: 32px; min-width: 32px; height: 32px; min-height: 32px; }
.tsk-ns__iconbtn[aria-expanded="true"] { --_fg: var(--text-primary); }

/* Einstellungen: kleines Glasfenster unter dem Zahnrad */
.tsk-ns__settings { position: relative; }
.tsk-ns__popover {
  position: absolute; right: 0; top: calc(100% + 8px); z-index: var(--z-dropdown); width: max-content;
  display: grid; gap: var(--space-2); padding: var(--space-3) var(--space-4) var(--space-4);
  border-radius: var(--radius-lg); background: var(--surface-glass);
  -webkit-backdrop-filter: blur(var(--blur-glass)) saturate(180%); backdrop-filter: blur(var(--blur-glass)) saturate(180%);
  box-shadow: inset 0 0 0 1px var(--border-glass), var(--shadow-2);
  transform-origin: top right; animation: tuda-pop-in var(--duration-base) var(--ease-enter);
}
.tsk-ns__popover-title { margin: 0; font-size: var(--font-size-sm); line-height: 18px; font-weight: var(--font-weight-semibold); color: var(--text-secondary); }

.tsk-ns__body { flex: 1 1 auto; min-height: 0; gap: var(--space-4); padding-top: var(--space-4); }
.tsk-ns__cardhead { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-3) var(--space-4); }
.tsk-ns__cardhead h3 { margin: 0; font-family: var(--font-sans); font-size: var(--font-size-base); line-height: 22px; font-weight: var(--font-weight-semibold); letter-spacing: var(--tracking-text); color: var(--text-primary); }
.tsk-dist { gap: var(--space-5); }
.tsk-ns__table .tuda-table { min-width: 560px; }
.tsk-ns__source { margin: 0; font-size: var(--font-size-xs); line-height: 16px; color: var(--text-secondary); }
.tsk-ns__loading { display: grid; gap: var(--space-4); }

/* Öffnen: Der Durchschnitt wächst wie die Balken von unten herauf, seine
   Kapsel blendet erst danach ein (vorher würde sie mitgestaucht). */
.tuda-chart--animate .tuda-chart__mean { transform-origin: bottom; animation: tuda-grow-y var(--duration-slow) var(--ease-enter) both; animation-delay: calc(var(--delay, 0ms) + var(--_n, 7) * 30ms + 60ms); }
.tuda-chart--animate .tuda-chart__mean > span { animation: tuda-fade-in var(--duration-base) var(--ease-standard) both; animation-delay: calc(var(--delay, 0ms) + var(--_n, 7) * 30ms + 360ms); }
/* Wechsel Balken / Linie: kurz einblenden */
.tsk-ns .is-entering { animation: tuda-fade-in var(--duration-base) var(--ease-standard) both; }

/* Theme-Wechsel: Farben blenden über, aber nur solange .tsk-theming gesetzt
   ist (siehe tskApplyTheme). Ausschließlich Farbeigenschaften. */
.tsk-app.tsk-theming, .tsk-app.tsk-theming *,
.tsk-app.tsk-theming *::before, .tsk-app.tsk-theming *::after {
  transition-property: background-color, color, border-color, outline-color, fill, stroke, stop-color, box-shadow !important;
  transition-duration: var(--duration-slow) !important;
  transition-timing-function: var(--ease-standard) !important;
  transition-delay: 0s !important;
}
.tsk-app.tsk-theming .tuda-segmented--slide::before {
  transition-property: transform, background-color, box-shadow !important;
  transition-duration: var(--duration-base), var(--duration-slow), var(--duration-slow) !important;
  transition-timing-function: var(--ease-spring), var(--ease-standard), var(--ease-standard) !important;
}
@media (prefers-reduced-motion: reduce) { .tsk-ns *, .tsk-ns *::before { animation-delay: 0s !important; } }
/*
 * Notenspiegel · matt
 * Überschreibt TUDa UI 0.4 für den Notenspiegel. Gilt unter .tsk-app.
 * Tönung: --ns-tint (Kohorte, Standard 40 %) und --ns-tint-err (5,0, 36 %),
 * beides über den Tweak „tint“.
 */

/* Blatt: ganz leichtes Liquid Glass mit blau-violettem Unterton */
.tsk-app .tuda-modal--page {
  background:
    radial-gradient(140% 50% at 50% 0%, var(--surface-sheen), transparent 70%),
    linear-gradient(135deg, color-mix(in srgb, var(--primary) 6%, transparent), color-mix(in srgb, var(--data-6) 7%, transparent)),
    color-mix(in srgb, var(--surface-page) 80%, transparent);
  -webkit-backdrop-filter: blur(var(--blur-glass)) saturate(160%);
  backdrop-filter: blur(var(--blur-glass)) saturate(160%);
  box-shadow:
    inset 0 1px 0 var(--border-glass),
    inset 0 0 0 1px color-mix(in srgb, var(--border-glass) 50%, transparent),
    var(--shadow-2);
}

/* Balken: kräftige Tönung mit leichtem Glas – Glanz oben, feine Lichtkante,
   zarte Kante, kein Schein. Ecken: freies Ende 10 px, Ansatz 4 px */
.tsk-app .tuda-chart--distribution .tuda-chart__bar {
  --ns-fill: color-mix(in srgb, var(--_tone) var(--ns-tint, 40%), var(--_top));
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--white) 14%, transparent), transparent 55%),
    var(--ns-fill);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--white) 40%, transparent),
    inset 0 0 0 1px color-mix(in srgb, var(--_tone) 14%, transparent);
  border-radius: var(--radius-md) var(--radius-md) var(--radius-xs) var(--radius-xs);
}
.tsk-app .tuda-chart--distribution .tuda-chart__bar.is-error {
  --ns-fill: color-mix(in srgb, var(--_tone) var(--ns-tint-err, 36%), var(--_top));
}
/* Eigene Note: massiv, nur Glanz und Lichtkante – kein Schein darunter */
.tsk-app .tuda-chart--distribution .tuda-chart__bar.is-current {
  --ns-fill: var(--_tone);
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--white) 30%, transparent);
}

/* Anteile: dasselbe leichte Glas; der Glanz endet über der Schrift */
.tsk-app .tuda-ratio__seg {
  --_ink: var(--text-primary);
  --ns-fill: color-mix(in srgb, var(--_tone) var(--ns-tint, 40%), var(--_top));
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--white) 14%, transparent), transparent 32%),
    var(--ns-fill);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--white) 40%, transparent),
    inset 0 0 0 1px color-mix(in srgb, var(--_tone) 14%, transparent);
  border-radius: var(--radius-xs);
  /* Zahlen im Balken: größer, in der Titelschrift, leicht gesperrt */
  font-family: var(--font-display); font-size: var(--font-size-md); line-height: 20px;
  font-weight: var(--font-weight-bold); letter-spacing: 0.01em;
}
.tsk-app .tuda-ratio__seg--error {
  --ns-fill: color-mix(in srgb, var(--_tone) var(--ns-tint-err, 36%), var(--_top));
}
.tsk-app .tuda-ratio__seg:first-child {
  border-top-left-radius: var(--radius-md);
  border-bottom-left-radius: var(--radius-md);
}
.tsk-app .tuda-ratio__seg:last-child {
  border-top-right-radius: var(--radius-md);
  border-bottom-right-radius: var(--radius-md);
}
.tsk-app .tuda-ratio__label::before {
  background: color-mix(in srgb, var(--primary) var(--ns-tint, 40%), var(--primary-subtle-hover));
}
.tsk-app .tuda-ratio__label--end::before {
  background: color-mix(in srgb, var(--error-solid) var(--ns-tint-err, 36%), var(--error-border));
}
/* „Nicht bestanden ●“: Punkt außen, spiegelbildlich zu „● Bestanden“ */
.tsk-app .tuda-ratio__label--end { flex-direction: row-reverse; }

/* Ergebniskarte: kein farbiger Schein */
.tsk-app .tuda-result {
  box-shadow: inset 0 0 0 1px var(--edge), inset 0 1px 0 var(--border-glass);
}
/* Symbol: flache Plakette mit Haken (bei --error mit Kreuz), ohne Text, Glanz und Schein */
.tsk-app .tuda-result__mark { width: 40px; height: 40px; box-shadow: none; }
.tsk-app .tuda-result__mark .tuda-icon { width: 22px; height: 22px; stroke-width: 2.75; }

/* Kennzahlen: eine Zeile, ruhiger. Trenner nur neben Bezeichnung und Wert,
   Werte etwas größer, Aufschlüsselung leiser */
.tsk-app .tuda-facts--center { align-items: start; }
.tsk-app .tuda-facts--center .tuda-facts__item {
  position: relative; gap: var(--space-1); padding: 0 var(--space-3);
}
.tsk-app .tuda-facts--center .tuda-facts__item + .tuda-facts__item { box-shadow: none; }
.tsk-app .tuda-facts--center .tuda-facts__item + .tuda-facts__item::before {
  content: ""; position: absolute; left: 0; top: 4px; height: 44px;
  border-left: 1px solid var(--border-subtle);
}
.tsk-app .tuda-facts--center .tuda-facts__label { white-space: nowrap; }
.tsk-app .tuda-facts--center .tuda-facts__value { font-size: var(--font-size-xl); line-height: 28px; }
.tsk-app .tuda-facts--center .tuda-facts__note {
  font-size: var(--font-size-xs); line-height: 16px; color: var(--text-tertiary);
}

/* Slider nur mit Symbolen */
.tsk-app .ns-seg-icons .tuda-segmented__item > span { padding: 0 var(--space-3); }
.tsk-app .ns-seg-icons .tuda-segmented__item > span .tuda-icon { width: 18px; height: 18px; }

/* Linienmodus: dezente Skala links, Hilfslinien, geglättete Linie mit Verlauf und leichtem Glas */
.tsk-app .ns-chart--line .tuda-chart__body { grid-template-columns: max-content minmax(0, 1fr); }
.tsk-app .ns-chart--line .tuda-chart__axis { grid-column: 2; }
.tsk-app .ns-chart--line .tuda-chart__y {
  height: var(--plot-h, 200px); margin-top: var(--space-8); min-width: 2.25em;
  font-size: var(--font-size-2xs); line-height: 14px; color: var(--text-tertiary);
}
.tsk-app .ns-grid { position: absolute; inset: 0; z-index: 0; pointer-events: none; }
.tsk-app .ns-grid span {
  position: absolute; left: 0; right: 0; bottom: var(--p);
  border-top: 1px solid var(--border-subtle); opacity: 0.6;
}
.tsk-app .ns-line {
  position: absolute; inset: 0; z-index: 1;
  width: 100%; height: 100%; overflow: visible; pointer-events: none;
}
.tsk-app .ns-line__stop { stop-color: var(--primary); }
.tsk-app .ns-line__stop:nth-child(1) { stop-opacity: 0.3; }
.tsk-app .ns-line__stop:nth-child(2) { stop-opacity: 0.12; }
.tsk-app .ns-line__stop:nth-child(3) { stop-opacity: 0; }
.tsk-app .ns-line__area { stroke: none; }
.tsk-app .ns-line__gloss {
  fill: none; stroke: var(--white); stroke-opacity: 0.4; stroke-width: 7;
  stroke-linejoin: round; vector-effect: non-scaling-stroke;
}
.tsk-app[data-theme="dark"] .ns-line__gloss { stroke-opacity: 0.12; }
.tsk-app .ns-line__path {
  fill: none; stroke: var(--primary); stroke-width: 2;
  stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke;
}

/* Je Note eine Spalte: Hilfslinie, Punkt und Wert erscheinen nur bei Hover oder Fokus.
   Die eigene Note bleibt als Punkt markiert. */
.tsk-app .ns-col {
  position: absolute; top: 0; bottom: 0; z-index: 2;
  left: calc(var(--i) * 100% / var(--_n, 11)); width: calc(100% / var(--_n, 11));
  border-radius: var(--radius-sm); outline: none;
}
.tsk-app .ns-col::before {
  content: ""; position: absolute; left: 50%; top: 0; bottom: 0;
  border-left: 1px dashed var(--border-strong); opacity: 0;
  transition: opacity var(--duration-fast);
}
.tsk-app .ns-col__dot {
  position: absolute; left: 50%; bottom: calc(var(--h) * 0.8);
  width: 10px; height: 10px; margin: 0 0 -5px -5px; border-radius: 50%;
  background: var(--surface); box-shadow: inset 0 0 0 2px var(--primary);
  opacity: 0; transform: scale(0.6);
  transition: opacity var(--duration-fast), transform var(--duration-base) var(--ease-spring);
}
.tsk-app .ns-col.is-error .ns-col__dot { box-shadow: inset 0 0 0 2px var(--error-solid); }
.tsk-app .ns-col.is-current .ns-col__dot {
  width: 12px; height: 12px; margin: 0 0 -6px -6px;
  background: var(--chart-emphasis); box-shadow: 0 0 0 2px var(--surface);
  opacity: 1; transform: none;
}
.tsk-app .ns-col.is-current.is-error .ns-col__dot { background: var(--error-solid); }
.tsk-app .ns-col .tuda-chart__tip { bottom: calc(var(--h) * 0.8 + 12px); }
.tsk-app .ns-col:hover::before,
.tsk-app .ns-col:focus-visible::before { opacity: 0.6; }
.tsk-app .ns-col:hover .ns-col__dot,
.tsk-app .ns-col:focus-visible .ns-col__dot { opacity: 1; transform: none; }
.tsk-app .ns-col:hover .tuda-chart__tip,
.tsk-app .ns-col:focus-visible .tuda-chart__tip { opacity: 1; }
.tsk-app .ns-col:focus-visible {
  outline: var(--border-width-thick) solid var(--focus-ring); outline-offset: -2px;
}

/* Kontrastmodus: Systemfarben */
@media (forced-colors: active) {
  .tsk-app .tuda-chart--distribution .tuda-chart__bar,
  .tsk-app .tuda-ratio__seg { background: CanvasText; }
  .tsk-app .tuda-chart--distribution .tuda-chart__bar.is-current { background: Highlight; }
  .tsk-app .ns-line__path { stroke: CanvasText; }
  .tsk-app .ns-line__gloss { display: none; }
  .tsk-app .ns-col__dot { forced-color-adjust: none; background: Canvas; box-shadow: inset 0 0 0 2px CanvasText; }
  .tsk-app .ns-col.is-current .ns-col__dot { background: Highlight; }
}
`;

let tskCssCache = null;
/** CSS des Systems (fürs Shadow DOM angepasst) plus die Anordnung oben. */
function tskStyles() {
  if (tskCssCache === null) tskCssCache = tskAdaptCss(tskVendor().css) + TSK_SKIN_CSS;
  return tskCssCache;
}

const de = (value, digits = 0) =>
  value == null
    ? '–'
    : value.toLocaleString('de-DE', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });

const pct = (fraction, digits = 1) =>
  fraction == null ? '–' : de(fraction * 100, digits) + ' %';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/** „WiSe 2025/26" als Dachzeile ausschreiben; Unbekanntes bleibt, wie es ist. */
function semesterLabel(semester) {
  if (!semester) return null;
  const winter = /^(?:WiSe|WS|Wintersemester)\.?\s*(.+)$/i.exec(semester);
  if (winter) return 'Wintersemester ' + winter[1];
  const summer = /^(?:SoSe|SS|Sommersemester)\.?\s*(.+)$/i.exec(semester);
  if (summer) return 'Sommersemester ' + summer[1];
  return semester;
}

/**
 * Ganze Zahl hochzählen, in duration-delight mit weichem Auslauf. Steht der
 * Wert vorher schon fest im Text, bleibt er bei reduzierter Bewegung einfach
 * stehen. Die Zahl ist nie die einzige Quelle: aria-label und Tabelle tragen
 * den Endwert von Anfang an.
 */
function tskCountUp(node, to, delay, digits = 0) {
  node.textContent = de(to, digits);
  if (!(to > 0) || (!digits && to <= 1) || tskReducedMotion() || typeof requestAnimationFrame !== 'function') return;
  const start = performance.now() + delay;
  const ease = (t) => 1 - (1 - t) ** 3;
  const factor = 10 ** digits;
  let done = false;
  node.textContent = de(0, digits);
  const tick = (now) => {
    if (done) return;
    const t = Math.min(1, Math.max(0, (now - start) / COUNT_DURATION));
    node.textContent = de(Math.round(to * ease(t) * factor) / factor, digits);
    if (t < 1) requestAnimationFrame(tick);
    else done = true;
  };
  requestAnimationFrame(tick);
  // Rückfall: In einem verdeckten Tab laufen keine Frames, die Zahl bliebe bei 0.
  // Timer feuern dort trotzdem (gedrosselt), der Endwert kommt also sicher an.
  setTimeout(() => {
    done = true;
    node.textContent = de(to, digits);
  }, delay + COUNT_DURATION + 60);
}

/**
 * Skalenspitze auf einen runden Wert bringen.
 * target 5 statt 4: Bei einem Maximum von 456 lieferte 4 eine Spitze von 600
 * und verschenkte damit ein Viertel der Höhe an leeren Raum.
 */
function niceTop(max, target = 5) {
  if (!max) return 1;
  const rawStep = max / target;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step =
    [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rawStep) ?? 10 * magnitude;
  return Math.ceil(max / step) * step;
}

/**
 * Mitte des i-ten Balkens in Prozent der Plotbreite. Exakt, weil der Plot im
 * System ohne Spaltenabstand läuft und jeder Balken in seiner Spalte zentriert ist.
 */
const slotCenter = (i, n) => ((i + 0.5) / n) * 100;

/**
 * x-Position eines kontinuierlichen Notenwerts auf der Kategorieachse.
 * Die Notenstufen sind numerisch ungleich verteilt (1,7 → 2,0 → 2,3 … → 5,0),
 * sitzen auf der Achse aber in gleichen Abständen. Zwischen den beiden
 * umschließenden Stufen wird deshalb linear interpoliert.
 */
function gradeToX(distribution, value) {
  const graded = distribution.filter((d) => d.grade != null);
  const n = distribution.length;
  if (value == null || graded.length < 2) return null;
  for (let i = 0; i < graded.length - 1; i++) {
    const a = graded[i];
    const b = graded[i + 1];
    if (value >= a.grade && value <= b.grade) {
      const t = (value - a.grade) / (b.grade - a.grade);
      const ia = distribution.indexOf(a);
      const ib = distribution.indexOf(b);
      return slotCenter(ia, n) + t * (slotCenter(ib, n) - slotCenter(ia, n));
    }
  }
  return null;
}

/**
 * Monotone kubische Interpolation (Fritsch–Carlson) als Bezier-Pfad.
 *
 * Ein Catmull-Rom-Spline überschwingt bei ungleichen Werteabständen und
 * erzeugt Extrema, die in den Daten nicht vorkommen: Am Extremfall-Fixture
 * stieg die Kurve bei 1,3 an, obwohl dort null Ergebnisse liegen. Die
 * Fritsch-Carlson-Tangenten garantieren, dass zwischen zwei Punkten kein neues
 * Hoch oder Tief entsteht.
 */
function monotonePath(points) {
  const n = points.length;
  if (n < 2) return '';

  const dx = [];
  const slope = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = points[i + 1].x - points[i].x;
    slope[i] = (points[i + 1].y - points[i].y) / dx[i];
  }

  const tangent = new Array(n);
  tangent[0] = slope[0];
  tangent[n - 1] = slope[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (slope[i - 1] * slope[i] <= 0) {
      // Vorzeichenwechsel oder Plateau: waagerechte Tangente, sonst schwingt
      // die Kurve über den Extrempunkt hinaus.
      tangent[i] = 0;
    } else {
      const w1 = 2 * dx[i] + dx[i - 1];
      const w2 = dx[i] + 2 * dx[i - 1];
      tangent[i] = (w1 + w2) / (w1 / slope[i - 1] + w2 / slope[i]);
    }
  }

  let d = `M ${points[0].x} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < n - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const third = dx[i] / 3;
    d +=
      ` C ${(p1.x + third).toFixed(2)} ${(p1.y + tangent[i] * third).toFixed(2)},` +
      ` ${(p2.x - third).toFixed(2)} ${(p2.y - tangent[i + 1] * third).toFixed(2)},` +
      ` ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

/**
 * Hintergrundfläche als .tuda-chart__curve. Koordinaten 0–100 in beide
 * Richtungen, preserveAspectRatio="none": Der Pfad skaliert mit dem Plot,
 * die Linienstärke dank non-scaling-stroke nicht. Farbe und Verlauf der Stops
 * setzt das System per CSS.
 */
function buildCurve(distribution, top) {
  const n = distribution.length;
  if (n < 2 || !top) return null;

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('class', 'tuda-chart__curve');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true'); // Gestaltung, die Werte stehen in Balken und Tabelle

  // Eindeutige ID: Mehrere Widgets können auf einer Seite liegen.
  const uid = 'tsk' + Math.random().toString(36).slice(2, 9);
  const defs = document.createElementNS(svgNS, 'defs');
  const gradient = document.createElementNS(svgNS, 'linearGradient');
  gradient.setAttribute('id', uid);
  gradient.setAttribute('x1', '0');
  gradient.setAttribute('x2', '0');
  gradient.setAttribute('y1', '0');
  gradient.setAttribute('y2', '1');
  for (const offset of ['0%', '38%', '78%', '100%']) {
    const stop = document.createElementNS(svgNS, 'stop');
    stop.setAttribute('offset', offset);
    gradient.appendChild(stop);
  }
  defs.appendChild(gradient);
  svg.appendChild(defs);

  // Keine Glättung der Werte: Eine Kernel-Glättung mittelt über die Nachbarn
  // und verletzt die Proportionalität. Die weiche Form kommt allein aus der
  // Interpolation zwischen den Punkten.
  const toY = (count) => BARS_TOP + (1 - count / top) * (100 - BARS_TOP);
  const lift = top * CURVE_LIFT;
  const points = distribution.map((bin, i) => ({
    x: slotCenter(i, n),
    y: Math.max(0, toY(bin.count + lift)),
  }));
  // Endanker außerhalb des Rahmens: Liefen sie auf x = 0/100, fiele die Linie
  // noch sichtbar zur Grundlinie ab und schnitte das Label des äußersten Balkens.
  points.unshift({ x: -42, y: 100 });
  points.push({ x: 142, y: 100 });

  const line = monotonePath(points);
  const area = document.createElementNS(svgNS, 'path');
  area.setAttribute('class', 'tuda-chart__area');
  area.setAttribute('d', `${line} L 142 100 L -42 100 Z`);
  area.setAttribute('fill', `url(#${uid})`);
  const stroke = document.createElementNS(svgNS, 'path');
  stroke.setAttribute('class', 'tuda-chart__line');
  stroke.setAttribute('d', line);
  svg.appendChild(area);
  svg.appendChild(stroke);
  return svg;
}

/**
 * Kopf des Blatts: großer Titel, darunter Semester als Kapsel, Kennung und
 * Prüfende. Rechts die Werkzeuge in einer Zeile auf einer Mitte.
 */
function buildHeader({ kicker, title, titleId, meta = [], tools = [], onClose }) {
  const header = el('header', 'tuda-modal__header');
  const heading = el('div', 'tsk-ns__heading');
  const h = el('h2', 'tuda-modal__title', title);
  if (titleId) h.id = titleId;
  heading.appendChild(h);
  if (kicker || meta.length) {
    const line = el('p', 'tsk-ns__meta');
    if (kicker) {
      const badge = el('span', 'tuda-badge tuda-badge--primary');
      badge.appendChild(tskIcon(document, 'calendar'));
      badge.appendChild(document.createTextNode(kicker));
      line.appendChild(badge);
    }
    for (const part of meta) line.appendChild(el('span', part.code ? 'tsk-ns__code' : 'tsk-ns__examiner', part.text));
    heading.appendChild(line);
  }
  header.appendChild(heading);

  const box = el('div', 'tsk-ns__tools');
  box.append(...tools);
  if (onClose) {
    const close = el('button', 'tuda-btn tuda-btn--ghost tuda-btn--neutral tuda-btn--icon tuda-modal__close');
    close.type = 'button';
    close.setAttribute('aria-label', 'Notenspiegel schließen');
    close.appendChild(tskIcon(document, 'x'));
    close.addEventListener('click', onClose);
    box.appendChild(close);
  }
  if (box.childElementCount) header.appendChild(box);
  return header;
}

/**
 * Segment-Control nur mit Symbolen (gleitender Daumen). Jede Option:
 * [Wert, Bezeichnung, Icon]; die Bezeichnung steht als aria-label und Tooltip.
 */
function buildIconSegments(name, legend, options, current, onPick) {
  const fieldset = el('fieldset', 'tuda-fieldset');
  fieldset.appendChild(el('legend', 'tuda-sr-only', legend));
  const segmented = el('div', 'tuda-segmented tuda-segmented--slide ns-seg-icons');
  for (const [value, label, icon] of options) {
    const item = el('label', 'tuda-segmented__item');
    item.title = label;
    const input = el('input');
    input.type = 'radio';
    input.name = name;
    input.value = value;
    input.checked = value === current;
    input.setAttribute('aria-label', label);
    input.addEventListener('change', () => { if (input.checked) onPick(value); });
    const span = el('span');
    span.appendChild(tskIcon(document, icon));
    item.append(input, span);
    segmented.appendChild(item);
  }
  fieldset.appendChild(segmented);
  return fieldset;
}

/**
 * Hell / Dunkel / System als Segment-Control mit gleitendem Daumen
 * (.tuda-segmented--slide). Wirkt auf den Wrapper .tsk-app, in dem das Blatt
 * hängt; ohne Wrapper (frei eingesetzt) bleibt es wirkungslos.
 */
function buildThemeControl(uid) {
  const fieldset = el('fieldset', 'tuda-fieldset');
  fieldset.appendChild(el('legend', 'tuda-sr-only', 'Erscheinungsbild'));
  const segmented = el('div', 'tuda-segmented tuda-segmented--slide');
  const current = tskThemeMode();
  for (const [value, label, icon] of [
    ['light', 'Hell', 'sun'],
    ['dark', 'Dunkel', 'moon'],
    ['system', 'System', 'monitor'],
  ]) {
    const item = el('label', 'tuda-segmented__item');
    const input = el('input');
    input.type = 'radio';
    input.name = uid + '-theme';
    input.value = value;
    input.checked = value === current;
    input.addEventListener('change', () => {
      const app = segmented.closest('.tsk-app');
      if (input.checked && app) tskSetThemeMode(app, value);
    });
    const span = el('span');
    span.appendChild(tskIcon(document, icon));
    span.appendChild(document.createTextNode(label));
    item.append(input, span);
    segmented.appendChild(item);
  }
  fieldset.appendChild(segmented);
  return fieldset;
}

/**
 * Einstellungen hinter einem Symbol: ein kleines Glasfenster mit dem
 * Erscheinungsbild. Schließt bei Klick daneben und mit Escape – Escape schließt
 * dabei nur das Fenster, nicht den ganzen Notenspiegel.
 */
function buildSettings(uid) {
  const wrap = el('div', 'tsk-ns__settings');
  const button = el('button', 'tuda-btn tuda-btn--ghost tuda-btn--neutral tuda-btn--icon tsk-ns__iconbtn');
  button.type = 'button';
  button.title = 'Einstellungen';
  button.setAttribute('aria-label', 'Einstellungen');
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', uid + '-settings');
  button.appendChild(tskIcon(document, 'settings'));
  const pop = el('div', 'tsk-ns__popover');
  pop.id = uid + '-settings';
  pop.setAttribute('role', 'group');
  pop.setAttribute('aria-label', 'Einstellungen');
  pop.hidden = true;
  pop.appendChild(el('p', 'tsk-ns__popover-title', 'Erscheinungsbild'));
  pop.appendChild(buildThemeControl(uid));

  const outside = (ev) => { if (!ev.composedPath().includes(wrap)) setOpen(false); };
  function setOpen(open) {
    pop.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    const scope = wrap.getRootNode();
    if (open) {
      scope.addEventListener('pointerdown', outside, true);
    } else {
      scope.removeEventListener('pointerdown', outside, true);
    }
  }
  button.addEventListener('click', () => setOpen(pop.hidden));
  wrap.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && !pop.hidden) {
      ev.preventDefault();
      ev.stopPropagation();
      setOpen(false);
      button.focus();
    }
  });
  wrap.append(button, pop);
  return wrap;
}

/**
 * Linienansicht: dezente Skala, Hilfslinien, geglättete Linie mit Verlauf und
 * je Note eine Spalte mit Punkt und Tooltip (Aussehen: notenspiegel-matt.css).
 */
function buildLineLayer(distribution, stats, top, uid, isFailGrade, isOwnGrade, ownMarks) {
  const svgNS = 'http://www.w3.org/2000/svg';
  const n = distribution.length;
  const toY = (count) => BARS_TOP + (1 - count / top) * (100 - BARS_TOP);
  const ticks = [0, 1 / 3, 2 / 3, 1].map((f) => Math.round(top * f));

  const yAxis = el('div', 'tuda-chart__y');
  yAxis.setAttribute('aria-hidden', 'true');
  for (const v of ticks) {
    const s = el('span', null, de(v));
    s.style.setProperty('--p', (v / top) * (100 - BARS_TOP) + '%');
    yAxis.appendChild(s);
  }

  const grid = el('div', 'ns-grid');
  grid.setAttribute('aria-hidden', 'true');
  for (const v of ticks.slice(1)) {
    const s = el('span');
    s.style.setProperty('--p', (v / top) * (100 - BARS_TOP) + '%');
    grid.appendChild(s);
  }

  const points = [{ x: 0, y: 100 }, ...distribution.map((b, i) => ({ x: slotCenter(i, n), y: toY(b.count) })), { x: 100, y: 100 }];
  const line = monotonePath(points);
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('class', 'ns-line');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');
  const defs = document.createElementNS(svgNS, 'defs');
  const grad = document.createElementNS(svgNS, 'linearGradient');
  grad.id = uid + '-fill';
  for (const [k, v] of [['x1', 0], ['x2', 0], ['y1', 0], ['y2', 1]]) grad.setAttribute(k, String(v));
  for (const offset of ['0%', '55%', '100%']) {
    const stop = document.createElementNS(svgNS, 'stop');
    stop.setAttribute('class', 'ns-line__stop');
    stop.setAttribute('offset', offset);
    grad.appendChild(stop);
  }
  const clip = document.createElementNS(svgNS, 'clipPath');
  clip.id = uid + '-clip';
  const clipPath = document.createElementNS(svgNS, 'path');
  clipPath.setAttribute('d', line + ' Z');
  clip.appendChild(clipPath);
  defs.append(grad, clip);
  const path = (cls, d) => {
    const p = document.createElementNS(svgNS, 'path');
    p.setAttribute('class', cls);
    p.setAttribute('d', d);
    return p;
  };
  const area = path('ns-line__area', line + ' Z');
  area.setAttribute('fill', `url(#${uid}-fill)`);
  const gloss = path('ns-line__gloss', line);
  // Inline, weil die Kennung je Blatt eindeutig sein muss (mehrere Blätter möglich).
  gloss.style.clipPath = `url(#${uid}-clip)`;
  svg.append(defs, area, gloss, path('ns-line__path', line));

  const cols = distribution.map((bin, i) => {
    const share = stats.graded ? bin.count / stats.graded : 0;
    const col = el('div', 'ns-col');
    col.tabIndex = 0;
    col.setAttribute('role', 'img');
    col.style.setProperty('--h', (bin.count / top) * 100 + '%');
    col.style.setProperty('--i', String(i));
    col.setAttribute('aria-label', `Note ${bin.label}: ${de(bin.count)} Ergebnisse, ${pct(share)}`);
    if (isFailGrade(bin)) col.classList.add('is-error');
    if (isOwnGrade(bin)) {
      col.classList.add('is-current');
      ownMarks.push(col);
    }
    col.append(el('span', 'ns-col__dot'), el('span', 'tuda-chart__tip', `${de(bin.count)} · ${pct(share)}`));
    return col;
  });
  return { yAxis, plotNodes: [grid, svg, ...cols] };
}
/**
 * @param {object} data   Ergebnis von parseNotenspiegel()
 * @param {object} [opts]
 * @param {number} [opts.ownGrade]  Eigene Note, z. B. 1.7 (aus der Ergebniszeile)
 * @param {string} [opts.examiner]  Prüfende Person; steht nicht im Notenspiegel
 * @param {boolean} [opts.animate]  Einblenden beim Öffnen (Standard: ja)
 * @param {Function} [opts.onClose] Schließen-Taste im Kopf
 */
function renderNotenspiegel(data, opts = {}) {
  const { distribution, stats, meta, exam } = data;
  const ownGrade = opts.ownGrade ?? null;
  const own = ownGrade == null ? null : rank(distribution, ownGrade);
  const hasOwn = own != null;
  const animate = opts.animate !== false;
  // Fließtext, Kennzahl und Markierung teilen sich einen Wert: der selbst
  // gerechnete (etwa 2,7449) und TUCaNs ausgewiesener (2,745) runden verschieden.
  const meanValue = meta.average ?? stats.mean;
  const uid = 'tsk' + Math.random().toString(36).slice(2, 8);
  const isFailGrade = (bin) => bin.grade != null && bin.grade >= 5.0;
  const isOwnGrade = (bin) => hasOwn && bin.grade === ownGrade;

  const root = el('div', 'tsk-ns');
  // Alles, was die eigene Note verrät; „Note verbergen" schaltet genau diese
  // Klassen ab, statt Stile im Verbergen-Modus zurückzusetzen.
  const ownMarks = [];

  // --- Kopf -----------------------------------------------------------------
  // „Note verbergen" sitzt oben rechts: Man braucht es direkt vor dem
  // Screenshot. Hell/Dunkel steht unten neben der Quelle; eine eigene
  // Werkzeugzeile kostete das Blatt eine ganze Zeile Höhe.
  // Noten-Umschalter: Auge / Auge durchgestrichen. Hell/Dunkel/System liegt im
  // Einstellungsfenster hinter dem Symbol daneben.
  let setAnon = () => {};
  const tools = [];
  if (hasOwn) {
    const note = el('div', 'tsk-ns__note');
    note.title = 'Blendet Note, Markierung und Einordnung aus, etwa für Screenshots';
    const label = el('span', 'tsk-ns__note-label', 'Note');
    label.setAttribute('aria-hidden', 'true');
    note.append(
      label,
      buildIconSegments(uid + '-note', 'Eigene Note', [
        ['show', 'Note zeigen', 'eye'],
        ['hide', 'Note verbergen', 'eye-off'],
      ], 'show', (v) => setAnon(v === 'hide'))
    );
    tools.push(note);
  }
  tools.push(buildSettings(uid));
  const examiner = opts.examiner ?? exam.examiner ?? null;
  root.appendChild(
    buildHeader({
      kicker: semesterLabel(exam.semester),
      title: exam.title ?? 'Prüfung',
      titleId: uid + '-title',
      meta: [
        exam.code && { text: exam.code, code: true },
        examiner && { text: examiner },
      ].filter(Boolean),
      tools,
      onClose: opts.onClose,
    })
  );

  const body = el('div', 'tuda-modal__body tsk-ns__body');
  root.appendChild(body);

  // --- Kennzahlen -----------------------------------------------------------------
  // Gehören zum Notenspiegel: zentriert unten in seiner Karte, nicht als lose
  // Zeile über allem. Krank und ohne Grund sind ein Fakt mit Notiz; die Quote
  // steht im Anteilsbalken und nicht noch einmal hier.
  const facts = el('dl', 'tuda-facts tuda-facts--center');
  facts.setAttribute('aria-label', 'Kennzahlen der Prüfung');
  // Die Werte zählen beim Öffnen hoch, nach den Anteilen.
  const addFact = (label, value, digits, note) => {
    const item = el('div', 'tuda-facts__item');
    item.appendChild(el('dt', 'tuda-facts__label', label));
    const dd = el('dd', 'tuda-facts__value');
    if (value == null) dd.textContent = '–';
    else if (animate) tskCountUp(dd, value, ENTER.facts, digits);
    else dd.textContent = de(value, digits);
    item.appendChild(dd);
    if (note) item.appendChild(el('dd', 'tuda-facts__note', note));
    facts.appendChild(item);
  };
  const sick = meta.absentSick;
  const unexcused = meta.absentUnexcused;
  const absent = sick == null && unexcused == null ? null : (sick ?? 0) + (unexcused ?? 0);
  addFact('Durchschnitt', meanValue, 2);
  addFact('Benotete Ergebnisse', stats.graded, 0);
  addFact(
    'Nicht angetreten',
    absent,
    0,
    sick != null && unexcused != null ? `${de(sick)} krank · ${de(unexcused)} ohne Grund` : null
  );
  addFact('Abweichendes BWS', meta.deviatingBws, 0);

  // --- Ergebnis ---------------------------------------------------------------------
  // Getönte Glaskarte des Systems (.tuda-result) in Statusfarbe: die Note groß in
  // Tinte, Einordnung und Siegel in Grün bzw. Rot – mit Wort, nie nur Farbe.
  let result = null;
  if (hasOwn) {
    const passed = ownGrade < 5.0;
    result = el('article', 'tuda-result tsk-result ' + (passed ? 'tuda-result--success' : 'tuda-result--error'));
    result.setAttribute('aria-label', 'Deine Note');
    if (animate) {
      result.classList.add('tuda-result--animate');
      result.style.setProperty('--delay', ENTER.badge + 'ms');
    }
    const resultBody = el('div', 'tuda-result__body');
    resultBody.appendChild(el('p', 'tuda-result__label', 'Deine Note'));
    const value = el('p', 'tuda-result__value');
    value.appendChild(el('span', 'tuda-result__number', de(ownGrade, 1)));
    // Bei 5,0 läse sich die Perzentil-Aussage absurd („Oberes 100 %"). Dann die Quote.
    value.appendChild(
      el(
        'span',
        'tuda-result__meta',
        passed
          ? `Oberes ${de(Math.ceil(own.topPercentile))} %`
          : `${de(stats.failed)} von ${de(stats.graded)} nicht bestanden (${pct(stats.failRate, 0)})`
      )
    );
    resultBody.appendChild(value);
    result.appendChild(resultBody);

    const status = el('div', 'tuda-result__status');
    const mark = el('span', 'tuda-result__mark');
    mark.appendChild(tskIcon(document, passed ? 'check' : 'x', { draw: animate }));
    // Im Matt-Design steht nur das Symbol; das Wort bleibt für Screenreader.
    status.append(mark, el('span', 'tuda-sr-only', passed ? 'Bestanden' : 'Nicht bestanden'));
    result.appendChild(status);
    body.appendChild(result);
  }

  // --- Verteilung ----------------------------------------------------------------
  const card = el('article', 'tuda-card tsk-dist');
  card.setAttribute('aria-label', 'Verteilung der Noten');
  const n = distribution.length;
  const top = niceTop(stats.maxCount);
  const chart = el('div', 'tuda-chart tuda-chart--distribution');
  chart.style.setProperty('--_n', String(n));
  chart.style.setProperty('--plot-h', PLOT_HEIGHT + 'px');
  if (animate) {
    chart.classList.add('tuda-chart--animate');
    chart.style.setProperty('--delay', ENTER.chart + 'ms');
  }
  const chartBody = el('div', 'tuda-chart__body');
  const plot = el('div', 'tuda-chart__plot');
  const barNodes = [];
  const line = buildLineLayer(distribution, stats, top, uid, isFailGrade, isOwnGrade, ownMarks);
  // Über das Attribut: SVG-Elemente kennen die hidden-Eigenschaft nicht.
  const show = (node, on) => node.toggleAttribute('hidden', !on);
  show(line.yAxis, false);
  for (const node of line.plotNodes) show(node, false);

  // Kopf der Karte: „Verteilung" und der Umschalter Balken / Linie.
  const cardHead = el('div', 'tsk-ns__cardhead');
  cardHead.appendChild(el('h3', null, 'Verteilung'));
  cardHead.appendChild(
    buildIconSegments(uid + '-mode', 'Darstellung der Verteilung', [
      ['bars', 'Balken', 'bars'],
      ['line', 'Linie', 'line'],
    ], 'bars', (mode) => {
      const isLine = mode === 'line';
      chart.classList.toggle('ns-chart--line', isLine);
      show(line.yAxis, isLine);
      for (const node of line.plotNodes) show(node, isLine);
      for (const node of barNodes) show(node, !isLine);
      const shown = isLine ? line.plotNodes : barNodes;
      for (const node of shown) {
        node.classList.remove('is-entering');
        void node.getBoundingClientRect();
        node.classList.add('is-entering');
      }
    })
  );
  card.appendChild(cardHead);

  const meanX = gradeToX(distribution, meanValue);
  if (meanX != null) {
    const mean = el('div', 'tuda-chart__mean');
    mean.style.setProperty('--x', meanX + '%');
    const pill = el('span');
    pill.appendChild(el('small', null, 'Ø'));
    pill.appendChild(document.createTextNode(de(meanValue, 2)));
    mean.appendChild(pill);
    plot.appendChild(mean);

    // Liegt der Schnitt nah am Rand, ragte die zentrierte Kapsel aus dem Plot.
    // Dann nach innen schieben; die Linie bleibt am echten Wert.
    // Auch die Kapsel selbst beobachten: Lädt die Schrift nach dem ersten
    // Layout, wird sie breiter, ohne dass sich der Plot ändert. Gerundet wird
    // immer nach innen, sonst blieb ein Pixel Überstand.
    if (typeof ResizeObserver === 'function') {
      const clamp = () => {
        pill.style.setProperty('--shift', '0px');
        const lb = pill.getBoundingClientRect();
        const pb = plot.getBoundingClientRect();
        if (!pb.width) return;
        const shift = lb.right > pb.right ? Math.floor(pb.right - lb.right)
          : lb.left < pb.left ? Math.ceil(pb.left - lb.left)
          : 0;
        if (shift) pill.style.setProperty('--shift', shift + 'px');
      };
      const watch = new ResizeObserver(clamp);
      watch.observe(plot);
      watch.observe(pill);
    }
  }

  let ownBar = null;
  distribution.forEach((bin, i) => {
    const share = stats.graded ? bin.count / stats.graded : 0;
    const bar = el('div', 'tuda-chart__bar');
    bar.tabIndex = 0;
    bar.setAttribute('role', 'img');
    bar.style.setProperty('--h', (bin.count / top) * 100 + '%');
    bar.style.setProperty('--i', String(i));
    if (bin.count === 0) bar.classList.add('is-empty');
    // Status schlägt Betonung: Eine eigene 5,0 bleibt rot. Dass sie die eigene
    // ist, tragen das fette Wertlabel und die blaue Achsenbeschriftung.
    if (isFailGrade(bin)) bar.classList.add('is-error');
    const label = `Note ${bin.label}: ${de(bin.count)} Ergebnisse, ${pct(share)}`;
    bar.setAttribute('aria-label', label);
    if (isOwnGrade(bin)) {
      bar.classList.add('is-current');
      bar.dataset.labelOwn = label + ', deine Note';
      bar.dataset.labelAnon = label;
      bar.setAttribute('aria-label', bar.dataset.labelOwn);
      ownBar = bar;
      ownMarks.push(bar);
    }

    const value = el('span', 'tuda-chart__value');
    if (animate) tskCountUp(value, bin.count, ENTER.chart + i * 30 + 200);
    else value.textContent = de(bin.count);
    bar.appendChild(value);
    bar.appendChild(el('span', 'tuda-chart__tip', `${de(bin.count)} · ${pct(share)}`));
    plot.appendChild(bar);
    barNodes.push(bar);
  });
  plot.append(...line.plotNodes);
  chartBody.append(line.yAxis, plot);

  const axis = el('div', 'tuda-chart__axis');
  axis.setAttribute('aria-hidden', 'true');
  for (const bin of distribution) {
    const tick = el('span', null, bin.label);
    if (isFailGrade(bin)) tick.classList.add('is-error');
    if (isOwnGrade(bin)) {
      tick.classList.add('is-current');
      ownMarks.push(tick);
    }
    axis.appendChild(tick);
  }
  chartBody.appendChild(axis);
  chart.appendChild(chartBody);
  card.appendChild(chart);

  // --- Anteilsbalken ----------------------------------------------------------------
  if (stats.graded > 0) {
    const ratio = el('div', 'tuda-ratio');
    ratio.setAttribute('role', 'img');
    ratio.setAttribute(
      'aria-label',
      `Bestanden: ${de(stats.passed)} von ${de(stats.graded)} (${pct(stats.passRate, 0)}). ` +
        `Nicht bestanden: ${de(stats.failed)} (${pct(stats.failRate, 0)}).`
    );
    if (animate) {
      ratio.classList.add('tuda-ratio--animate');
      ratio.style.setProperty('--delay', ENTER.ratio + 'ms');
    }
    const labelStart = el('p', 'tuda-ratio__label', 'Bestanden');
    const labelEnd = el('p', 'tuda-ratio__label tuda-ratio__label--end', 'Nicht bestanden');
    const addValue = (count, share, end) => {
      const value = el('p', 'tuda-ratio__value' + (end ? ' tuda-ratio__value--end' : ''));
      // Zu schmal für den Wert im Segment: dann steht er neben der Anzahl,
      // sonst wäre er nirgends zu lesen.
      if (count && share < RATIO_INNER_MIN) value.classList.add('tuda-ratio__value--pct');
      const number = el('span');
      if (animate) tskCountUp(number, count, ENTER.ratio);
      else number.textContent = de(count);
      value.appendChild(number);
      value.appendChild(el('span', 'tuda-ratio__pct', pct(share, 0)));
      return value;
    };
    // Breiten aus den absoluten Zahlen, nicht aus gerundeten Prozentwerten.
    // Leere Seiten entfallen: Ein Mindest-Segment für 0 sähe aus wie „ein paar".
    const track = el('div', 'tuda-ratio__track');
    for (const [count, share, error] of [
      [stats.passed, stats.passRate, false],
      [stats.failed, stats.failRate, true],
    ]) {
      if (!count) continue;
      const seg = el('div', 'tuda-ratio__seg' + (error ? ' tuda-ratio__seg--error' : ''));
      seg.style.setProperty('--v', String(count));
      if (share >= RATIO_INNER_MIN) seg.appendChild(el('span', null, pct(share, 0)));
      track.appendChild(seg);
    }
    ratio.append(
      labelStart,
      labelEnd,
      addValue(stats.passed, stats.passRate, false),
      track,
      addValue(stats.failed, stats.failRate, true)
    );

    // Umschalten anhand der tatsächlichen Breiten, nicht der Fensterbreite:
    // Das Blatt kann in beliebig breiten Containern stehen.
    if (typeof ResizeObserver === 'function') {
      const segmentsFit = () =>
        [...track.children].every((seg) => {
          const inner = seg.firstElementChild;
          return !inner || seg.clientWidth >= inner.scrollWidth + 12;
        });
      const labelsFit = () =>
        labelEnd.getBoundingClientRect().left - labelStart.getBoundingClientRect().right >= 12;
      const sync = () => {
        ratio.classList.remove('tuda-ratio--compact');
        if (!ratio.clientWidth) return;
        if (!segmentsFit() || !labelsFit()) ratio.classList.add('tuda-ratio--compact');
      };
      new ResizeObserver(sync).observe(ratio);
    }
    card.appendChild(ratio);
  }
  card.appendChild(el('hr', 'tuda-divider'));
  card.appendChild(facts);
  body.appendChild(card);

  // --- Tabelle --------------------------------------------------------------------
  // Dauerhaft sichtbar: Sie ist zugleich die Textfassung des Diagramms.
  const wrap = el('div', 'tuda-table-wrap tsk-ns__table');
  const table = el('table', 'tuda-table tuda-table--dense tuda-table--transposed');
  table.appendChild(el('caption', 'tuda-sr-only', 'Notenspiegel: Anzahl und Anteil je Note'));
  const mark = (cell, bin) => {
    if (isFailGrade(bin)) {
      cell.classList.add('is-error');
      cell.dataset.fail = 'yes';
    }
    if (isOwnGrade(bin)) {
      cell.classList.add('is-current');
      cell.dataset.own = 'yes';
      ownMarks.push(cell);
    }
    return cell;
  };
  const rowHead = (text) => {
    const th = el('th', null, text);
    th.scope = 'row';
    return th;
  };
  const thead = el('thead');
  const headRow = el('tr');
  headRow.appendChild(rowHead('Note'));
  for (const bin of distribution) {
    const th = el('th', null, bin.label);
    th.scope = 'col';
    headRow.appendChild(mark(th, bin));
  }
  thead.appendChild(headRow);
  table.appendChild(thead);

  // Prozentzeichen in der Zeilenbeschriftung: Bei elf Spalten kostet es pro
  // Zelle Breite, die der Tabelle sonst zum Umbruch fehlt.
  let cumulative = 0;
  const rows = [
    ['Anzahl', true, distribution.map((bin) => de(bin.count))],
    ['Anteil %', false, distribution.map((bin) => de(stats.graded ? (bin.count / stats.graded) * 100 : 0, 1))],
    [
      'Kumuliert %',
      false,
      distribution.map((bin) => {
        cumulative += bin.count;
        return de(stats.graded ? (cumulative / stats.graded) * 100 : 0, 1);
      }),
    ],
  ];
  const tbody = el('tbody');
  for (const [label, primary, values] of rows) {
    const row = el('tr', primary ? 'is-primary' : null);
    row.appendChild(rowHead(label));
    values.forEach((value, i) => row.appendChild(mark(el('td', null, value), distribution[i])));
    tbody.appendChild(row);
  }
  table.appendChild(tbody);
  wrap.appendChild(table);
  body.appendChild(wrap);

  // --- Quelle und Erscheinungsbild -------------------------------------------------
  body.appendChild(el('p', 'tsk-ns__source', 'Quelle: TUCaN-Notenspiegel. Gestrichelt: Durchschnitt.'));

  // --- Note verbergen ---------------------------------------------------------------
  // Hervorhebungen werden abgeschaltet, nicht überschrieben: Ein Reset mit
  // „inherit" nahm früher den Wert des Elternelements und ließ die eigene
  // Spalte invertiert erkennbar. Klasse weg ist die einzige Variante, die nichts
  // verrät; eine eigene 5,0 bleibt dabei so rot wie jede andere 5,0.
  setAnon = (on) => {
    root.toggleAttribute('data-anon', on);
    if (result) result.hidden = on;
    for (const node of ownMarks) node.classList.toggle('is-current', !on);
    if (ownBar) ownBar.setAttribute('aria-label', on ? ownBar.dataset.labelAnon : ownBar.dataset.labelOwn);
  };

  // Einblende-Klassen nach dem Durchlauf entfernen. Zwei Gründe: Würde das
  // Blatt später neu eingehängt, liefe die Bewegung sonst erneut ab. Und in
  // einem verdeckten Tab steht die Zeitleiste der Animationen still – ohne
  // das Entfernen bliebe etwa das Siegel unsichtbar im Startzustand hängen.
  if (animate) {
    setTimeout(() => {
      chart.classList.remove('tuda-chart--animate');
      root.querySelector('.tuda-ratio')?.classList.remove('tuda-ratio--animate');
      result?.classList.remove('tuda-result--animate');
    }, ENTER.chart + n * 30 + 1200);
  }
  return root;
}

/**
 * Blatt im Seitenfluss (Demo, Tests): gekapselt im Shadow DOM, als statische
 * Variante des System-Dialogs (.tuda-modal--static).
 */
function mountNotenspiegel(host, data, opts = {}) {
  const app = tskCreateApp(host, tskStyles());
  const sheet = el('div', 'tuda-modal tuda-modal--lg tuda-modal--page tuda-modal--static tsk-sheet');
  sheet.setAttribute('role', 'region');
  sheet.setAttribute('aria-label', 'Notenspiegel');
  const node = renderNotenspiegel(data, opts);
  sheet.appendChild(node);
  app.appendChild(sheet);
  return node;
}

/**
 * Notenspiegel als nativer Dialog des Systems (dialog.tuda-modal--lg).
 *
 * showModal() bringt Fokusfalle, Escape, Top Layer und ein inertes TUCaN
 * dahinter mit; der Dialog liegt im Shadow DOM, damit TUCaNs Stylesheet nicht
 * hineingreift. Ein- und Ausblenden regelt das System (@starting-style).
 */
function tskOpenSheet(doc) {
  const host = doc.createElement('div');
  host.setAttribute('data-tucan-skin', '');
  doc.body.appendChild(host);
  const app = tskCreateApp(host, tskStyles());
  const dialog = doc.createElement('dialog');
  dialog.className = 'tuda-modal tuda-modal--lg tuda-modal--page tsk-sheet';
  app.appendChild(dialog);

  let removed = false;
  const cleanup = () => {
    if (removed) return;
    removed = true;
    // Erst nach dem Ausblenden entfernen (duration-slow).
    setTimeout(() => host.remove(), 400);
  };
  const dismiss = () => {
    if (dialog.open) dialog.close();
    cleanup();
  };
  dialog.addEventListener('close', cleanup);
  // Klick auf die Abdunklung schließt; das Ziel ist dann der Dialog selbst.
  dialog.addEventListener('click', (ev) => {
    if (ev.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    const inside = ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
    if (!inside) dismiss();
  });
  dialog.showModal();

  const frame = (title, kicker) => {
    const node = el('div', 'tsk-ns');
    node.appendChild(buildHeader({ kicker, title, titleId: 'tsk-sheet-title', onClose: dismiss }));
    const body = el('div', 'tuda-modal__body tsk-ns__body');
    node.appendChild(body);
    dialog.setAttribute('aria-labelledby', 'tsk-sheet-title');
    return { node, body };
  };

  return {
    host,
    app,
    dialog,
    dismiss,
    setContent(node) {
      const title = node.querySelector('.tuda-modal__title');
      if (title && title.id) dialog.setAttribute('aria-labelledby', title.id);
      dialog.replaceChildren(node);
    },
    setLoading() {
      const { node, body } = frame('Notenspiegel', 'Wird geladen …');
      body.setAttribute('aria-busy', 'true');
      const box = el('div', 'tsk-ns__loading');
      const block = (cls, height) => {
        const s = el('span', 'tuda-skeleton ' + cls);
        if (height) s.style.height = height;
        return s;
      };
      box.append(block('tuda-skeleton--title'), block('tuda-skeleton--rect', '64px'), block('tuda-skeleton--rect', '300px'));
      body.appendChild(box);
      dialog.replaceChildren(node);
    },
    setError(message, retry) {
      const { node, body } = frame('Notenspiegel');
      const alert = el('div', 'tuda-alert tuda-alert--error');
      alert.setAttribute('role', 'alert');
      alert.appendChild(tskIcon(doc, 'alert-octagon'));
      const content = el('div', 'tuda-alert__content');
      content.appendChild(el('p', 'tuda-alert__title', 'Der Notenspiegel konnte nicht geladen werden'));
      content.appendChild(el('p', 'tuda-alert__text', message));
      if (retry) {
        const actions = el('div', 'tuda-alert__actions');
        const button = el('button', 'tuda-btn tuda-btn--secondary tuda-btn--sm', 'TUCaN-Ansicht öffnen');
        button.type = 'button';
        button.addEventListener('click', () => {
          dismiss();
          retry();
        });
        actions.appendChild(button);
        content.appendChild(actions);
      }
      alert.appendChild(content);
      body.appendChild(alert);
      dialog.replaceChildren(node);
    },
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { renderNotenspiegel, mountNotenspiegel, tskOpenSheet };
}
