# Entwicklung

Technische Notizen zum TUCaN-Notenspiegel: Aufbau, Gestaltung, Tests und die
Fallen, die beim Bauen aufgefallen sind. Für Installation und Nutzung reicht die
[README](README.md).

Kurz gesagt: Der **Ø**-Link auf „Modulergebnisse“ und „Prüfungsergebnisse“ öffnet
statt der Zahlentabelle den **Notenspiegel** als Diagramm, mit eigener Note,
Durchschnitt, Bestehensquote und Tabelle. Gestaltet ist alles mit dem Design
System **TUDa UI**.

Alle Zahlen in dieser Datei stammen aus den erfundenen Fixtures in `fixtures/`.

## Was drin ist

| Datei | Zweck |
|---|---|
| `src/notenspiegel.js` | Parser: DOM → strukturiertes Objekt (Verteilung, Kennzahlen, Statistik, Ranking) |
| `src/leistungsspiegel.js` | Parser für den Leistungsspiegel (noch nicht Teil des Userscripts) |
| `src/ergebnisse.js` | Parser für Modul- und Prüfungsergebnisse, liefert die Notenspiegel-Links |
| `src/tuda.js` | Anbindung an TUDa UI: CSS fürs Shadow DOM, Schriften, Theme, Icons |
| `src/render.js` | Pattern „Notenspiegel“ aus Systemkomponenten; Blatt im Seitenfluss (`mountNotenspiegel`) oder als Dialog (`tskOpenSheet`) |
| `userscript/glue.js` | Ø-Links übernehmen, Notenspiegel laden, Dialog öffnen |
| `vendor/tuda-ui/` | Unveränderte Kopie von Tokens, Komponenten-CSS und Schriften aus TUDa UI |
| `demo/index.html` | Demo mit Fixture- und Notenwahl, „Neu einblenden“ und „Als Dialog öffnen“ |
| `tests/index.html` | Renderer-Tests über 14 synthetische Verteilungen |
| `tests/live.html` | Live-Tests des gebauten Skripts auf beiden Ergebnisseiten |
| `tests/ausfuehren.mjs` | Führt beide Testseiten ohne Fenster aus, für den Workflow und die Kommandozeile |
| `fixtures/beispiel-*.html` | Erfundene TUCaN-Seiten als Testgrundlage: Notenspiegel, Modul- und Prüfungsergebnisse in der Struktur der echten Seiten |
| `fixtures/notenspiegel-extremfall.html` | Synthetisches Fixture für Randfälle (siehe unten) |
| `tools/validate_palette.js` | Palette-Validator; stammt aus der Zeit vor TUDa UI, die Farben kommen jetzt aus dem System |
| `docs/` | Projektseite für GitHub Pages |
| `.github/workflows/pages.yml` | Baut das Userscript, führt die Tests aus und veröffentlicht Skript, Projektseite und Demo |

Echte TUCaN-Seiten gehören nicht ins Repo: Auch mit ersetztem Namen enthalten sie
Module, Noten und Sitzungsnummern. Wer eigene Seiten zum Testen speichert, legt sie
neben die Fixtures und trägt sie in `.git/info/exclude` ein.

## Userscript bauen

```powershell
powershell -ExecutionPolicy Bypass -File build.ps1
```

Erzeugt `dist/tucan-skin.user.js` (~390 KB). Davon sind ~175 KB Schriften als
`data:`-URL und ~135 KB CSS des Systems. Zum Ausprobieren einer eigenen Fassung im
Tampermonkey-Dashboard das Skript öffnen, den Inhalt ersetzen und speichern. Danach
in TUCaN auf
**Prüfungen → Modulergebnisse** oder **Prüfungsergebnisse** gehen und auf das
**Ø** in einer Zeile klicken: Statt des Popups erscheint der Notenspiegel als
Dialog.

Die veröffentlichte Fassung baut der Workflow „Pages“ bei jedem Push auf `main`
mit demselben `build.ps1` und stellt sie unter
`https://mariojovc.github.io/tucan-notenspiegel/tucan-notenspiegel.user.js` bereit.
Tampermonkey prüft `tucan-notenspiegel.meta.js` und lädt eine neue Fassung, sobald
`@version` in `userscript/header.txt` steigt.

Der Build ist nötig, weil ein Userscript in sich geschlossen sein muss; die
`src/*.js` lassen sich nicht nachladen. Alles wird in eine IIFE gepackt, damit
die Funktionen nicht in den globalen Namensraum der Seite geraten. Vorne steht
`TSK_VENDOR` mit CSS und Schriften aus `vendor/tuda-ui`. TUCaN lädt dadurch
nichts von fremden Servern, und das Skript braucht keine Netzwerkrechte.

