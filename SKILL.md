# fill-timesheet skill

กรอก Timesheet บน https://itservicex.chememan.com/Timesheet อัตโนมัติ — ดึง meeting จาก Outlook calendar แล้วกรอกให้

## When to use

User พิมพ์ `/fill-timesheet` หรือ ขอกรอก timesheet

## Prerequisites

- **Claude Code** กับ Microsoft 365 MCP (`/mcp` → claude.ai Microsoft 365)
- **Chrome** ติดตั้งอยู่ (path: `C:\Program Files\Google\Chrome\Application\chrome.exe`)
- **@playwright/mcp** ติดตั้ง global: `npm i -g @playwright/mcp`
- Chrome ต้องปิดก่อนรัน (script จะเปิดให้เอง)

## Process

### Step 1: Ask user for basic inputs

ถาม user:
1. **เดือนที่ต้องการกรอก** — ถ้าไม่ระบุ ใช้เดือนปัจจุบัน (format: `YYYY-MM`)
2. **Username** สำหรับ IT Services Extended (ไม่ต้องใส่ @chememan.com)
3. **Password** สำหรับ IT Services Extended — **ไม่เก็บลงไฟล์** ใช้ครั้งเดียวแล้วทิ้ง

**หมายเหตุ**: Password อยู่ใน env var ของ process เท่านั้น ไม่ถูกบันทึกลงไฟล์หรือ log

### Step 2: Pull meetings from Outlook

ใช้ `mcp__claude_ai_Microsoft_365__outlook_calendar_search` ดึง meeting ทั้งเดือน:

```
query: *
afterDateTime: {first day of month}
beforeDateTime: {last day of month}
limit: 25, offset: 0, order: oldest
```

ดึงจนครบทุก page (ดู `nextOffset` ใน response)

### Step 3: Process meetings

**Filter:**
- ตัด cancelled events (`isCancelled: true`)
- ตัด Morning Talk (ไม่นับ)
- เวลาเป็น UTC → แปลงเป็น Bangkok (+7)
- เสาร์-อาทิตย์ = ไม่กรอก
- **วันหยุด (ช่องทึบบนหน้า Timesheet)** = ไม่กรอก — script ตรวจจากหน้าเว็บว่าวันไหนเป็นช่องทึบ (disabled/holiday cell) แล้วข้ามวันนั้น

**Default activity mapping:**

| Meeting pattern | Timesheet activity |
|---|---|
| Subject มีคำว่า "AI" (case-insensitive) | **PRJ26017** |
| "English Training" | **OVH0002** Training/Coaching/Self-Learning |
| Morning Talk | **ไม่กรอก** |

**ทุก meeting อื่นที่ไม่ตรง pattern ข้างบน → ถาม user ว่าใส่ activity ไหน** พร้อมแสดง option ให้เลือก เช่น OVH0003, OVH0002, PRJ26017 หรือพิมพ์เอง

### Step 4: Show meeting summary & ask for remaining hours

แสดง summary ของ meeting ที่จะกรอก:
- ตาราง meeting ต่อวัน + activity ที่จะกรอก
- รวมชั่วโมง meeting ต่อ activity

**จากนั้นถาม user:**
> "ชั่วโมงที่เหลือในแต่ละวันทำงาน (8h - meeting) ใส่ activity อะไรครับ?"
>
> เช่น STH0001 Support CMAN TH, SAU0001 Support CMAN AU, PRJ26xxx project ฯลฯ
> สามารถแบ่งหลาย activity ได้ถ้าต้องการ

**ห้ามสมมติว่าเป็น STH0001 เพราะแต่ละคนทำงานต่างกัน**

รอ user ตอบ แล้วคำนวณ:
- Working days (Mon-Fri ที่ไม่ใช่วันหยุด): meeting hours + remaining hours = 8h ต่อวัน
- Weekends = 0
- วันหยุด (ช่องทึบ) = 0 — ถึงจะเป็นวัน Mon-Fri ก็ไม่กรอก

### Step 5: Confirm before filling

แสดง summary สุดท้ายให้ user ยืนยัน:
- ชั่วโมงต่อ activity ทั้งเดือน
- Grand total ต้อง = working days × 8h
- รอ user confirm ก่อนดำเนินการ

### Step 5.5: Detect holidays from Timesheet page

หลัง launch Chrome แล้ว ก่อนกรอก ให้ detect วันหยุด (ช่องทึบ) จากหน้า Timesheet:
- script จะ detect อัตโนมัติ (disabled/readonly inputs หรือ cell มี background สีเข้ม)
- วันหยุดที่ตรงกับ Mon-Fri ต้องไม่กรอก (ใส่ 0)
- ปรับ working days ให้หักวันหยุดออกก่อนคำนวณ remaining hours

**หมายเหตุ**: ถ้ารู้วันหยุดล่วงหน้า (เช่น user บอก) ให้หักออกตั้งแต่ Step 4

### Step 6: Fill timesheet via HTTP (fast, ~1s)

**ใช้ `scripts/fill-timesheet-fast.cjs`** — Direct HTTP POST ไม่ต้องเปิด browser:

```powershell
$env:TIMESHEET_DATA = '{"STH0001":[0,8,...],"OVH0003":[0,0,1.5,...]}'
$env:TIMESHEET_USER = "username"
$env:TIMESHEET_PASS = "password"
node scripts/fill-timesheet-fast.cjs
```

Script จะ:
1. HTTP login → ได้ session cookie
2. GET /Timesheet → parse HTML form fields + detect holidays (disabled inputs)
3. แก้ค่า input fields ตาม TIMESHEET_DATA
4. POST /Timesheet → save ทีเดียว
5. GET /Timesheet อีกรอบ → verify ค่าที่กรอก

**ข้อจำกัด**: ถ้า activity ยังไม่มีบน page ต้องเพิ่มก่อน (ใช้ browser version `fill-timesheet.cjs` ครั้งแรก)

### Step 7 (Fallback): Browser version via CDP

ใช้ `scripts/fill-timesheet.cjs` เมื่อ:
- ต้องเพิ่ม activity ใหม่ที่ยังไม่มีบน page
- HTTP version มีปัญหา

ต้องปิด Chrome ก่อน แล้วเปิดด้วย CDP:
```powershell
Get-Process -Name "chrome" -ErrorAction SilentlyContinue | Stop-Process -Force -Confirm:$false
Start-Sleep -Seconds 3
$junctionDir = "$env:TEMP\chrome-junction-profile"
cmd /c "if exist `"$junctionDir`" rmdir `"$junctionDir`""
cmd /c "mklink /J `"$junctionDir`" `"$env:LOCALAPPDATA\Google\Chrome\User Data`""
Start-Process "C:\Program Files\Google\Chrome\Application\chrome.exe" -ArgumentList "--remote-debugging-port=9222 --user-data-dir=`"$junctionDir`" --profile-directory=Default https://itservicex.chememan.com/Timesheet"
Start-Sleep -Seconds 8
```

### Step 8: Verify

Script verify อัตโนมัติ — อ่านค่าจาก page หลัง save แล้วแสดง spot check

## Important notes

- **input indexing**: input[0] ของแต่ละ row = activity code, input[1] = day 1, input[30] = day 30
- **Month selector**: ตรวจสอบว่าเดือนที่เลือกตรงกับเดือนที่ต้องการ
- **Save button**: ใช้ text match "save" (lowercase)
- **Junction trick**: Chrome ไม่ยอม CDP กับ default user-data-dir ต้อง mklink /J ไป path อื่น
- **ห้าม hardcode activity สำหรับชั่วโมงเหลือ** — ต้องถาม user ทุกครั้ง
