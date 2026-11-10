/**
 * Parser für den TUCaN-Leistungsspiegel.
 *
 * Quelle: CampusNet 15.00.003, PRGNAME=STUDENT_RESULT / students_results.htm
 *
 * Die Seite listet alle Module des Studiengangs, gruppiert nach Studienbereich
 * (nicht nach Semester!). Sie ist die Quelle für die eigene Note, die der
 * Notenspiegel selbst nicht kennt.
 *
 * Aufbau der Tabelle (table.students_results):
 *   tr.subhead.levelNN   Bereichsüberschrift, Tiefe über die Ziffer
 *   tr > td.tbdata ×7    Modulzeile: Nr | Titel | Datum | Credits |
 *                        Angerechnet | Note | Status
 *   tr > td.levelNN[colspan=2] "Summe …"      Zwischensumme
 *   tr > td.levelNN[colspan=7] "In diesem …"  Soll-Credits des Bereichs
 *
 * Zwei Fallen, die den naiven Ansatz scheitern lassen:
 *   1. Der Status ist ein BILD, kein Text (img alt="Bestanden"/"Offen").
 *      Über textContent wäre die Spalte immer leer.
 *   2. td.tbdata und td.levelNN sehen strukturell ähnlich aus; nur die
 *      Datenzeilen tragen tbdata, Summen- und Infozeilen tragen levelNN.
 */

/** "  9,0" -> 9 ; "1,7" -> 1.7 ; "" / "&nbsp;" -> null */
function lsNum(text) {
  if (text == null) return null;
  const cleaned = String(text).replace(/ /g, ' ').trim().replace(',', '.');
  if (cleaned === '' || cleaned === '-') return null;
  const value = Number.parseFloat(cleaned);
  return Number.isNaN(value) ? null : value;
}