### Wie es arbeitet

Die eigene Note kommt **aus der geklickten Zeile**, nicht aus einer separaten
Abfrage. Das ist der Kern: Modul- und Prüfungsergebnisse führen unterschiedliche
Noten zum selben Modul, und der jeweilige Notenspiegel gehört zur jeweiligen
Note. Am Beispiel-Fixture, Grundlagen der Programmierung, gegen den
Beispiel-Notenspiegel:

| Aufruf aus | angezeigte Note | Einordnung |
|---|---|---|
| Modulergebnisse | 1,7 (Modulendnote) | oberes 19 % |
| Prüfungsergebnisse, Fachprüfung | 2,0 | oberes 31 % |
| Prüfungsergebnisse, Studienleistung | 1,0 | oberes 4 % |

Bei unbenoteten Leistungen (`b`) entfallen Ergebniskarte und Verbergen-Schalter;
Verteilung, Kennzahlen und Tabelle bleiben.

**Nichts wird unerreichbar.** Schlägt das Laden fehl, zeigt der Dialog die
Fehlermeldung (Alert des Systems) mit einem Knopf, der die Original-TUCaN-Ansicht
öffnet.

### Die Falle, die nur live zuschlägt

TUCaN hängt hinter jeden Ø-Link ein Inline-Skript, das den `href` durch
`javascript:open_overview0001();` **ersetzt**. Im Fixture fällt das nicht auf,
weil `DOMParser` keine Skripte ausführt — dort steht die echte URL noch im
Attribut. Auf der geladenen Seite ist sie weg, und ein Parser, der nur den
`href` liest, hätte grün getestet und live nichts gefunden. `urlFromRow()`
nimmt den `href` deshalb nur, wenn er keine `javascript:`-URL ist, und liest
sonst die Adresse aus dem `dl_popUp()`-Aufruf des Nachbarskripts. Getestet,
indem die Ersetzung im Fixture nachgestellt wird.

## Gestaltung: TUDa UI

Der Skin gestaltet nichts mehr selbst. Farben, Schrift, Radien, Komponenten und
Bewegung kommen aus **TUDa UI**, einem inoffiziellen Design System im Stil der TU
Darmstadt. Der Notenspiegel ist dort als Pattern beschrieben, mit Richtlinie und
Vorschau.

| Teil | Aus dem System |
|---|---|
| Blatt | `dialog.tuda-modal--lg.tuda-modal--page`: getöntes Glas mit blauem und violettem Schimmer, fast volle Höhe |
| Kopf | Semester als `.tuda-badge--primary` mit Kalender-Icon, `__title`, `__actions` mit Switch „Note verbergen“, Schließen |
| Ergebnis | `.tuda-result--success` / `--error`: Glaskarte in Statusfarbe, Note groß, Siegel mit gezeichnetem Häkchen |
| Verteilung | `.tuda-chart--distribution`: blaue Glasbalken, eigene Note massiv mit Schein und Achsen-Kapsel, 5,0 rot getönt, Ø-Markierung, Fläche |
| Anteile | `.tuda-ratio`: getönte Glaskapseln bestanden / nicht bestanden |
| Kennzahlen | `dl.tuda-facts--center` in der Notenspiegel-Karte: Durchschnitt · Ergebnisse · Nicht angetreten · Abweichendes BWS |
| Tabelle | `.tuda-table--transposed.tuda-table--dense` |
| Erscheinungsbild | `.tuda-segmented--slide` mit Hell / Dunkel / System |

Result, Distribution, Ratio, `--slide`, `--page`, `--transposed`,
`--center` und `--draw` sind für den Notenspiegel neu ins System gekommen.
Der Skin setzt selbst nur noch Anordnung (`TSK_SKIN_CSS`, rund 35 Zeilen):
Kopf- und Fußzeile, Abstände, Überblendung beim Theme-Wechsel.

**Farbe trägt Bedeutung:** Blau ist die Kohorte, massiv ist „du“, Grün und Rot
sind der Status, Glas und Schimmer geben Tiefe. Die erste Fassung auf TUDa UI
nahm die Regeln des Systems zu wörtlich: graue Balken, eine lose
Kennzahlenzeile über allem, flacher grauer Grund. Sie wirkte leblos und
generisch und wurde verworfen. Getöntes Glas ist die Handschrift von TUDa UI
0.4; der Notenspiegel nutzt sie jetzt für Blatt, Ergebnis, Balken und Anteile.

