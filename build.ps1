# Baut das Userscript aus den Quellen zusammen.
#
# Ein Userscript muss in sich geschlossen sein — es kann die src/*.js nicht
# nachladen. Deshalb werden sie hier aneinandergehängt und in eine IIFE
# gepackt, damit die Funktionen nicht in den globalen Namensraum der Seite
# geraten und dort mit TUCaNs eigenem Code kollidieren.
#
# Davor kommt TSK_VENDOR: CSS und Schriften des Design Systems aus
# vendor/tuda-ui, unverändert. Das CSS als JSON-String, die Schriften als
# data:-URL — TUCaN lädt nichts von fremden Servern, und das Skript braucht
# keine Berechtigung für Netzwerkzugriffe.
#
# Aufruf:  powershell -ExecutionPolicy Bypass -File build.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

$parts = @(
    'src\notenspiegel.js'
    'src\ergebnisse.js'
    'src\tuda.js'
    'src\render.js'
    'userscript\glue.js'
)

# -Encoding UTF8 ist Pflicht: Windows PowerShell 5.1 liest sonst in der
# ANSI-Codepage. Die UTF-8-Quellen kamen dadurch schon falsch herein und
# wurden anschließend nochmals als UTF-8 geschrieben — im fertigen Skript
# stand "fÃ¼r" statt "für".
function Read-Utf8 ($path) { Get-Content $path -Raw -Encoding UTF8 }

function Font-DataUrl ($name) {
    $path = Join-Path $root "vendor\tuda-ui\fonts\$name"
    if (-not (Test-Path $path)) { throw "Fehlt: vendor/tuda-ui/fonts/$name" }
    'data:font/woff2;base64,' + [Convert]::ToBase64String([IO.File]::ReadAllBytes($path))
}

# Tokens zuerst, dann die Komponenten — dieselbe Reihenfolge wie im System.
$css = (Read-Utf8 (Join-Path $root 'vendor\tuda-ui\tuda-tokens.css')) + "`n" +
       (Read-Utf8 (Join-Path $root 'vendor\tuda-ui\bundle.css'))
# ConvertTo-Json schreibt einen gültigen JS-String-Literal (inkl. Escapes).
$cssJson = ConvertTo-Json -InputObject $css -Compress
$archivo = Font-DataUrl 'Archivo-Variable-Latin.woff2'
$mono = Font-DataUrl 'JetBrainsMono-Variable-Latin.woff2'

$sb = [System.Text.StringBuilder]::new()
[void]$sb.AppendLine((Read-Utf8 (Join-Path $root 'userscript\header.txt')))
[void]$sb.AppendLine('(function () {')
[void]$sb.AppendLine("'use strict';")
[void]$sb.AppendLine('// ===== vendor/tuda-ui (TUDa UI: Tokens, Komponenten, Schriften) =====')
[void]$sb.AppendLine('const TSK_VENDOR = {')
[void]$sb.AppendLine("  css: $cssJson,")
[void]$sb.AppendLine("  fonts: { archivo: '$archivo', mono: '$mono' },")
[void]$sb.AppendLine('};')

foreach ($part in $parts) {
    $path = Join-Path $root $part
    if (-not (Test-Path $path)) { throw "Fehlt: $part" }
    [void]$sb.AppendLine("// ===== $part =====")
    # Die module.exports-Blöcke am Dateiende sind für Node gedacht und im
    # Browser wirkungslos; sie bleiben stehen, stören aber nicht.
    [void]$sb.AppendLine((Read-Utf8 $path))
}

[void]$sb.AppendLine('})();')

$outDir = Join-Path $root 'dist'
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }
$outFile = Join-Path $outDir 'tucan-skin.user.js'

# UTF-8 ohne BOM: Tampermonkey verschluckt sich sonst am Metadatenblock.
[System.IO.File]::WriteAllText($outFile, $sb.ToString(), [System.Text.UTF8Encoding]::new($false))

$size = [math]::Round((Get-Item $outFile).Length / 1KB, 1)
Write-Output "Gebaut: dist/tucan-skin.user.js ($size KB, $($parts.Count) Quelldateien + TUDa UI)"
