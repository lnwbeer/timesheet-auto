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

**Default activity mapping:**

| Meeting pattern | Timesheet activity |
|---|---|
| "AI Agent Update" (weekly, by janjirac) | **PRJ26017** |
| "English Training" | **OVH0002** Training/Coaching/Self-Learning |
| ทุก meeting อื่น | **OVH0003** General Meeting |
| Morning Talk | **ไม่กรอก** |

**ถ้าเจอ meeting ใหม่ที่ไม่ชัดเจน → ถาม user ว่าใส่ activity ไหน**

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
- Working days (Mon-Fri): meeting hours + remaining hours = 8h ต่อวัน
- Weekends = 0

### Step 5: Confirm before filling

แสดง summary สุดท้ายให้ user ยืนยัน:
- ชั่วโมงต่อ activity ทั้งเดือน
- Grand total ต้อง = working days × 8h
- รอ user confirm ก่อนดำเนินการ

### Step 6: Launch Chrome with CDP

**ต้องปิด Chrome ก่อน** แล้วรัน:

```powershell
# Kill Chrome
Get-Process -Name "chrome" -ErrorAction SilentlyContinue | Stop-Process -Force -Confirm:$false
Start-Sleep -Seconds 3

# Create junction to real Chrome profile (bypass CDP restriction)
$junctionDir = "$env:TEMP\chrome-junction-profile"
cmd /c "if exist `"$junctionDir`" rmdir `"$junctionDir`""
cmd /c "mklink /J `"$junctionDir`" `"$env:LOCALAPPDATA\Google\Chrome\User Data`""

# Launch Chrome with CDP
Start-Process "C:\Program Files\Google\Chrome\Application\chrome.exe" -ArgumentList "--remote-debugging-port=9222 --user-data-dir=`"$junctionDir`" --profile-directory=Default https://itservicex.chememan.com/Timesheet"
Start-Sleep -Seconds 8
```

Verify CDP: `http://localhost:9222/json/version` (ใช้ `System.Net.WebClient`)

### Step 7: Fill timesheet via CDP script

รัน `scripts/fill-timesheet.cjs`:

```powershell
$env:TIMESHEET_DATA = '{"STH0001":[0,8,...],"OVH0003":[0,0,1.5,...]}'
$env:TIMESHEET_USER = "username"
$env:TIMESHEET_PASS = "password"
node scripts/fill-timesheet.cjs
```

Script จะ:
1. Connect Chrome via CDP port 9222
2. Login อัตโนมัติ (username + password)
3. Navigate to /Timesheet
4. ตรวจสอบเดือนให้ตรง
5. เพิ่ม activity ที่ไม่มี (เช่น PRJ26017) จาก empty row dropdown
6. เคลียร์ค่าเก่า แล้วกรอกใหม่
7. **input[0] = activity code, input[1..30] = day 1..30** (index 0 ไม่ใช่วันที่!)
8. Click Save

### Step 8: Verify & cleanup

หลัง save:
- ตรวจสอบค่าที่กรอก (spot check วันทำงาน vs วันหยุด)
- ลบ junction: `cmd /c "rmdir $env:TEMP\chrome-junction-profile"`

## Important notes

- **input indexing**: input[0] ของแต่ละ row = activity code, input[1] = day 1, input[30] = day 30
- **Month selector**: ตรวจสอบว่าเดือนที่เลือกตรงกับเดือนที่ต้องการ
- **Save button**: ใช้ text match "save" (lowercase)
- **Junction trick**: Chrome ไม่ยอม CDP กับ default user-data-dir ต้อง mklink /J ไป path อื่น
- **ห้าม hardcode activity สำหรับชั่วโมงเหลือ** — ต้องถาม user ทุกครั้ง