Gegenüber dem eigenen Design vor TUDa UI:

| vorher (eigenes Design) | jetzt (TUDa UI) |
|---|---|
| fünf Kennzahl-Kacheln unter dem Diagramm | vier Fakten, zentriert in der Notenspiegel-Karte, krank / ohne Grund als Notiz |
| Ergebnisbox mit grünem / rotem Farbstreifen | Glaskarte in Statusfarbe mit Siegel (Icon und Wort) |
| blaue Balken mit Verlauf | blau getöntes Glas, eigene Note massiv in `chart-emphasis` |
| dunkle Achsen-Pille für die eigene Note | Achsen-Kapsel in `chart-emphasis` |
| Sonne/Mond-Schalter | Segment-Control Hell / Dunkel / System mit gleitendem Daumen |
| Systemschrift | Archivo (Titel, Zahlen), JetBrains Mono (Kennung) |

**Anpassung ans Shadow DOM** (`src/tuda.js`):

- `:root` trifft im Shadow DOM nichts, die Tokens hängen deshalb am Host.
- Die Grundschrift setzt das System auf `body`. Sie wandert auf den Wrapper
  `.tsk-app`, der auch `data-theme` trägt. Auf dem Host würde
  `color: var(--text-primary)` mit den hellen Tokens aufgelöst und als fertige
  Farbe vererbt; der Dunkelmodus käme bei der Schrift nie an.
- `@font-face` wirkt nur im Dokument und wird dort einmal angemeldet.
- `bundle.js` des Systems wird nicht geladen. Es legt `window.TUDa` an, hängt
  Tooltips an `document.body` (außerhalb der Kapsel) und sucht Dialoge per
  `getElementById`. Gebraucht werden nur Icons und Theme-Logik, beides steht
  klein in `tuda.js`.

**Aktualisieren:** Ändert sich das System, die Dateien aus dem Design System nach
`vendor/tuda-ui/` kopieren (Tabelle in `vendor/tuda-ui/README.md`) und neu bauen.
Nie in `vendor/` selbst ändern.

## Bewegung

Nur beim Öffnen, nie beim Scrollen, alles nach den Bewegungsregeln des Systems
(höchstens 360 ms je Element, Häkchen 480 ms, nur `transform`, `opacity` und Farbe):

| ab | was |
|---|---|
| 0 ms | Dialog blendet ein und steigt leicht auf (System, `@starting-style`) |
| 160 ms | Balken wachsen von unten, je 30 ms versetzt (`ease-enter`) |
| +200 ms je Balken | Zahl blendet ein und zählt hoch (480 ms, nur ganze Zahlen) |
| 280 ms | Fläche hinter den Balken blendet ein |
| 300 ms | Siegel springt auf, Häkchen bzw. Kreuz zeichnet sich (480 ms) |
| 420 ms | Anteile wachsen von außen zur Mitte, Anzahlen zählen hoch |
| ≈ 650 ms | Ø-Markierung blendet ein |

Die Einblende-Klassen werden nach dem Durchlauf entfernt, und das Hochzählen
hat einen Zeitgeber als Rückfall. Beides aus demselben Grund: In einem
verdeckten Tab steht die Zeitleiste der Animationen still und es laufen keine
Frames. Ohne das blieb das Siegel unsichtbar und die Zahlen standen auf 0, bis
man wieder hinsah. Bei `prefers-reduced-motion` steht alles sofort, auch das
Hochzählen entfällt.

**Chrome-Falle:** Die Zeichen-Animation hing zuerst an `[pathLength]`. Chrome
wertet Attribut-Selektoren auf SVG-Attributen mit Großbuchstaben nach einem
Klassenwechsel nicht neu aus; das Häkchen blieb nach dem Ablauf unsichtbar
(`stroke-dashoffset: 1`). Der Selektor geht jetzt über das Element (`path`).

## Hell, Dunkel, System

Gespeichert wie bei `TUDa.theme` unter `tuda-theme` (im `localStorage` von
TUCaN). Der Wrapper trägt **immer** ein ausdrückliches `data-theme`, auch im
Modus „System“: aufgelöst wird an einer Stelle in `tskApplyTheme`, und ein
Wechsel des Betriebssystems wird live übernommen. Beim Umschalten blenden nur
die Farben über (`.tsk-theming`, `duration-slow`), der Daumen gleitet weiter mit
Federung. Bei reduzierter Bewegung entfällt die Überblendung; die Regel arbeitet
mit `!important` und würde die Vorgabe des Systems sonst überstimmen.

