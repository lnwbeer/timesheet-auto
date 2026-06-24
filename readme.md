# Timesheet Auto-Fill

กรอก Timesheet บน IT Services Extended อัตโนมัติ — ดึง meeting จาก Outlook แล้วกรอกให้ผ่าน Claude Code

## ทำอะไรได้

- ดึง meeting ทั้งเดือนจาก Outlook calendar
- Map meeting เข้า activity อัตโนมัติ (AI Agent Update → PRJ26017, English Training → OVH0002, อื่นๆ → OVH0003)
- ถาม user ว่าชั่วโมงที่เหลือใส่งานอะไร (แต่ละคนต่างกัน)
- เปิด Chrome → Login → กรอก → Save ให้หมด

## ติดตั้ง (คำสั่งเดียว)

เปิด PowerShell ใน folder โปรเจกต์ที่ใช้ Claude Code แล้วรัน:

```powershell
irm https://raw.githubusercontent.com/lnwbeer/timesheet-auto/main/install.ps1 | iex
```

Script จะ:
- สร้าง folder `.claude/skills/fill-timesheet/` และ `scripts/`
- Download `SKILL.md` และ `fill-timesheet.cjs` ไปวางให้
- ติดตั้ง `@playwright/mcp` (ถ้ายังไม่มี)

## ใช้งาน

1. เปิด Claude Code
2. `/mcp` → connect **Microsoft 365** (ครั้งแรกของ session)
3. พิมพ์ `/fill-timesheet`

Claude จะถาม:
1. เดือนที่ต้องการกรอก
2. Username (IT Services Extended)
3. Password (ไม่เก็บลงไฟล์)

จากนั้น:
- ดึง meeting จาก Outlook
- แสดง summary → ถามว่าชั่วโมงเหลือใส่ activity อะไร
- ยืนยันแล้วกรอกให้อัตโนมัติ

## หมายเหตุ

- **ต้องปิด Chrome ก่อนรัน** — script จะเปิด Chrome ใหม่ให้เอง
- Password ใช้ครั้งเดียวใน memory แล้วทิ้ง ไม่เก็บลงไฟล์
- รองรับ Windows + Chrome เท่านั้น
