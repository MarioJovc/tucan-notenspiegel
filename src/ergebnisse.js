/**
 * Parser für die beiden Ergebnislisten in TUCaN:
 *
 *   PRGNAME=STUDENT_RESULT / Modulergebnisse   „Modulnoten WiSe 2025/26 für …“
 *   PRGNAME=EXAMRESULTS   / Prüfungsergebnisse „Prüfungsergebnisse WiSe … für …“
 *
 * Beide sind für das Projekt zentral, weil jede Zeile den Link zum
 * Notenspiegel trägt (PRGNAME=GRADEOVERVIEW, title="Notenspiegel"). Das ist
 * der Einhängepunkt: Zeile kennt die eigene Note, Link führt zur Verteilung.
 *
 * Der Name der studierenden Person steht in der Überschrift, wird aber
 * bewusst nicht ausgelesen — für die Auswertung wird er nicht gebraucht.
 */

const ERG_GRADE_RE = /^\d(?:[,.]\d)?$/;

function ergClean(text) {
  return String(text ?? '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
}

function ergNum(text) {
  const cleaned = ergClean(text).replace(',', '.');
  if (cleaned === '') return null;
  const value = Number.parseFloat(cleaned);
  return Number.isNaN(value) ? null : value;
}

/** Zelltext ohne eingebettete Skripte (TUCaN legt sie mitten in Zellen ab). */
function ergCellText(cell) {
  if (!cell) return '';
  const clone = cell.cloneNode(true);
  for (const junk of clone.querySelectorAll('script, style')) junk.remove();
  return ergClean(clone.textContent);
}

/**
 * Zelle an <br> in Zeilen zerlegen. Nötig für die Prüfungsergebnisse, wo
 * Nummer, Titel und Prüfungsart in EINER Zelle stehen. innerText wäre der
 * bequeme Weg, liefert in einem per DOMParser erzeugten Dokument aber nichts
 * Verlässliches — es gibt kein Layout.
 */
function ergLines(cell) {
  if (!cell) return [];
  const lines = [];
  let current = '';
  const walk = (node) => {
    for (const child of node.childNodes) {
      if (child.nodeType === 3) current += child.nodeValue;
      else if (child.nodeName === 'BR') {
        lines.push(current);
        current = '';
      } else if (child.nodeName === 'SCRIPT' || child.nodeName === 'STYLE') continue;
      else walk(child);
    }
  };
  walk(cell);
  lines.push(current);
  return lines.map(ergClean).filter(Boolean);
}

/** "04-10-0118/de  Mathematik I für Informatik" -> { code, title } */
function splitCodeAndTitle(line) {
  const match = /^(\d{2}-[\dA-Za-z-]+(?:\/[\dA-Za-z]+)?)\s+(.*)$/.exec(line);
  return match ? { code: match[1], title: ergClean(match[2]) } : { code: null, title: line };
}

/** Spaltenzuordnung aus der Kopfzeile, robust gegen colspan. */
function ergColumns(table) {
  const headRow = table.tHead?.rows?.[0] ?? table.rows[0];
  const columns = [];
  if (headRow) {
    for (const cell of headRow.cells) {
      const label = ergClean(cell.textContent).toLowerCase();
      for (let i = 0; i < (cell.colSpan || 1); i++) columns.push(label);
    }
  }
  return columns;
}

/**
 * URL aus einer Zeile ziehen — und zwar so, dass es auch auf der LIVE-Seite
 * funktioniert.
 *
 * TUCaN hängt hinter jeden Popup-Link ein Inline-Skript, das den href durch
 * "javascript:open_overview0001();" ersetzt. Im Fixture fällt das nicht auf,
 * weil DOMParser keine Skripte ausführt — dort steht die echte URL noch im
 * href. Auf der geladenen Seite ist sie weg. Deshalb: href nur nehmen, wenn
 * er keine javascript:-URL ist, sonst aus dem dl_popUp()-Aufruf des
 * Nachbarskripts lesen.
 */
function urlFromRow(row, program) {
  const anchor = [...row.querySelectorAll('a')].find((a) => {
    const href = a.getAttribute('href') ?? '';
    return href.includes('PRGNAME=' + program);
  });
  const href = anchor?.getAttribute('href') ?? '';
  if (href && !/^javascript:/i.test(href)) return href;

  const pattern = new RegExp('dl_popUp\\(\\s*"([^"]*PRGNAME=' + program + '[^"]*)"', 'i');
  for (const script of row.querySelectorAll('script')) {
    const match = pattern.exec(script.textContent || '');
    if (match) return match[1];
  }
  return null;
}

/**
 * Den Notenspiegel-Link einer Zeile finden — auf der LIVE-Seite.
 *
 * Nach dem Laden taugen weder href noch title als Merkmal: TUCaNs
 * Inline-Skripte schreiben den href auf "javascript:open_popup0001();" um,
 * und auf den Prüfungsergebnissen zusätzlich den title auf "Link öffnet ein
 * popup-Fenster für Notenspiegel". Ein Selektor auf title="Notenspiegel"
 * fand dort deshalb keinen einzigen Link — das Skript blieb wirkungslos,
 * während es auf den Modulergebnissen (title unverändert) funktionierte.
 *
 * Verlässlich ist die Verdrahtung selbst: Das Skript, das den
 * GRADEOVERVIEW-Aufruf enthält, benennt per getElementById("…") genau den
 * Link, den es bedient. Das hängt weder an Sprache noch an Titeltext.
 * Titel und href bleiben als Rückfall für Seiten ohne dieses Muster.
 */
function overviewAnchorOf(row) {
  const doc = row.ownerDocument;
  for (const script of row.querySelectorAll('script')) {
    const text = script.textContent || '';
    if (!/PRGNAME=GRADEOVERVIEW/i.test(text)) continue;
    const match = /getElementById\(\s*["']([^"']+)["']\s*\)/.exec(text);
    // Bewusst getElementById statt querySelector('#…'): IDs müssten sonst
    // mit CSS.escape maskiert werden, und im Userscript-Bündel ist "CSS"
    // durch die Stylesheet-Konstante des Renderers verdeckt.
    const anchor = match ? doc.getElementById(match[1]) : null;
    if (anchor && row.contains(anchor)) return anchor;
  }
  return row.querySelector('a[href*="PRGNAME=GRADEOVERVIEW"], a[title*="Notenspiegel"]');
}

function overviewUrlOf(row) {
  // urlFromRow liest bei umgeschriebenem href den dl_popUp()-Aufruf — ohne
  // Umweg über den title, der auf den Prüfungsergebnissen verändert wird.
  return urlFromRow(row, 'GRADEOVERVIEW');
}

function detailsUrlOf(row) {
  return urlFromRow(row, 'RESULTDETAILS');
}

function parseErgebnisse(doc = document) {
  const heading = ergClean(doc.querySelector('h1')?.textContent);
  const kind = /^modulnoten/i.test(heading)
    ? 'modul'
    : /^prüfungsergebnisse/i.test(heading)
      ? 'pruefung'
      : null;
  if (!kind) return null;

  const semester = (/(?:WiSe|SoSe|WS|SS)\s*[\d/]+/i.exec(heading) ?? [null])[0];

  // Die Ergebnistabelle ist die, deren Zeilen den Notenspiegel-Link tragen.
  // Über overviewAnchorOf statt über title/href — beides ist auf der
  // Live-Seite umgeschrieben (siehe dort).
  const table = [...doc.querySelectorAll('table')].find((t) =>
    [...t.rows].some((r) => overviewAnchorOf(r))
  );
  if (!table) return { kind, semester, rows: [], semesterGpa: parseSemesterGpa(doc) };

  const columns = ergColumns(table);
  const indexOf = (...names) =>
    columns.findIndex((c) => names.some((n) => c.startsWith(n)));
  const col = {
    code: indexOf('nr'),
    title: indexOf('kursname', 'name'),
    grade: indexOf('endnote', 'note'),
    credits: indexOf('credits'),
    status: indexOf('status'),
    date: indexOf('datum'),
  };

  const rows = [];
  const body = table.tBodies[0] ?? table;
  for (const row of body.rows) {
    if (row.parentNode === table.tHead) continue;
    const cells = [];
    for (const cell of row.cells) {
      for (let i = 0; i < (cell.colSpan || 1); i++) cells.push(cell);
    }
    if (!cells.length) continue;

    const overviewUrl = overviewUrlOf(row);
    // Zeilen ohne Notenspiegel-Link sind Kopf-, Summen- oder GPA-Zeilen.
    if (!overviewUrl) continue;

    let code = null;
    let title = null;
    let examType = null;

    if (col.code >= 0 && col.code !== col.title) {
      code = ergCellText(cells[col.code]) || null;
      title = ergCellText(cells[col.title]) || null;
    } else {
      // Prüfungsergebnisse: alles in einer Zelle, durch <br> getrennt.
      const lines = ergLines(cells[col.title >= 0 ? col.title : 0]);
      const first = splitCodeAndTitle(lines[0] ?? '');
      code = first.code;
      title = first.title;
      examType = lines.slice(1).join(' · ') || null;
    }

    const gradeLabel = col.grade >= 0 ? ergCellText(cells[col.grade]) : '';
    rows.push({
      code,
      title,
      examType,
      date: col.date >= 0 ? ergCellText(cells[col.date]) || null : null,
      gradeLabel: gradeLabel || null,
      // "b" (bestanden) und ähnliche Kürzel sind keine Zahlen — sie bleiben
      // als Label erhalten, grade bleibt null.
      grade: ERG_GRADE_RE.test(gradeLabel) ? ergNum(gradeLabel) : null,
      credits: col.credits >= 0 ? ergNum(ergCellText(cells[col.credits])) : null,
      status: col.status >= 0 ? ergCellText(cells[col.status]) || null : null,
      // Die Prüfungsergebnisse führen keine Status-Spalte. Die unbeschriftete
      // Zelle nach der Note enthält die Note in Worten ("sehr gut", "gut") —
      // bei unbenoteten Leistungen steht dort "bestanden". Das ist also KEIN
      // Status, auch wenn es bei "b" danach aussieht.
      gradeText: (() => {
        if (col.status >= 0) return null;
        const next = col.grade >= 0 ? cells[col.grade + 1] : null;
        if (!next || next.querySelector('a')) return null;
        return ergCellText(next) || null;
      })(),
      overviewUrl,
      detailsUrl: detailsUrlOf(row),
    });
  }

  return { kind, semester, rows, semesterGpa: parseSemesterGpa(doc) };
}

/**
 * "Semester-GPA  2,313" am Tabellenende.
 *
 * Die Zeile endet mit einer leeren Füllzelle — die letzte Zelle zu nehmen
 * liefert deshalb null. Genommen wird die erste Zelle nach der Beschriftung,
 * die überhaupt eine Zahl enthält.
 */
function parseSemesterGpa(doc) {
  for (const row of doc.querySelectorAll('tr')) {
    const cells = [...row.cells];
    if (cells.length < 2) continue;
    if (!/semester-gpa/i.test(ergClean(cells[0].textContent))) continue;
    for (const cell of cells.slice(1)) {
      const value = ergNum(ergCellText(cell));
      if (value != null) return value;
    }
  }
  return null;
}

function isErgebnissePage(doc = document) {
  return /^(modulnoten|prüfungsergebnisse)/i.test(
    ergClean(doc.querySelector('h1')?.textContent)
  );
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { parseErgebnisse, isErgebnissePage };
}