## Demo starten

Online läuft die Demo unter `https://mariojovc.github.io/tucan-notenspiegel/demo/`.
Lokal im Projektordner einen Server starten:

```bash
python -m http.server 8765
```

Danach `http://localhost:8765/demo/`. Die Demo lädt Parser, Renderer, Fixture
und das CSS aus `vendor/tuda-ui` per `fetch`; unter `file://` blockiert der
Browser das. URL-Parameter für reproduzierbare Ansichten: `?theme=light|dark`,
`?fixture=<datei>`, `?grade=1.7|none`, `?anon=1`, `?dialog=1`.

## Was der Notenspiegel liefert — und was nicht

Die Seite (`PRGNAME=GRADEOVERVIEW`, Template `students_grades_diagramm.htm`)
zeigt die **Notenverteilung der gesamten Kohorte**, nicht die eigene Note.
Die eigene Note kommt aus der geklickten Ergebniszeile und wird als
`renderNotenspiegel(data, { ownGrade })` übergeben.

## Verifikation gegen das Fixture

Fixture: `01-99-1B01 Einführung in die Wirtschaftsinformatik, WiSe 2025/26` (erfunden)

Zwei unabhängige Kreuzproben gegen die Werte, die die Seite selbst ausweist:

| Prüfung | Parser | TUCaN | |
|---|---|---|---|
| Summe der Verteilung | 335 | `Vorliegende Ergebnisse: 335` | ✓ |
| Mittelwert | 2,8824 | `Durchschnitt: 2,882` | ✓ |

Beides fällt sofort auf, wenn eine Spalte falsch zugeordnet wird — deshalb als
Selbsttest brauchbar.

## Struktur der Quellseite

```
h1                          "Notenspiegel"
h2                          "01-99-1B01  <Titel>, WiSe 2025/26"
table.nb
  tr > td.tbsubhead         "Noten" | 1,0 | 1,3 | … | 5,0
  tr > td.tbdata            "Anzahl" |  12 |  21 | … |   52
div.tbdata                  "Durchschnitt: 2,882"
div.tbdata                  "Vorliegende Ergebnisse: 335"
div.tbdata                  "Ergebnisse mit abweichendem BWS: 0"
div.tbdata                  "Fehlend (Krankschreibung): 9"
div.tbdata                  "Fehlend (ohne Grund): 31"
```

Der Parser geht bewusst **nicht** über CSS-Pfade, sondern sucht die Tabelle,
die eine Zeile mit mindestens drei Notenwerten enthält, und ordnet die
Anzahl-Zeile spaltenweise zu. Kennzahlen werden über Label-Präfixe gematcht.
Vorsicht: `tbdata` sitzt sowohl auf `td` als auch auf `div` — die Kennzahlen
werden deshalb explizit als `div.tbdata` selektiert.

Plattform laut einer gespeicherten TUCaN-Seite: Datenlotsen CampusNet **15.00.003**, Customer `tuda`.

## Fläche hinter den Balken

`svg.tuda-chart__curve`: eine graue Kontur über den Balken mit einem senkrecht
ausblendenden Verlauf darunter. **Sie ist Gestaltung, keine Datenreihe**: nicht
in einer Legende, `aria-hidden`, und die Quellenzeile sagt es in einem Satz.

- **Höhen exakt proportional zu den Werten.** Rein additive Verschiebung im
  Wertraum (`CURVE_LIFT`, 26 % der Skalenspitze), kein Klemmen und keine
  Glättung der Werte. Beides stauchte früher genau die Verhältnisse, die die
  Linie zeigen soll; die Glättung drehte am Fixture sogar ein Vorzeichen um.
- **Freier Streifen oben.** Die Balken nutzen nur die unteren 80 % der Plothöhe
  (Faktor 0,8 im System, `BARS_TOP` im Skin). Ohne die Reserve lief die Linie
  durch die Zahlen.
- **Exakte Mitten.** Der Plot läuft im System ohne Spaltenabstand, jeder Balken
  (höchstens 44 px) steht mittig in seiner Spalte. Die Balkenmitte liegt damit
  genau bei (i + 0,5) / n; Kurve und Ø-Markierung rechnen so. Mit den 8 px
  Abstand des normalen Diagramms lag der Fehler am Rand bei 3,6 px.
- **Endanker außerhalb des Rahmens** (x = −42 und 142), SVG mit
  `overflow: hidden`. Der Abfall zur Grundlinie passiert hinter dem Rand.
