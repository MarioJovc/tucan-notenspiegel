/**
 * Parser für den TUCaN-Notenspiegel (Popup einer einzelnen Prüfung).
 *
 * Quelle: CampusNet 15.00.003, PRGNAME=GRADEOVERVIEW / students_grades_diagramm.htm
 * Die Seite zeigt die Notenverteilung der gesamten Kohorte für EINE Prüfung,
 * nicht die eigene Note. Die eigene Note kommt aus dem Leistungsspiegel.
 *
 * Bewusst ohne CSS-Pfade: gematcht wird über Textmuster und Label-Präfixe,
 * damit ein Layout-Update von Datenlotsen den Parser nicht sofort zerlegt.
 */

/** Note im deutschen Format: 1,0 – 5,0 (auch 1.0 als Fallback). */
const GRADE_RE = /^\d(?:[,.]\d)?$/;

/** Ab dieser Note gilt eine Prüfung als nicht bestanden. */
const FAIL_THRESHOLD = 5.0;

/** "3,165" -> 3.165 ; "  8" -> 8 ; "" -> null */
function num(text) {
  if (text == null) return null;
  const cleaned = String(text).replace(/\s| /g, '').replace(',', '.');
  if (cleaned === '') return null;
  const value = Number.parseFloat(cleaned);
  return Number.isNaN(value) ? null : value;
}

