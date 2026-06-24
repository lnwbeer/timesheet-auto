# Timesheet Auto-Fill — Installer
# Usage: ใน project folder ที่ใช้ Claude Code รัน:
#   irm https://raw.githubusercontent.com/lnwbeer/timesheet-auto/main/install.ps1 | iex

$ErrorActionPreference = "Stop"
$base = "https://raw.githubusercontent.com/lnwbeer/timesheet-auto/main"

Write-Host "`n=== Timesheet Auto-Fill Installer ===" -ForegroundColor Cyan

# 1. Create folders
$skillDir = ".claude\skills\fill-timesheet"
$scriptDir = "scripts"
if (-not (Test-Path $skillDir)) { New-Item -ItemType Directory -Path $skillDir -Force | Out-Null }
if (-not (Test-Path $scriptDir)) { New-Item -ItemType Directory -Path $scriptDir -Force | Out-Null }

# 2. Download files
Write-Host "Downloading SKILL.md..." -ForegroundColor Yellow
Invoke-WebRequest -Uri "$base/SKILL.md" -OutFile "$skillDir\SKILL.md" -UseBasicParsing
Write-Host "Downloading fill-timesheet.cjs..." -ForegroundColor Yellow
Invoke-WebRequest -Uri "$base/fill-timesheet.cjs" -OutFile "$scriptDir\fill-timesheet.cjs" -UseBasicParsing

# 3. Install @playwright/mcp if not installed
$hasPW = npm list -g @playwright/mcp 2>$null | Select-String "playwright/mcp"
if (-not $hasPW) {
    Write-Host "Installing @playwright/mcp..." -ForegroundColor Yellow
    npm i -g @playwright/mcp
} else {
    Write-Host "@playwright/mcp already installed" -ForegroundColor Green
}

# 4. Done
Write-Host "`n=== Done! ===" -ForegroundColor Green
Write-Host "Files installed:"
Write-Host "  $skillDir\SKILL.md"
Write-Host "  $scriptDir\fill-timesheet.cjs"
Write-Host "`nUsage:"
Write-Host "  1. Open Claude Code"
Write-Host "  2. /mcp -> connect Microsoft 365"
Write-Host "  3. /fill-timesheet" -ForegroundColor Cyan
Write-Host ""