- Gradient-IDs bekommen ein Zufallssuffix; mehrere Blätter auf einer Seite
  würden sich sonst gegenseitig überschreiben.

## Kurvenform

Die Kurve nutzt **monotone kubische Interpolation** (Fritsch–Carlson), nicht
Catmull-Rom. Catmull-Rom überschwingt bei ungleichen Werteabständen und erfindet
dabei Extrema: am Extremfall-Fixture stieg die Kurve bei 1,3 an, obwohl dort
null Ergebnisse liegen, und fiel zwischen 3,7 und 4,0 ab, obwohl der Wert dort
steigt. Die Fritsch-Carlson-Tangenten schließen das per Konstruktion aus — wo
die Werte gleich sind, verläuft die Kurve flach; wo sie steigen, steigt sie.

## Durchschnitt im Diagramm

Gestrichelte Senkrechte mit einer Kapsel „Ø 2,88“ im Band über dem Plot
(`__mean`). Die Position ist **interpoliert**: Die Notenstufen sitzen in gleichen
Abständen, sind aber numerisch ungleich verteilt (1,7 → 2,0 → … → 5,0); 2,88
liegt deshalb linear zwischen 2,7 und 3,0.

**Eine Quelle für die Zahl.** Der selbst gerechnete und TUCaNs ausgewiesener Wert
können verschieden runden, etwa 2,7449 → „2,74“ gegen ausgewiesene 2,745 → „2,75“.
Kennzahl und Kapsel beziehen deshalb beide `meta.average ?? stats.mean`.

**Am Rand rückt die Kapsel nach innen** (`--shift`), die Linie bleibt am echten
Wert. Ein `ResizeObserver` beobachtet dafür Plot **und** Kapsel: Lädt die Schrift
nach dem ersten Layout, wird die Kapsel breiter, ohne dass sich der Plot ändert.
Gerundet wird nach innen; mit `Math.round` blieb ein Pixel Überstand.

## Anteilsbalken

`.tuda-ratio`: Bezeichnungen oben (dürfen bis zur Mitte reichen), Anzahlen links
und rechts, dazwischen auf **derselben Zeile** die Kapseln in den Farben der
Balken. Breiten aus den absoluten Zahlen, nicht aus gerundeten Prozentwerten.

Der Prozentwert steht **genau einmal**:

- im Segment, wenn der Anteil mindestens 12 % beträgt;
- sonst neben der Anzahl (`__value--pct`). Vorher stand er bei 5 % bestanden
  nirgends;
- wird das Segment real zu schmal (`ResizeObserver` misst Segment- und
  Textbreite, nicht die Fenstergröße), wandern alle Werte nach außen
  (`--compact`).

Leere Seiten entfallen; ein Mindestsegment für 0 sähe aus wie „ein paar“.

## Tabelle

Dauerhaft sichtbar, weil sie zugleich die Textfassung des Diagramms ist.
**Waagerecht wie in TUCaN** (`.tuda-table--transposed`): Notenstufen als Spalten,
Anzahl / Anteil % / Kumuliert % als Zeilen.

- Die Notenzeile ist bei jeder Prüfung gleich und deshalb mit `border-strong`
  vom klausurabhängigen Teil getrennt.
- Anzahl ist primär (`tr.is-primary`), die Prozentzeilen sind leise.
- Eigene Spalte `.is-current` (`surface-selected`), 5,0 `.is-error`.
- Das Prozentzeichen steht in der Zeilenbeschriftung, nicht elfmal in den Zellen.
- Mindestbreite 560 px im eigenen Scrollcontainer; Zeilenköpfe bleiben stehen.

## Schalter „Note verbergen“

Für Screenshots, die man teilen will. Er blendet die Ergebniskarte aus und nimmt
jede Hervorhebung des eigenen Werts zurück: Balken, Achse, Tabellenspalte und
„deine Note“ im `aria-label`. Verteilung, Kennzahlen und Tabelle bleiben.

Umgesetzt durch **Entfernen der Klassen** (`is-current`), nicht durch
Zurücksetzen von Stilen. Ein früherer Versuch setzte mit `inherit` zurück; das
nahm den Wert des Elternelements statt des Werts, den die Zelle ohne
Hervorhebung hätte, und die eigene Spalte blieb invertiert erkennbar. Eine
eigene 5,0 bleibt rot wie jede andere 5,0.

Geprüft wird strenger als früher: Jeder Balken, jede Achsenbeschriftung und
jede Tabellenzelle muss im Verbergen-Modus genauso aussehen wie in einem
Notenspiegel, der die eigene Note nie kannte. Gegenprobe gemacht: Eine einzige
übrig gelassene Markierung schlägt an.

