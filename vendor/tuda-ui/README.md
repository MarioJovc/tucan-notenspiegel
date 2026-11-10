# TUDa UI (eingebettet)

Unveränderte Kopie aus dem Design System **TUDa UI 0.4**
(https://claude.ai/artifact/WfMdroPckFDuSEaLCcWMhn). Der Skin bringt keine
eigenen Farben, Schriften oder Komponenten mit, sondern nimmt sie von hier.

| Datei | Herkunft im Design System |
|---|---|
| `tuda-tokens.css` | `project/assets/Tokens/tuda-tokens.css` |
| `bundle.css` | `project/components/bundle.css` (mit Verteilung, Anteilsbalken, gleitendem Segment) |
| `fonts/Archivo-Variable-Latin.woff2` | `project/fonts/` |
| `fonts/JetBrainsMono-Variable-Latin.woff2` | `project/fonts/` |

**Nicht von Hand ändern.** Änderungen gehören ins Design System und werden von
dort hierher kopiert. `build.ps1` bettet CSS und Schriften ins Userscript ein;
`src/tuda.js` passt das CSS zur Laufzeit an das Shadow DOM an (`:root` wird
`:host`, `body` wird `.tsk-app`, `@font-face` hängt am Dokument).

Nur die Latin-Teilmengen der Schriften: Deutsch kommt mit U+0000–00FF und den
Satzzeichen aus U+2000–206F aus.

## Schriftlizenzen

- **Archivo** – © The Archivo Project Authors (Omnibus-Type), SIL Open Font License 1.1
- **JetBrains Mono** – © The JetBrains Mono Project Authors, SIL Open Font License 1.1

Die OFL erlaubt das Einbetten und Weitergeben zusammen mit Software. Der
Lizenzhinweis steht deshalb auch im Kopf des gebauten Userscripts.
