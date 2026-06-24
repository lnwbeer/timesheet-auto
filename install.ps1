# install.ps1 — One-command installer for fill-timesheet Claude Code skill
# Usage: irm https://raw.githubusercontent.com/lnwbeer/timesheet-auto/main/install.ps1 | iex

$ErrorActionPreference = 'Stop'
$repo = 'https://raw.githubusercontent.com/lnwbeer/timesheet-auto/main'

Write-Host "`n=== Install Fill-Timesheet ===" -ForegroundColor Cyan
Write-Host "Timesheet auto-fill for itservicex.chememan.com`n"

$root = $PWD.Path

# 1. Skill
$skillDir = "$root\.claude\skills\fill-timesheet"
New-Item -ItemType Directory -Path $skillDir -Force | Out-Null
Invoke-RestMethod "$repo/SKILL.md" | Out-File "$skillDir\SKILL.md" -Encoding utf8
Write-Host "[1/2] SKILL.md" -ForegroundColor Green

# 2. Script
$scriptsDir = "$root\scripts"
New-Item -ItemType Directory -Path $scriptsDir -Force | Out-Null
Invoke-RestMethod "$repo/fill-timesheet-fast.cjs" | Out-File "$scriptsDir\fill-timesheet-fast.cjs" -Encoding utf8
Write-Host "[2/2] fill-timesheet-fast.cjs" -ForegroundColor Green

# 3. CLAUDE.md
$claudePath = "$root\CLAUDE.md"
if (Test-Path $claudePath) {
    $content = Get-Content $claudePath -Raw -Encoding utf8
    if ($content -notmatch 'fill-timesheet') {
        Add-Content $claudePath "`n## Skills`n`n| Trigger | Purpose |`n|---------|---------|`n| ``/fill-timesheet`` | Timesheet auto-fill |`n" -Encoding utf8
        Write-Host "    Added to CLAUDE.md" -ForegroundColor Yellow
    }
} else {
    "# CLAUDE.md`n`n## Skills`n`n| Trigger | Purpose |`n|---------|---------|`n| ``/fill-timesheet`` | Timesheet auto-fill |`n" | Out-File $claudePath -Encoding utf8
    Write-Host "    Created CLAUDE.md" -ForegroundColor Yellow
}

Write-Host "`n=== Done! ===" -ForegroundColor Cyan
Write-Host "Prerequisites: Claude Code + Microsoft 365 MCP + Node.js"
Write-Host "Usage: type /fill-timesheet in Claude Code`n" -ForegroundColor Green