## Live-Tests

`tests/live.html` prüft das **gebaute Userscript** auf den beiden Ergebnisseiten
im Live-Zustand. Die Fixtures laufen in einem iframe, sodass der Browser TUCaNs
Inline-Skripte wirklich ausführt; dann wird jeder Ø-Link geklickt. Geprüft:

- Klick abgefangen, kein Original-Popup
- Dialog offen, im Shadow DOM, mit Verteilungsdiagramm und ohne Fehlermeldung
- Schriften am Dokument angemeldet
- **die Note in der Ergebniskarte ist die der geklickten Zeile** (Modulnote auf
  den Modulergebnissen, Prüfungsnote auf den Prüfungsergebnissen; bei „b“ keine
  Ergebniskarte)

Nur über den lokalen Server öffnen (siehe „Demo starten“), dann
`http://localhost:8765/tests/live.html`. Unter `file://` sperrt der Browser den
Zugriff aufs iframe. Ohne Fenster laufen beide Testseiten mit

```bash
npm install --no-save playwright && npx playwright install chromium
node tests/ausfuehren.mjs
```

Der Lauf bricht ab, sobald ein Fall scheitert oder eine Anfrage den lokalen Server
verlässt. Die Live-Tests prüfen außerdem, dass das Skript je Klick genau einen
Abruf macht, und zwar nur den Notenspiegel von TUCaN.

**Warum es ihn gibt:** TUCaN schreibt die Ø-Links beim Laden um — den `href` auf
`javascript:open_popup0001();`, auf den Prüfungsergebnissen zusätzlich den
`title` auf „Link öffnet ein popup-Fenster für Notenspiegel“. In einem per
DOMParser geladenen Fixture laufen diese Skripte nicht. Das Skript suchte nach
`title="Notenspiegel"` und fand auf den Prüfungsergebnissen deshalb keinen
einzigen Link — in allen Fixture-Tests grün, in TUCaN wirkungslos. Gefunden wird
der Link jetzt über die Verdrahtung selbst: Das Skript mit dem
GRADEOVERVIEW-Aufruf nennt per `getElementById("…")` den Link, den es bedient.

## Renderer-Tests

`tests/index.html` im Browser öffnen (lokaler Server). Rendert 14 synthetische
Verteilungen im Shadow DOM, mit dem echten CSS des Systems und ohne Bewegung:

Normalfall · 8 Leerstufen · alles in einer Stufe · niemand durchgefallen · alle
durchgefallen · ein einziges Ergebnis · gleichverteilt · zweigipflig · monoton
steigend · monoton fallend · Sägezahn · gar keine Ergebnisse · eigene Note in
einer Leerstufe · ohne eigene Note

Geprüft wird pro Fall:

- keine NaN/undefined im Text
- Tokens greifen im Shadow DOM, hell und dunkel
- Balkenfarben aus dem System
- Balkenmitten exakt bei (i + 0,5) / n
- Kurve im Rahmen und über jeder Balkenkappe, ohne Berührung der Zahlen
- **Monotonie**: kein Extremum, das die Daten nicht hergeben, kein Überschwinger
- Ø-Kapsel im Plot und frei von der Kurve
- Zahlen im Satzspiegel der Karte
- Prozentwerte passen in ihr Segment
- Bezeichnungen des Anteilsbalkens berühren sich nicht
- keine Bewegung bei `animate: false`
- Verbergen-Modus wie oben, samt Zurückschalten

Gegenprobe zur Kurve: Mit dem alten Catmull-Rom-Spline schlagen 11 der 14 Fälle
fehl.

## Extremfall-Fixture

`fixtures/notenspiegel-extremfall.html` ist **synthetisch**, kein echter Export.
Es bildet eine Klausur ab, bei der acht Notenstufen leer bleiben, zwei sehr
kleine Werte (10, 12) neben einem sehr großen (456) stehen und 95 % durchfallen.
Aufgebaut in derselben Struktur wie der echte Export, damit der Parser
mitgetestet wird und nicht nur der Renderer. Im Demo über das Fixture-Menü
umschaltbar.

Daran aufgefallen und behoben:

- **Null war nicht von wenig zu unterscheiden.** Leere Stufen (`.is-empty`)
  haben keine Mindesthöhe; null bleibt null.
- **Skalenspitze** rundet mit `target 5` statt `4`. Bei einem Maximum von 456
  ergab 4 eine Spitze von 600 und verschenkte ein Viertel der Höhe.
