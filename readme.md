# Timesheet Auto-Fill

กรอก Timesheet บน IT Services Extended อัตโนมัติ ผ่าน Claude Code

## Install

```powershell
irm https://raw.githubusercontent.com/lnwbeer/timesheet-auto/main/install.ps1 | iex
```

## Prerequisites

1. **Claude Code** (Desktop, CLI, or Web)
2. **Microsoft 365 MCP** — connect ใน Claude Code: `/mcp` → claude.ai Microsoft 365
3. **Node.js** installed

## Usage

พิมพ์ใน Claude Code:

```
/fill-timesheet
```

Claude จะ:
1. ถามเดือน, username, password
2. ดึง meeting จาก Outlook calendar
3. จัด activity ตาม pattern (AI → PRJ26017, English → OVH0002, อื่นๆ → ถาม user)
4. ถามว่าชั่วโมงเหลือลง activity ไหน
5. แสดง summary ให้ยืนยัน
6. กรอกผ่าน HTTP POST (~1 วินาที)
7. Verify ค่าที่กรอก

## How it works

- **HTTP POST ตรง** — ไม่ต้องเปิด browser, ไม่ต้องปิด Chrome
- Login → GET form → modify values → POST save → verify
- ตรวจวันหยุด (disabled cells) อัตโนมัติ
- ~1 วินาที ต่อรอบ
