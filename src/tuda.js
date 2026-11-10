/**
 * Anbindung an das Design System „TUDa UI".
 *
 * Der Skin bringt keine eigenen Farben, Schriften oder Komponenten mehr mit.
 * Tokens, Komponenten-CSS und Schriften kommen unverändert aus vendor/tuda-ui:
 * Im Userscript bettet build.ps1 sie als TSK_VENDOR ein, Demo und Tests setzen
 * dasselbe Objekt per fetch. Diese Datei passt sie nur an den Einsatzort an,
 * ein Shadow DOM auf einer fremden Seite.
 *
 * bundle.js aus dem System wird bewusst NICHT geladen: Es legt window.TUDa an,
 * hängt Tooltips an document.body (außerhalb der Kapsel, also ungestylt) und
 * sucht Dialoge per document.getElementById. Gebraucht werden nur Icons und die
 * Theme-Logik; beides steht hier in klein und auf das Shadow Root bezogen.
 */

/** Zeichenbereich der Latin-Teilmenge, wie im Design System. */
const TSK_LATIN_RANGE =
  'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, ' +
  'U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';

/** Speicherschlüssel wie bei TUDa.theme, Werte light | dark | system. */
const TSK_THEME_KEY = 'tuda-theme';

/** Icons aus TUDa.icons (24-px-Raster), als Elementlisten statt HTML-Strings. */
const TSK_ICONS = {
  check: [['path', { d: 'M5 12.5l4.5 4.5L19 7.5' }]],
  x: [['path', { d: 'M6 6l12 12M18 6L6 18' }]],
  'alert-octagon': [
    ['path', { d: 'M8.4 3.5h7.2l5 5v7.2l-5 5H8.4l-5-5V8.5z' }],
    ['path', { d: 'M12 8v4.5M12 15.9v.1' }],
  ],
  sun: [
    ['circle', { cx: 12, cy: 12, r: 4 }],
    ['path', { d: 'M12 2.5v2M12 19.5v2M4.6 4.6L6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4' }],
  ],
  moon: [['path', { d: 'M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z' }]],
  monitor: [
    ['rect', { x: 3, y: 4.5, width: 18, height: 12, rx: 2 }],
    ['path', { d: 'M8.5 20h7M12 16.5V20' }],
  ],
  eye: [
    ['path', { d: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z' }],
    ['circle', { cx: 12, cy: 12, r: 3 }],
  ],
  'eye-off': [
    ['path', { d: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z' }],
    ['circle', { cx: 12, cy: 12, r: 3 }],
    ['path', { d: 'M4.5 4.5l15 15' }],
  ],
  settings: [
    ['path', { d: 'M4 7h9M17 7h3M4 17h3M11 17h9' }],
    ['circle', { cx: 15, cy: 7, r: 2 }],
    ['circle', { cx: 9, cy: 17, r: 2 }],
  ],
  bars: [
    ['rect', { x: 4.5, y: 11, width: 4, height: 9, rx: 1.2 }],
    ['rect', { x: 10, y: 4.5, width: 4, height: 15.5, rx: 1.2 }],
    ['rect', { x: 15.5, y: 8, width: 4, height: 12, rx: 1.2 }],
  ],
  line: [['path', { d: 'M3.5 19C7 19 7.5 9 11 9s3.5 6 6 6 2.5-7 3.5-9' }]],
  calendar: [
    ['rect', { x: 3.5, y: 5, width: 17, height: 15.5, rx: 2.5 }],
    ['path', { d: 'M3.5 10h17M8 3v4M16 3v4' }],
  ],
};

function tskVendor() {
  if (typeof TSK_VENDOR !== 'undefined' && TSK_VENDOR && TSK_VENDOR.css) return TSK_VENDOR;
  throw new Error('TUDa UI fehlt: TSK_VENDOR ist nicht gesetzt');
}

/**
 * CSS des Systems für ein Shadow Root umschreiben.
 *
 * - :root trifft im Shadow DOM nichts. Die Tokens hängen deshalb am Host.
 * - Grundschrift und Textfarbe setzt das System auf body. Die wandern auf
 *   .tsk-app, den Wrapper, der auch data-theme trägt. Auf dem Host wären sie
 *   falsch: color: var(--text-primary) würde dort mit den hellen Tokens
 *   aufgelöst und als fertige Farbe vererbt, ein data-theme="dark" darunter
 *   käme bei der Schrift nie an.
 * - @font-face wirkt im Shadow DOM nicht, siehe tskEnsureFonts.
 */
function tskAdaptCss(css) {
  return css
    .replace(/@font-face\s*\{[^}]*\}/g, '')
    .replace(/:root/g, ':host')
    .replace(/(^|[\s,}])html(?=\s*\{)/g, '$1:host')
    .replace(/(^|[\s,}])body(?=\s*\{)/g, '$1.tsk-app');
}

/** Schriften einmal pro Dokument anmelden; als data:-URL aus dem Userscript. */
function tskEnsureFonts(doc) {
  if (doc.getElementById('tsk-fonts')) return;
  const fonts = tskVendor().fonts || {};
  const face = (family, url, extra) =>
    url
      ? `@font-face{font-family:"${family}";src:url("${url}") format("woff2");${extra}` +
        `font-style:normal;font-display:swap;unicode-range:${TSK_LATIN_RANGE}}`
      : '';
  const style = doc.createElement('style');
  style.id = 'tsk-fonts';
  style.textContent =
    face('Archivo', fonts.archivo, 'font-weight:100 900;font-stretch:62% 125%;') +
    face('JetBrains Mono', fonts.mono, 'font-weight:100 800;');
  (doc.head || doc.documentElement).appendChild(style);
}

function tskIcon(doc, name, opts = {}) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = doc.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'tuda-icon' + (opts.size ? ' tuda-icon--' + opts.size : ''));
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  for (const [tag, attrs] of TSK_ICONS[name] || []) {
    const part = doc.createElementNS(ns, tag);
    for (const [key, value] of Object.entries(attrs)) part.setAttribute(key, String(value));
    // Für .tuda-badge--draw: normierte Länge, damit ein einziger dasharray-Wert
    // für jede Form reicht.
    if (opts.draw && tag === 'path') part.setAttribute('pathLength', '1');
    svg.appendChild(part);
  }
  return svg;
}

// Funktionsdeklarationen statt const: Demo und Tests laden die Quellen einzeln
// per eval, und const bliebe dabei in der jeweiligen Datei eingeschlossen.
function tskMedia(query) {
  return !!(typeof matchMedia === 'function' && matchMedia(query).matches);
}
function tskReducedMotion() {
  return tskMedia('(prefers-reduced-motion: reduce)');
}

function tskThemeMode() {
  try {
    const mode = localStorage.getItem(TSK_THEME_KEY);
    return mode === 'light' || mode === 'dark' ? mode : 'system';
  } catch (e) {
    return 'system'; // Speicher gesperrt: dann folgt das Widget dem System
  }
}

/** Alle offenen Wrapper, damit „System" einem Wechsel des Betriebssystems folgt. */
const tskApps = new Set();
let tskSystemWatch = null;

/**
 * Theme setzen. Der Wrapper trägt immer ein ausdrückliches data-theme, auch
 * im Modus „System": Dann ist die Auflösung an einer Stelle (hier) statt
 * zusätzlich in einer Media Query, die im Shadow DOM am Host hängen müsste.
 *
 * Beim Umschalten blenden die Farben über (.tsk-theming, nur Farbeigenschaften,
 * duration-slow). Bei reduzierter Bewegung nicht: Die Regel arbeitet mit
 * !important und würde die 0,01-ms-Vorgabe des Systems sonst überstimmen.
 */
function tskApplyTheme(app, mode, animate) {
  const effective = mode === 'light' || mode === 'dark'
    ? mode
    : tskMedia('(prefers-color-scheme: dark)') ? 'dark' : 'light';
  app.dataset.themeMode = mode;
  if (app.getAttribute('data-theme') === effective) return;
  if (animate && !tskReducedMotion()) {
    app.classList.add('tsk-theming');
    clearTimeout(app.tskThemeTimer);
    app.tskThemeTimer = setTimeout(() => app.classList.remove('tsk-theming'), 420);
  }
  app.setAttribute('data-theme', effective);
}

function tskSetThemeMode(app, mode) {
  try {
    localStorage.setItem(TSK_THEME_KEY, mode);
  } catch (e) {
    /* nicht speicherbar: gilt dann nur bis zum Schließen */
  }
  tskApplyTheme(app, mode, true);
}

function tskWatchSystemTheme() {
  if (tskSystemWatch || typeof matchMedia !== 'function') return;
  tskSystemWatch = matchMedia('(prefers-color-scheme: dark)');
  const follow = () => {
    for (const app of tskApps) {
      if (!app.isConnected) tskApps.delete(app);
      else if (app.dataset.themeMode === 'system') tskApplyTheme(app, 'system', true);
    }
  };
  if (tskSystemWatch.addEventListener) tskSystemWatch.addEventListener('change', follow);
  else tskSystemWatch.addListener(follow);
}

/**
 * Shadow Root mit dem CSS des Systems und einem Theme-Wrapper aufbauen.
 *
 * all: initial am Host stoppt die Vererbung von außen (Schrift, Laufweite,
 * Ausrichtung der fremden Seite). Custom Properties setzt all nicht zurück;
 * die Tokens kommen ohnehin von innen über :host.
 */
function tskCreateApp(host, css) {
  const doc = host.ownerDocument || document;
  tskEnsureFonts(doc);
  const shadow = host.shadowRoot || host.attachShadow({ mode: 'open' });
  shadow.textContent = '';
  host.style.all = 'initial';
  host.style.display = 'block';

  const style = doc.createElement('style');
  style.textContent = css;
  shadow.appendChild(style);

  const app = doc.createElement('div');
  app.className = 'tsk-app';
  app.lang = 'de';
  tskApplyTheme(app, tskThemeMode(), false);
  shadow.appendChild(app);
  tskApps.add(app);
  tskWatchSystemTheme();
  return app;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { tskAdaptCss, tskIcon, tskCreateApp, tskApplyTheme, tskSetThemeMode, tskThemeMode };
}