- **Ø am Rand** (4,95 bei 95 % der Breite) rückt nach innen, siehe oben.

## Layout-Fallen

- **Tabelle mit null Höhe im Dialog.** Der Dialogkörper ist ein Raster und
  scrollt; die Tabelle ist selbst ein (waagerechter) Scrollcontainer, und deren
  Mindesthöhe ist im Raster 0. In Fenstern unter etwa 900 px Höhe schrumpfte die
  Tabelle deshalb auf 0 px, statt den Körper scrollen zu lassen. Behoben mit
  `grid-auto-rows: max-content` in `.tuda-modal--page`.
- **Blatt breiter als der Bildschirm.** Dieselbe Rasterspalte war `auto` breit
  und wuchs auf die Mindestbreite der Tabelle (560 px). In schmalen Fenstern
  ragte das ganze Blatt über den Rand. Behoben mit
  `grid-template-columns: minmax(0, 1fr)`; jetzt scrollt nur die Tabelle.
- **`[hidden]` gegen `display: flex`.** Karten des Systems setzen `display: flex`
  und schlagen damit die Browser-Regel für `hidden`. Der Skin setzt deshalb
  `.tsk-ns [hidden] { display: none !important }`.
- **Querverweise zwischen Quelldateien nur über Funktionsdeklarationen.** Demo
  und Tests laden die Quellen einzeln per `eval`; ein `const` bliebe dabei in
  seiner Datei eingeschlossen.
- **Backticks in CSS-Kommentaren** beenden das Template-Literal in `render.js`.
  Zweimal passiert; im CSS keine Backticks verwenden.

## Leistungsspiegel

`parseLeistungsspiegel(doc)` liefert Module, Zwischensummen, Bereichsvorgaben
und die GPA. Damit schließt sich der Kreis: `gradeForModule(ls, ns.exam.code)`
holt die eigene Note zur Modulnummer aus dem Notenspiegel; das Widget rendert
daraufhin ohne manuellen Parameter. Geprüft an einem echten Leistungsspiegel, der
wegen der persönlichen Daten nicht im Repo liegt.

Struktur der Seite:

```
table.students_results
  tr.subhead.levelNN            Bereichsüberschrift, Tiefe über die Ziffer
  tr > td.tbdata ×7             Nr | Titel | Datum | Credits | Angerechnet | Note | Status
  tr > td.levelNN[colspan=2]    "Summe …"
  tr > td.levelNN[colspan=7]    Bereichsvorgabe
table.students_results (zweite)  Gesamt-GPA / Hauptfach-GPA
```

Vier Fallen, alle im Code kommentiert:

- **Der Status ist ein Bild, kein Text** (`img alt="Bestanden"` / `"Offen"`).
  Über `textContent` bliebe die Spalte immer leer.
- **Die Titelzelle enthält ein inline eingebettetes `<script>`**, das die
  Popup-URL umschreibt. `textContent` zog dessen Quelltext mit; Titel endeten
  auf Fragmente wie „… `<!-- var PopupLink=d`". Gelesen wird jetzt der
  Ankertext, sonst die Zelle ohne script/style.
- **Summenzeilen haben eine Zelle mit `colspan=2`**, Datenzeilen nicht. Mit
  festen Zellindizes las man Summen um eine Spalte verschoben — die Credits
  landeten in „Angerechnet". Zellen werden deshalb auf Spaltenpositionen
  aufgeweitet.
- **Bereichsvorgaben stehen nach den Unterbereichen.** Der Pfad zeigt dort noch
  auf den zuletzt gesehenen Unterbereich; er wird auf die Ebene der Zeile
  zugeschnitten, sonst hängt „41,0 Credits" am Bachelorseminar statt an
  Wirtschaftsinformatik.

### Warum der Schnitt nicht exakt der GPA entspricht

Ein CP-gewichtetes Mittel über alle benoteten Module weicht in der zweiten
Nachkommastelle von der GPA ab, die TUCaN ausweist. Die Ursache steht in den
Bereichsvorgaben selbst: mehrere Bereiche tragen Formulierungen wie

> Es sind mindestens 3,0 Credits einzubringen. Die Ergebnisse von maximal
> 6,0 Credits gehen in die Notenberechnung ein.

Die Prüfungsordnung rechnet also nicht alle bestandenen Credits in die Note.
`parseRequirement()` liest diese Kappungen als `maxGradedCredits` mit, aber
`summarize()` wendet sie **nicht** an — die Auswahl, welche Module bei einer
Kappung zählen, hängt von Regeln ab, die auf der Seite nicht stehen.
Verbindlich ist die GPA aus TUCaN, nicht der selbst gerechnete Wert.