function lsClean(text) {
  return String(text ?? '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Text einer Zelle ohne Beiwerk.
 *
 * Die Titelzelle enthält hinter dem Link ein inline eingebettetes <script>,
 * das die Popup-URL umschreibt. textContent zieht dessen Quelltext mit — die
 * Titel endeten dadurch auf Fragmente wie "<!-- var PopupLink=d".
 */
function cellText(cell) {
  if (!cell) return '';
  const anchor = cell.querySelector('a');
  if (anchor) return lsClean(anchor.textContent);
  const clone = cell.cloneNode(true);
  for (const junk of clone.querySelectorAll('script, style')) junk.remove();
  return lsClean(clone.textContent);
}

/**
 * Zellen auf Spaltenpositionen abbilden.
 *
 * In Summenzeilen überspannt die erste Zelle zwei Spalten, in Datenzeilen
 * nicht. Ohne diese Aufweitung liest man Summen um eine Spalte verschoben —
 * die Credits landeten in "Angerechnet" und "Angerechnet" blieb leer.
 */
function cellsByColumn(row) {
  const columns = [];
  for (const cell of row.cells) {
    for (let i = 0; i < (cell.colSpan || 1); i++) columns.push(cell);
  }
  return columns;
}

/** Tiefe aus "subhead level02" lesen. */
function levelOf(el) {
  const match = /\blevel(\d+)\b/.exec(el.className || '');
  return match ? Number(match[1]) : null;
}

/**
 * Spaltenzuordnung aus dem thead statt über feste Indizes: die erste
 * Kopfzelle spannt zwei Spalten (Nummer + Titel), und ob eine Spalte
 * "Angerechnet" existiert, hängt vom Studiengang ab.
 */
function columnMap(table) {
  const headRow = table.tHead?.rows?.[0] ?? table.rows[0];
  const columns = [];
  if (headRow) {
    for (const cell of headRow.cells) {
      const label = lsClean(cell.textContent);
      for (let i = 0; i < (cell.colSpan || 1); i++) columns.push(label);
    }
  }
  const indexOf = (name) => columns.findIndex((c) => c.toLowerCase() === name);
  return {
    code: 0,
    title: 1,
    date: indexOf('datum'),
    credits: indexOf('credits'),
    counted: indexOf('angerechnet'),
    grade: indexOf('note'),
    status: indexOf('status'),
  };
}

/** Status aus dem Bild in der Zelle (alt/title), nicht aus dem Text. */
function statusOf(cell) {
  if (!cell) return null;
  const img = cell.querySelector('img');
  const label = lsClean(img?.getAttribute('alt') || img?.getAttribute('title') || cell.textContent);
  return label || null;
}

/**
 * Verweis auf die Ergebnisdetails, sofern vorhanden. Die Modulzeile verlinkt
 * per Popup auf PRGNAME=RESULTDETAILS; die id am Anker (result_id_<n>) ist
 * der stabile Teil, die URL enthält die flüchtige Session.
 */
function detailsIdOf(cell) {
  const anchor = cell?.querySelector('a[id^="result_id_"]');
  return anchor ? anchor.id.replace('result_id_', '') : null;
}

/**
 * Anforderungszeile eines Bereichs. TUCaN nutzt drei Formulierungen:
 *
 *   "In diesem Bereich sind 39,0 Credits einzubringen."
 *   "In diesem Bereich sind mindestens 0 und maximal 3 Module zu belegen."
 *   "Es sind mindestens 3,0 Credits einzubringen. Die Ergebnisse von maximal
 *    6,0 Credits gehen in die Notenberechnung ein."
 *
 * Die dritte ist für den Schnitt entscheidend: Sie belegt, dass die
 * Prüfungsordnung nicht alle bestandenen Credits in die Note einrechnet.
 * Ein einfaches CP-gewichtetes Mittel über alle Module weicht deshalb
 * zwangsläufig von der offiziellen GPA ab.
 */
function parseRequirement(text) {
  const req = {
    text,
    requiredCredits: null,
    minCredits: null,
    maxGradedCredits: null,
    minModules: null,
    maxModules: null,
  };
  let m;
  if ((m = /sind\s+([\d.,]+)\s*Credits\s+einzubringen/i.exec(text))) {
    req.requiredCredits = lsNum(m[1]);
  }
  if ((m = /mindestens\s+([\d.,]+)\s*Credits/i.exec(text))) req.minCredits = lsNum(m[1]);
  if ((m = /maximal\s+([\d.,]+)\s*Credits\s+gehen\s+in\s+die\s+Notenberechnung/i.exec(text))) {
    req.maxGradedCredits = lsNum(m[1]);
  }
  if ((m = /mindestens\s+(\d+)\s+und\s+maximal\s+(\d+)\s+Module/i.exec(text))) {
    req.minModules = Number(m[1]);
    req.maxModules = Number(m[2]);
  }
  return req;
}

function parseLeistungsspiegel(doc = document) {
  const table = doc.querySelector('table.students_results');
  if (!table) return null;

  const col = columnMap(table);
  const modules = [];
  const sums = [];
  const requirements = [];
  const path = [];

  for (const row of table.rows) {
    if (!row.cells.length) continue;
    const cells = cellsByColumn(row);

    // Bereichsüberschrift
    const headLevel = row.classList.contains('subhead') ? levelOf(row) : null;
    if (headLevel != null) {
      path.length = headLevel;         // tiefere Ebenen verwerfen
      path[headLevel] = lsClean(cells[0].textContent);
      continue;
    }

    const first = cells[0];
    const firstLevel = levelOf(first);

    // Infozeile über die geforderten Credits eines Bereichs
    if (firstLevel != null && (first.colSpan || 1) > 2) {
      const text = cellText(first);
      if (text) {
        // Auf die eigene Ebene zuschneiden: der Pfad steht beim Erreichen
        // der Zeile noch auf dem zuletzt gesehenen Unterbereich, nicht auf
        // dem, zu dem die Anforderung gehört.
        requirements.push({
          area: path.slice(0, firstLevel + 1).filter(Boolean).join(' / '),
          level: firstLevel,
          ...parseRequirement(text),
        });
      }
      continue;
    }

    // Zwischensumme
    if (firstLevel != null) {
      sums.push({
        area: lsClean(first.textContent).replace(/^Summe\s*/i, ''),
        level: firstLevel,
        credits: lsNum(cells[col.credits]?.textContent),
        counted: col.counted >= 0 ? lsNum(cells[col.counted]?.textContent) : null,
      });
      continue;
    }

    // Modulzeile — erkennbar an tbdata, nicht an der Zellenzahl
    if (!first.classList.contains('tbdata')) continue;
    const code = cellText(first);
    const title = cellText(cells[col.title]);
    if (!code && !title) continue;

    const gradeLabel = cellText(cells[col.grade]);
    modules.push({
      code,
      title,
      area: path.filter(Boolean).join(' / '),
      areaPath: path.filter(Boolean).slice(),
      date: lsClean(cells[col.date]?.textContent) || null,
      credits: lsNum(cells[col.credits]?.textContent),
      counted: col.counted >= 0 ? lsNum(cells[col.counted]?.textContent) : null,
      gradeLabel: gradeLabel || null,
      grade: lsNum(gradeLabel),
      status: statusOf(cells[col.status]),
      detailsId: detailsIdOf(cells[col.title]),
    });
  }

  return { modules, sums, requirements, gpa: parseGpa(doc), stats: summarize(modules) };
}

/** GPA-Tabelle am Seitenende: zwei th je Zeile, Bezeichnung und Wert. */
function parseGpa(doc) {
  const result = { overall: null, major: null };
  for (const row of doc.querySelectorAll('table.students_results tr')) {
    const cells = [...row.cells];
    if (cells.length !== 2) continue;
    const label = lsClean(cells[0].textContent).toLowerCase();
    const value = lsNum(cells[1].textContent);
    if (label.startsWith('gesamt-gpa')) result.overall = value;
    else if (label.startsWith('hauptfach-gpa')) result.major = value;
  }
  return result;
}

/**
 * Kennzahlen über die benoteten Module.
 *
 * ACHTUNG: Der Schnitt hier ist ein schlichtes, mit Credits gewichtetes
 * Mittel über alle benoteten Module. Die Prüfungsordnung kann anders rechnen
 * (Bonusmodule, Beste-n-Regeln, Sondergewicht der Abschlussarbeit). Als
 * verbindlicher Wert gilt die GPA aus TUCaN, nicht dieser.
 */
function summarize(modules) {
  const graded = modules.filter((m) => m.grade != null);
  const weighted = graded.filter((m) => m.credits != null && m.credits > 0);
  const creditSum = weighted.reduce((s, m) => s + m.credits, 0);
  const weightedMean = creditSum
    ? weighted.reduce((s, m) => s + m.grade * m.credits, 0) / creditSum
    : null;

  return {
    total: modules.length,
    graded: graded.length,
    open: modules.filter((m) => m.grade == null).length,
    passed: modules.filter((m) => /bestanden/i.test(m.status ?? '') && !/nicht/i.test(m.status ?? '')).length,
    creditsCounted: modules.reduce((s, m) => s + (m.counted ?? 0), 0),
    weightedMean,
    unweightedMean: graded.length
      ? graded.reduce((s, m) => s + m.grade, 0) / graded.length
      : null,
  };
}

/** Note zu einer Modulnummer — der Weg vom Notenspiegel zur eigenen Note. */
function gradeForModule(result, code) {
  if (!result) return null;
  const wanted = String(code).trim().toLowerCase();
  const hit = result.modules.find((m) => m.code.toLowerCase() === wanted && m.grade != null);
  return hit ? hit.grade : null;
}

function isLeistungsspiegelPage(doc = document) {
  return /^leistungsspiegel/i.test(lsClean(doc.querySelector('h1')?.textContent));
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    parseLeistungsspiegel, isLeistungsspiegelPage, gradeForModule,
  };
}
