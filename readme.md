# Timesheet Auto-Fill

กรอก Timesheet บน IT Services Extended อัตโนมัติ — ดึง meeting จาก Outlook แล้วกรอกให้ผ่าน Claude Code

## ทำอะไรได้

- ดึง meeting ทั้งเดือนจาก Outlook calendar
- Map meeting เข้า activity อัตโนมัติ (AI Agent Update → PRJ26017, English Training → OVH0002, อื่นๆ → OVH0003)
- ถาม user ว่าชั่วโมงที่เหลือใส่งานอะไร (แต่ละคนต่างกัน)
- เปิด Chrome → Login → กรอก → Save ให้หมด

## ติดตั้ง (ครั้งเดียว)

### 1. ติดตั้ง @playwright/mcp

```bash
npm i -g @playwright/mcp
```

### 2. วางไฟล์ในโปรเจกต์

Copy 2 ไฟล์จาก repo นี้ไปวางในโปรเจกต์ที่ใช้ Claude Code:

```
SKILL.md             →  .claude/skills/fill-timesheet/SKILL.md
fill-timesheet.cjs   →  scripts/fill-timesheet.cjs
```

### 3. Connect Microsoft 365

เปิด Claude Code แล้วพิมพ์ `/mcp` → เลือก **claude.ai Microsoft 365** → Login

(ต้องทำทุกครั้งที่เปิด session ใหม่)

## ใช้งาน

พิมพ์ใน Claude Code:

```
/fill-timesheet
```

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
- รองรับ Windows + Chrome เท่านั้น (ใช้ junction trick สำหรับ CDP)