## Modul- und Prüfungsergebnisse

`parseErgebnisse(doc)` erkennt beide Seiten an der Überschrift und liefert
Semester, Zeilen und die Semester-GPA. **Jede Zeile trägt den Link zum
Notenspiegel** (`PRGNAME=GRADEOVERVIEW`, `title="Notenspiegel"`) — das ist der
Einhängepunkt für ein Userscript: Die Zeile kennt die eigene Note, der Link
führt zur Verteilung. In den Beispiel-Fixtures: 4 von 4 bzw. 5 von 5 Zeilen mit Link.

Der Name der studierenden Person steht in der Überschrift, wird aber bewusst
nicht ausgelesen — für die Auswertung wird er nicht gebraucht.

### Die beiden Seiten meinen nicht dasselbe

| | Modulergebnisse | Prüfungsergebnisse |
|---|---|---|
| Kontext im Link | `-AMOFF` (Modul) | `-AEXEV` (Prüfungsereignis) |
| Note in der Zeile | Endnote des Moduls | Note der einzelnen Prüfung |
| Grundlagen der Programmierung (Beispiel) | **1,7** | Studienleistung **1,0**, Fachprüfung **2,0** |

**Das ist für die Korrektheit entscheidend:** Welche Note als „deine Note" ins
Widget gehört, hängt davon ab, von welcher Seite der Notenspiegel geöffnet
wurde. Ein Notenspiegel aus den Prüfungsergebnissen zeigt die Verteilung einer
Prüfung — dazu gehört die Prüfungsnote (2,0), nicht die Modulnote (1,7).

Die Überschrift eines Notenspiegels nennt keine Prüfungsart. Zu welcher Note er
gehört, weiß deshalb nur die Zeile, aus der er geöffnet wurde.

### Drei Fallen

- **`Semester-GPA` steht nicht in der letzten Zelle.** Die Zeile endet mit einer
  leeren Füllzelle; die letzte Zelle zu nehmen ergab `null`. Genommen wird die
  erste Zelle nach der Beschriftung, die eine Zahl enthält.
- **Nicht jede Note ist eine Zahl.** Unbenotete Leistungen tragen `b`. Der Wert
  bleibt als `gradeLabel` erhalten, `grade` ist dann `null`.
- **Die Prüfungsergebnisse haben keine Status-Spalte.** Die unbeschriftete
  Zelle nach der Note enthält die **Note in Worten** („sehr gut", „gut"); bei
  unbenoteten Leistungen steht dort „bestanden", was wie ein Status aussieht.
  Sie landet deshalb in `gradeText`, nicht in `status` — sonst hätte das Feld
  je nach Seite eine andere Bedeutung.

## Prüfende Person

`renderNotenspiegel(data, { examiner })` zeigt den Namen im Kopf hinter der
Modulnummer.

**Der Notenspiegel selbst nennt die Prüfenden nicht** — die Seite enthält nur
Modulnummer, Titel, Semester und die Verteilung. Der Wert muss also von außen
kommen, etwa aus der Modulbeschreibung oder den Prüfungsergebnissen. Fehlt er,
entfällt die Angabe ersatzlos statt eine leere Beschriftung zu hinterlassen.

## Offen

1. **Version 0.4 in TUCaN prüfen.** 0.3.1 lief dort auf beiden Ergebnisseiten.
   Neu sind der Dialog, die eingebetteten Schriften und Hell/Dunkel; geprüft
   bisher gegen die Fixtures (Renderer- und Live-Tests). Offen bleibt auch die
   Zeichenkodierung anderer Notenspiegel: Der Code wertet den `charset` aus dem
   `Content-Type` aus.
2. **Höhe auf Laptops.** Das Blatt ist rund 950 px hoch; bei 760 px Fensterhöhe
   scrollt der Körper um gut 200 px. Kürzer ginge es, wenn die Ergebniskarte
   als erster Fakt in die Kennzahlenzeile wandert.
3. **Prüfername beschaffen** — siehe oben, Quelle wäre die Modulbeschreibung.
4. Fixture mit weiteren Sonderfällen: angerechnete Leistung, nicht bestandene
   Prüfung mit Wiederholung.

Erledigt: **Tastaturbedienung.** Die Balken sind fokussierbar (`tabindex`,
`role="img"`, `aria-label`) und zeigen beim Fokus denselben Tooltip wie beim
Überfahren.