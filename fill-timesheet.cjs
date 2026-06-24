// fill-timesheet.cjs — Fill IT Services Extended Timesheet via Chrome CDP
// Usage:
//   TIMESHEET_DATA='{"STH0001":[0,8,...]}' \
//   TIMESHEET_USER=singchaia \
//   TIMESHEET_PASS=xxx \
//   node scripts/fill-timesheet.cjs
//
// Expects Chrome running with --remote-debugging-port=9222
// Password is used once for login and never stored.

// ponytail: find playwright from @playwright/mcp (global npm) or local node_modules
function findPlaywright() {
  const paths = [
    'playwright', // local or global
    require('path').join(process.env.APPDATA || '', 'npm/node_modules/@playwright/mcp/node_modules/playwright'),
  ];
  for (const p of paths) {
    try { return require(p); } catch {}
  }
  console.error('Playwright not found. Install: npm i -g @playwright/mcp');
  process.exit(1);
}
const { chromium } = findPlaywright();

const data = JSON.parse(process.env.TIMESHEET_DATA || '{}');
const tsUser = process.env.TIMESHEET_USER || '';
const tsPass = process.env.TIMESHEET_PASS || '';

if (!Object.keys(data).length) {
  console.error('Set TIMESHEET_DATA env var with JSON fill data');
  process.exit(1);
}
if (!tsUser || !tsPass) {
  console.error('Set TIMESHEET_USER and TIMESHEET_PASS env vars');
  process.exit(1);
}

(async () => {
  console.log('Connecting to Chrome CDP on port 9222...');
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const page = browser.contexts()[0].pages()[0];

  // Navigate to Timesheet
  await page.goto('https://itservicex.chememan.com/Timesheet', { waitUntil: 'networkidle', timeout: 30000 });

  // Handle login
  if (page.url().includes('/Login')) {
    console.log('Logging in...');
    await page.fill('#tbxUser', tsUser);
    await page.fill('#tbxPassword', tsPass);
    await page.click('#btnSubmit');
    await page.waitForTimeout(3000);

    if (page.url().includes('/Login')) {
      console.error('Login failed — wrong username or password?');
      browser.close();
      process.exit(1);
    }

    console.log('Logged in!');
    if (!page.url().includes('/Timesheet')) {
      await page.goto('https://itservicex.chememan.com/Timesheet', { waitUntil: 'networkidle', timeout: 30000 });
    }
  }

  console.log('Page:', await page.title());
  await page.waitForSelector('select', { timeout: 15000 });
  await page.waitForTimeout(1000);

  // Add any missing activities (e.g. PRJ26017)
  const existingCodes = await page.evaluate(() =>
    Array.from(document.querySelectorAll('select'))
      .map(s => (s.value || '').trim())
      .filter(Boolean)
  );

  for (const code of Object.keys(data)) {
    if (existingCodes.includes(code)) continue;
    console.log('Adding ' + code + '...');
    const added = await page.evaluate((code) => {
      for (const sel of document.querySelectorAll('select')) {
        const row = sel.closest('tr');
        if (!row) continue;
        if (row.querySelectorAll('input').length < 20) continue;
        const val = (sel.value || '').trim();
        if (val && val !== '0' && !val.toLowerCase().includes('select')) continue;
        for (const opt of sel.options) {
          if (opt.value.includes(code) || opt.text.includes(code)) {
            sel.value = opt.value;
            sel.dispatchEvent(new Event('change', { bubbles: true }));
            return opt.text;
          }
        }
      }
      return null;
    }, code);
    if (added) console.log('  Added:', added);
    else console.error('  NOT FOUND in dropdown:', code);
    await page.waitForTimeout(500);
  }

  // Clear existing values, then fill
  // input[0] = activity code, input[1..N] = day 1..N
  console.log('\nClearing & filling...');
  const result = await page.evaluate((fillData) => {
    const log = [];
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;

    for (const [code, days] of Object.entries(fillData)) {
      let found = false;
      for (const sel of document.querySelectorAll('select')) {
        if ((sel.value || '').trim() !== code) continue;
        const inputs = sel.closest('tr')?.querySelectorAll('input');
        if (!inputs || inputs.length < 20) continue;

        // Clear days first (skip input[0] = activity code)
        for (let i = 1; i < inputs.length; i++) {
          if (inputs[i].value && inputs[i].value !== '' && inputs[i].value !== '0' && inputs[i].value !== '0.0') {
            setter.call(inputs[i], '');
            inputs[i].dispatchEvent(new Event('input', { bubbles: true }));
            inputs[i].dispatchEvent(new Event('change', { bubbles: true }));
          }
        }

        // Fill with correct indexing: inputs[d] = day d
        let filled = 0, total = 0;
        for (let d = 1; d < days.length; d++) {
          if (days[d] <= 0 || !inputs[d]) continue;
          setter.call(inputs[d], days[d].toString());
          inputs[d].dispatchEvent(new Event('input', { bubbles: true }));
          inputs[d].dispatchEvent(new Event('change', { bubbles: true }));
          inputs[d].dispatchEvent(new Event('blur', { bubbles: true }));
          filled++;
          total += days[d];
        }
        log.push(code + ': ' + filled + ' cells, ' + total + 'h');
        found = true;
        break;
      }
      if (!found) log.push(code + ': NOT FOUND');
    }
    return log;
  }, data);

  result.forEach(l => console.log('  ' + l));

  // Save
  console.log('\nSaving...');
  const saved = await page.evaluate(() => {
    for (const el of document.querySelectorAll('button, input[type="submit"], input[type="button"], a')) {
      const txt = (el.textContent || el.value || '').trim().toLowerCase();
      if (txt === 'save' || txt === 'บันทึก') { el.click(); return txt; }
    }
    return null;
  });

  if (saved) {
    await page.waitForTimeout(3000);
    console.log('Saved!');
  } else {
    console.log('Save button not found — save manually');
  }

  // Verify spot check
  const verify = await page.evaluate(() => {
    const checks = {};
    for (const sel of document.querySelectorAll('select')) {
      const code = (sel.value || '').trim();
      if (!code) continue;
      const inputs = sel.closest('tr')?.querySelectorAll('input');
      if (!inputs || inputs.length < 20) continue;
      const vals = [];
      for (let i = 1; i < inputs.length; i++) {
        const v = inputs[i].value;
        if (v && v !== '' && v !== '0' && v !== '0.0') vals.push({ d: i, v });
      }
      if (vals.length) checks[code] = vals;
    }
    return checks;
  });

  console.log('\nFilled values:');
  for (const [code, vals] of Object.entries(verify)) {
    console.log('  ' + code + ': ' + vals.map(v => 'd' + v.d + '=' + v.v).join(', '));
  }

  console.log('\nDONE!');
  browser.close();
  process.exit(0);
})();
