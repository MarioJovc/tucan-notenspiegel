/**
 * Verbindungsstück des Userscripts.
 *
 * Läuft auf den Seiten "Modulergebnisse" und "Prüfungsergebnisse". Dort trägt
 * jede Zeile einen Ø-Link zum Notenspiegel-Popup. Das Skript fängt den Klick
 * ab, holt dieselbe Seite per fetch, parst sie und zeigt den Notenspiegel als
 * Dialog des Design Systems (tskOpenSheet in render.js), statt des Popups mit
 * der Zahlentabelle.
 *
 * Die eigene Note kommt aus der Zeile, in der geklickt wurde. Das ist wichtig:
 * Modul- und Prüfungsergebnisse führen UNTERSCHIEDLICHE Noten zum selben Modul
 * (Modulendnote gegen Note der einzelnen Prüfung), und der jeweilige
 * Notenspiegel gehört zur jeweiligen Note.
 */

/**
 * Notenspiegel laden und anzeigen.
 * Bei jedem Fehler bleibt der Weg in die Originalansicht offen — das Skript
 * soll nichts unerreichbar machen, was vorher erreichbar war.
 */
async function tskShowNotenspiegel(row, fallback) {
  const sheet = tskOpenSheet(document);
  sheet.setLoading();

  try {
    const response = await fetch(row.overviewUrl, { credentials: 'same-origin' });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    // TUCaN liefert je nach Seite Latin-1; der Parser bekommt sonst kaputte
    // Umlaute. Content-Type auswerten statt blind UTF-8 anzunehmen.
    const buffer = await response.arrayBuffer();
    const charset =
      (/charset=([\w-]+)/i.exec(response.headers.get('content-type') || '') || [])[1] || 'utf-8';
    const html = new TextDecoder(charset).decode(buffer);

    const doc = new DOMParser().parseFromString(html, 'text/html');
    const data = parseNotenspiegel(doc);
    if (!data.distribution.length) throw new Error('keine Verteilung gefunden');

    sheet.setContent(renderNotenspiegel(data, { ownGrade: row.grade, onClose: sheet.dismiss }));
  } catch (err) {
    sheet.setError(err.message, fallback);
  }
}

/** Ø-Links auf den Ergebnisseiten übernehmen. */
function tskEnhanceErgebnisse() {
  const page = parseErgebnisse(document);
  if (!page || !page.rows.length) return 0;

  let count = 0;
  for (const tr of document.querySelectorAll('tr')) {
    // Nicht über title="Notenspiegel": den schreibt TUCaN auf den
    // Prüfungsergebnissen um (siehe overviewAnchorOf).
    const anchor = overviewAnchorOf(tr);
    if (!anchor || anchor.dataset.tskBound) continue;

    // Zeile über die URL zuordnen statt über die Reihenfolge — Zeilen ohne
    // Link werden beim Parsen übersprungen, Indizes verschieben sich.
    const url = overviewUrlOf(tr);
    const row = page.rows.find((r) => r.overviewUrl === url);
    if (!row) continue;

    anchor.dataset.tskBound = '1';
    anchor.title = 'Notenspiegel als Diagramm';
    anchor.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      // Rückfallweg: das Original-Popup, wie TUCaN es geöffnet hätte.
      const fallback = () => window.open(row.overviewUrl, 'Gradeoverview', 'width=650,height=320');
      tskShowNotenspiegel(row, fallback);
    });
    count++;
  }
  return count;
}

/**
 * Startmeldung — bewusst IMMER, auch wenn nichts zu tun ist.
 *
 * Vorher meldete sich das Skript nur im Erfolgsfall. Blieb die Meldung aus,
 * war nicht zu unterscheiden, ob es gar nicht lief, die Seite nicht erkannt
 * wurde oder keine Links da waren. Für die Fehlersuche ist genau das die
 * entscheidende Information.
 */
function tskInit() {
  const heading = (document.querySelector('h1')?.textContent || '').replace(/\s+/g, ' ').trim();
  const linksImDom = [...document.querySelectorAll('tr')].filter((tr) => overviewAnchorOf(tr)).length;
  const erkannt = isErgebnissePage(document);

  // Auch als Objekt ablegen: in der Konsole per __tucanSkin abrufbar, ohne
  // die Seite neu laden zu müssen.
  const info = {
    // Aus dem Metadatenblock statt fest eingetragen — die feste Zahl hinkte
    // dem Header bereits eine Version hinterher.
    version: typeof GM_info !== 'undefined' ? GM_info.script.version : 'unbekannt',
    url: location.href.split('&ARGUMENTS=')[0],
    ueberschrift: heading || '(keine h1 gefunden)',
    seiteErkannt: erkannt,
    notenspiegelLinksImDom: linksImDom,
    uebernommen: 0,
  };
  window.__tucanSkin = info;

  if (erkannt) info.uebernommen = tskEnhanceErgebnisse();

  console.info(
    '[TUCaN Skin] ' +
      (erkannt
        ? info.uebernommen + ' von ' + linksImDom + ' Notenspiegel-Links übernommen.'
        : 'Seite nicht als Ergebnisliste erkannt — nichts geändert.'),
    info
  );
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', tskInit);
} else {
  tskInit();
}