/** Whitespace inkl. &nbsp; normalisieren. */
function clean(text) {
  return String(text ?? '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Kopfzeile aus <h2> zerlegen.
 * Beispiel: "01-99-1B01  Einführung in die Wirtschaftsinformatik, WiSe 2025/26"
 */
function parseExamHeading(doc) {
  const raw = clean(doc.querySelector('h2')?.textContent);
  if (!raw) return { code: null, title: null, semester: null, raw: '' };

  // Semester hängt hinten dran; Titel darf selbst Kommas enthalten,
  // deshalb nur das letzte Segment prüfen.
  let rest = raw;
  let semester = null;
  const semMatch = rest.match(
    /,\s*((?:WiSe|SoSe|WS|SS|Wintersemester|Sommersemester)\.?\s*[\d/]{2,})\s*$/i
  );
  if (semMatch) {
    semester = clean(semMatch[1]);
    rest = rest.slice(0, semMatch.index);
  }

  // Modulnummer ist das erste Token, wenn es wie ein TUCaN-Code aussieht
  // (Ziffern/Bindestriche, optional mit /-Suffix wie 01-15-1027/12).
  let code = null;
  let title = clean(rest);
  const codeMatch = title.match(/^([\d]{2}-[\dA-Za-z-]+(?:\/[\dA-Za-z]+)?)\s+(.*)$/);
  if (codeMatch) {
    code = codeMatch[1];
    title = clean(codeMatch[2]);
  }

  return { code, title: title || null, semester, raw };
}

/**
 * Verteilungstabelle finden: die Tabelle, die eine Zeile mit mehreren
 * Notenwerten enthält. Über den Klassennamen zu gehen wäre brüchiger,
 * weil "nb" auf der Seite mehrfach vorkommt.
 */
function findDistributionTable(doc) {
  for (const table of doc.querySelectorAll('table')) {
    for (const row of table.rows) {
      const hits = [...row.cells].filter((c) => GRADE_RE.test(clean(c.textContent)));
      if (hits.length >= 3) return { table, headerRow: row };
    }
  }
  return null;
}

/** Notenzeile + Anzahlzeile zu [{ grade, label, count }] verbinden. */
function parseDistribution(doc) {
  const found = findDistributionTable(doc);
  if (!found) return [];
  const { table, headerRow } = found;

  // Anzahlzeile: bevorzugt die mit Label "Anzahl", sonst die direkt darunter.
  const rows = [...table.rows];
  const headerIndex = rows.indexOf(headerRow);
  const countRow =
    rows.find((r) => /^anzahl/i.test(clean(r.cells[0]?.textContent))) ??
    rows[headerIndex + 1];
  if (!countRow) return [];

  const distribution = [];
  for (const cell of headerRow.cells) {
    const label = clean(cell.textContent);
    if (!GRADE_RE.test(label)) continue; // Label-Spalte ("Noten") überspringen

    // Spaltenweise zuordnen statt positionsweise: robuster gegen
    // zusätzliche Label-Spalten.
    const counterparts = [...countRow.cells];
    const countCell = counterparts[cell.cellIndex];
    distribution.push({
      label,
      grade: num(label),
      count: num(countCell?.textContent) ?? 0,
    });
  }
  return distribution;
}

/**
 * Kennzahlen unter der Tabelle. Stehen als <div class="tbdata">Label: Wert</div>.
 * Nur div, nicht td — die Tabellenzellen tragen dieselbe Klasse.
 */
function parseMeta(doc) {
  const meta = {
    average: null,
    resultsTotal: null,
    deviatingBws: null,
    absentSick: null,
    absentUnexcused: null,
  };

  const LABELS = [
    [/^durchschnitt/i, 'average'],
    [/^vorliegende ergebnisse/i, 'resultsTotal'],
    [/abweichendem bws/i, 'deviatingBws'],
    [/^fehlend \(krank/i, 'absentSick'],
    [/^fehlend \(ohne/i, 'absentUnexcused'],
  ];

  for (const div of doc.querySelectorAll('div.tbdata')) {
    const text = clean(div.textContent);
    const sep = text.indexOf(':');
    if (sep === -1) continue;
    const label = text.slice(0, sep);
    const value = num(text.slice(sep + 1));
    for (const [pattern, key] of LABELS) {
      if (pattern.test(label)) meta[key] = value;
    }
  }
  return meta;
}

/** Abgeleitete Statistik aus der Verteilung. */
function computeStats(distribution) {
  const graded = distribution.reduce((sum, d) => sum + d.count, 0);
  const passed = distribution
    .filter((d) => d.grade != null && d.grade < FAIL_THRESHOLD)
    .reduce((sum, d) => sum + d.count, 0);
  const failed = graded - passed;

  // Gewichteter Mittelwert über alle Noten (inkl. 5,0) — entspricht dem,
  // was TUCaN als "Durchschnitt" ausweist.
  const weighted = distribution.reduce(
    (sum, d) => (d.grade == null ? sum : sum + d.grade * d.count),
    0
  );
  const mean = graded > 0 ? weighted / graded : null;

  // Median über die kumulierte Häufigkeit (Noten aufsteigend = beste zuerst).
  const sorted = [...distribution]
    .filter((d) => d.grade != null)
    .sort((a, b) => a.grade - b.grade);
  let median = null;
  let seen = 0;
  for (const d of sorted) {
    seen += d.count;
    if (seen >= graded / 2) {
      median = d.grade;
      break;
    }
  }

  const best = sorted.find((d) => d.count > 0)?.grade ?? null;

  return {
    graded,
    passed,
    failed,
    passRate: graded > 0 ? passed / graded : null,
    failRate: graded > 0 ? failed / graded : null,
    mean,
    median,
    best,
    maxCount: distribution.reduce((m, d) => Math.max(m, d.count), 0),
  };
}

/**
 * Einordnung der eigenen Note in die Kohorte.
 * Kleinere Note = besser, deshalb "besser" = strikt kleiner.
 */
function rank(distribution, ownGrade) {
  if (ownGrade == null) return null;
  const total = distribution.reduce((sum, d) => sum + d.count, 0);
  if (total === 0) return null;

  let better = 0;
  let same = 0;
  let worse = 0;
  for (const d of distribution) {
    if (d.grade == null) continue;
    if (d.grade < ownGrade) better += d.count;
    else if (d.grade === ownGrade) same += d.count;
    else worse += d.count;
  }

  return {
    ownGrade,
    better,
    same,
    worse,
    total,
    // "Zu den besten X %" — konservativ gerechnet: alle Besseren plus
    // die eigene Notengruppe zählen mit hinein.
    topPercentile: ((better + same) / total) * 100,
    betterThanPercent: (worse / total) * 100,
  };
}

/** Hauptfunktion: komplettes Dokument -> strukturiertes Objekt. */
function parseNotenspiegel(doc = document) {
  const distribution = parseDistribution(doc);
  return {
    exam: parseExamHeading(doc),
    distribution,
    meta: parseMeta(doc),
    stats: computeStats(distribution),
  };
}

/** Erkennt, ob das aktuelle Dokument überhaupt ein Notenspiegel ist. */
function isNotenspiegelPage(doc = document) {
  const h1 = clean(doc.querySelector('h1')?.textContent);
  return /^notenspiegel/i.test(h1) && parseDistribution(doc).length > 0;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { parseNotenspiegel, isNotenspiegelPage, rank, computeStats, num, clean };
}
