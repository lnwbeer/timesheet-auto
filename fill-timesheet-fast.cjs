// fill-timesheet-fast.cjs — Direct HTTP POST, no browser needed (~2s)
// Usage: same env vars as fill-timesheet.cjs
//   TIMESHEET_DATA, TIMESHEET_USER, TIMESHEET_PASS
// Does NOT need Chrome running.

const https = require('https');
const { URL } = require('url');

const BASE = 'https://itservicex.chememan.com';
const data = JSON.parse(process.env.TIMESHEET_DATA || '{}');
const user = process.env.TIMESHEET_USER || '';
const pass = process.env.TIMESHEET_PASS || '';

// --- cookie jar ---
const jar = {};
function saveCk(headers) {
  for (const c of [].concat(headers['set-cookie'] || [])) {
    const eq = c.indexOf('='), semi = c.indexOf(';');
    if (eq > 0) jar[c.slice(0, eq).trim()] = c.slice(eq + 1, semi > 0 ? semi : undefined).trim();
  }
}
function ckStr() { return Object.entries(jar).map(([k, v]) => k + '=' + v).join('; '); }

// --- http helper (follows redirects) ---
function http(method, path, body, depth) {
  depth = depth || 0;
  return new Promise((resolve, reject) => {
    const u = new URL(path, BASE);
    const opts = {
      method, hostname: u.hostname, path: u.pathname + u.search,
      headers: { Cookie: ckStr(), 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      rejectUnauthorized: false,
    };
    if (body != null) {
      opts.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      opts.headers['Content-Length'] = Buffer.byteLength(body);
    }
    const req = https.request(opts, function (res) {
      saveCk(res.headers);
      const chunks = [];
      res.on('data', function (d) { chunks.push(d); });
      res.on('end', function () {
        const b = Buffer.concat(chunks).toString();
        if ([301, 302, 303].includes(res.statusCode) && res.headers.location && depth < 5) {
          return http('GET', res.headers.location, null, depth + 1).then(resolve, reject);
        }
        resolve({ status: res.statusCode, body: b });
      });
    });
    req.on('error', reject);
    if (body != null) req.write(body);
    req.end();
  });
}

// --- html helpers ---
function attr(tag, name) {
  var m = tag.match(new RegExp(name + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i'));
  return m ? (m[1] != null ? m[1] : m[2] != null ? m[2] : m[3] || '') : null;
}
function dec(s) {
  if (!s) return '';
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#(\d+);/g, function (_, n) { return String.fromCharCode(+n); });
}

// parse ALL form fields (hidden + visible inputs + selects)
function parseFields(html) {
  var f = {};
  var im;
  var inputRe = /<input\b([^>]*)>/gi;
  while ((im = inputRe.exec(html)) !== null) {
    var t = '<x ' + im[1] + '>';
    var n = attr(t, 'name');
    if (!n) continue;
    var type = (attr(t, 'type') || 'text').toLowerCase();
    if (type === 'checkbox' || type === 'radio') {
      if (/checked/i.test(im[1])) f[n] = attr(t, 'value') || 'on';
      continue;
    }
    var v = attr(t, 'value');
    f[n] = v != null ? dec(v) : '';
  }
  var sm;
  var selRe = /<select\b[^>]*name=["']([^"']+)["'][^>]*>([\s\S]*?)<\/select>/gi;
  while ((sm = selRe.exec(html)) !== null) {
    var so = sm[2].match(/<option[^>]*selected[^>]*value=["']([^"']*?)["']/i);
    f[sm[1]] = so ? dec(so[1]) : '';
  }
  return f;
}

// parse timesheet grid rows: [{code, inputs: [{name, value, disabled}]}]
function parseGrid(html) {
  var rows = [];
  var sm;
  var selRe = /<select\b([^>]*)>([\s\S]*?)<\/select>/gi;
  while ((sm = selRe.exec(html)) !== null) {
    var sn = attr('<x ' + sm[1] + '>', 'name');
    if (!sn) continue;
    var so = sm[2].match(/<option[^>]*selected[^>]*value=["']([^"']*?)["']/i);
    var code = so ? so[1].trim() : '';

    var trS = html.lastIndexOf('<tr', sm.index);
    var trE = html.indexOf('</tr>', sm.index);
    if (trS < 0 || trE < 0) continue;
    var row = html.slice(trS, trE + 5);

    var inputs = [];
    var im2;
    var inRe = /<input\b([^>]*)>/gi;
    while ((im2 = inRe.exec(row)) !== null) {
      var t2 = '<x ' + im2[1] + '>';
      var n2 = attr(t2, 'name');
      if (!n2) continue;
      inputs.push({ name: n2, value: attr(t2, 'value') || '', disabled: /disabled|readonly/i.test(im2[1]) });
    }
    if (inputs.length >= 15) rows.push({ selName: sn, code: code, inputs: inputs });
  }
  return rows;
}

(async () => {
  var t0 = Date.now();
  if (!Object.keys(data).length || !user || !pass) {
    console.error('Set TIMESHEET_DATA, TIMESHEET_USER, TIMESHEET_PASS');
    process.exit(1);
  }

  // 1. Login
  console.log('Login...');
  var lp = await http('GET', '/Login');
  var lf = parseFields(lp.body);
  var lb = new URLSearchParams();
  for (var k in lf) { if (k.startsWith('__')) lb.set(k, lf[k]); }
  lb.set('tbxUser', user);
  lb.set('tbxPassword', pass);
  lb.set('btnSubmit', 'Log in');
  var lr = await http('POST', '/Login', lb.toString());
  if (lr.body.includes('tbxPassword') && lr.body.includes('tbxUser')) {
    console.error('Login failed');
    process.exit(1);
  }
  console.log('Logged in (' + (Date.now() - t0) + 'ms)');

  // 2. Load timesheet
  var tp = await http('GET', '/Timesheet');
  var html = tp.body;
  var fields = parseFields(html);
  var grid = parseGrid(html);
  console.log('Loaded ' + grid.length + ' rows: ' + grid.map(function (r) { return r.code || '?'; }).join(', ') + ' (' + (Date.now() - t0) + 'ms)');

  // 3. Detect holidays (disabled day inputs)
  var holidays = new Set();
  if (grid.length) {
    for (var i = 1; i < grid[0].inputs.length; i++) {
      if (grid[0].inputs[i].disabled) holidays.add(i);
    }
  }
  if (holidays.size) console.log('Holidays (disabled): days ' + Array.from(holidays).join(', '));

  // 4. Fill values into fields map
  var missing = [];
  for (var entry of Object.entries(data)) {
    var code = entry[0], days = entry[1];
    var row = grid.find(function (r) { return r.code === code; });
    if (!row) { missing.push(code); continue; }
    var filled = 0, total = 0;
    for (var d = 1; d < days.length && d < row.inputs.length; d++) {
      if (holidays.has(d) || row.inputs[d].disabled) { fields[row.inputs[d].name] = ''; continue; }
      var val = days[d] > 0 ? days[d].toString() : '';
      fields[row.inputs[d].name] = val;
      if (days[d] > 0) { filled++; total += days[d]; }
    }
    console.log('  ' + code + ': ' + filled + ' cells, ' + total + 'h');
  }
  if (missing.length) {
    console.error('MISSING activities (not on page): ' + missing.join(', '));
    console.error('Add them manually or use fill-timesheet.cjs (browser version) first');
    process.exit(1);
  }

  // 5. Find save button
  var fb = new URLSearchParams();
  for (var fk in fields) fb.set(fk, fields[fk]);

  // Try __doPostBack style (LinkButton)
  var pbm = html.match(/__doPostBack\('([^']*?)','[^']*?'\)[^>]*>[^<]*(save|บันทึก)/i);
  if (!pbm) pbm = html.match(/(save|บันทึก)[^<]*<\/a>[^]*?__doPostBack\('([^']*?)'/i); // reverse order
  if (pbm) {
    var target = pbm[1].includes('save') || pbm[1].includes('บันทึก') ? pbm[2] || pbm[1] : pbm[1];
    fb.set('__EVENTTARGET', target);
    fb.set('__EVENTARGUMENT', '');
  } else {
    // Try regular submit button
    var btnRe = /<input\b([^>]*?)>/gi;
    var bm;
    while ((bm = btnRe.exec(html)) !== null) {
      var bt = '<x ' + bm[1] + '>';
      var btype = (attr(bt, 'type') || '').toLowerCase();
      if (btype !== 'submit' && btype !== 'button') continue;
      var bval = (attr(bt, 'value') || '').toLowerCase();
      var bname = attr(bt, 'name');
      if ((bval.includes('save') || bval.includes('บันทึก')) && bname) {
        fb.set(bname, attr(bt, 'value') || '');
        break;
      }
    }
  }

  // 6. POST save
  console.log('Saving...');
  var sr = await http('POST', '/Timesheet', fb.toString());
  if (sr.status >= 400) {
    console.error('Save failed — HTTP ' + sr.status);
    process.exit(1);
  }
  console.log('Saved! (' + (Date.now() - t0) + 'ms)');

  // 7. Verify
  var vp = await http('GET', '/Timesheet');
  var vg = parseGrid(vp.body);
  console.log('\nVerify:');
  for (var vc of Object.keys(data)) {
    var vr = vg.find(function (r) { return r.code === vc; });
    if (!vr) { console.log('  ' + vc + ': NOT FOUND'); continue; }
    var vv = [];
    for (var vd = 1; vd < vr.inputs.length; vd++) {
      var vval = vr.inputs[vd].value;
      if (vval && vval !== '0' && vval !== '0.0' && vval !== '0.00') vv.push('d' + vd + '=' + vval);
    }
    console.log('  ' + vc + ': ' + (vv.length ? vv.join(', ') : '(empty)'));
  }

  console.log('\nDONE in ' + (Date.now() - t0) + 'ms');
})();
