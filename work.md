# Sanyam Consultants Attendance Tracker — Manual Work Checklist (YOU)

Everything the front-end code does is finished. Below is the list of tasks that **must be done by you manually** because they need your Google account / Vercel account / actual credentials.

---

## 1. Google Sheet Setup (required for real data)

### 1.1 Create the Attendance Sheet
- Go to https://sheets.google.com → create a new spreadsheet.
- **Sheet name (tab)**: Exactly `Attendance` (case-sensitive — Apps Script will target this tab).
- **Rename the file**: e.g. `Sanyam Consultants Attendance 2026`.
- **Header row (Row 1) — EXACT column order, exact text:**

| A | B | C | D | E | F | G |
|---|---|---|---|---|---|---|
| Date | Employee Name | In Time | Out Time | Total Hours | Status | Notes |

- **Save.** Don't type anything else in Row 1.

### 1.2 Employee roster
Make sure the Employee dropdown in the app and the sheet are in sync.
Current roster hardcoded in [api.js:L10](file:///c:/Users/Admin/Documents/AtenForm/js/api.js#L10-L10) → `EMPLOYEE_ROSTER = ["Vijay","Sahil","Janvi","Anju","Garvi"]`.
If you change this later, also edit the 3 employee dropdowns in [index.html](file:///c:/Users/Admin/Documents/AtenForm/index.html) (look for `Vijay / Sahil / Janvi / Anju / Garvi` option tags) and change `EMPLOYEE_ROSTER` in [api.js](file:///c:/Users/Admin/Documents/AtenForm/js/api.js).

---

## 2. Google Apps Script Web App (required for live API sync)

### 2.1 Open Apps Script editor
- Inside your Google Sheet → click **Extensions → Apps Script**.
- Rename the untitled project to e.g. `Sanyam Attendance API`.

### 2.2 Replace Code.gs with the following

```javascript
// Sanyam Consultants Attendance - Apps Script Web API
const SHEET_NAME = "Attendance";

function doGet(e) {
  try {
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    const data = sh.getDataRange().getValues();
    if (data.length < 2) return jsonOut({ success: true, records: [] });
    const headers = data[0].map(h => String(h).trim());
    const records = data.slice(1).map(row => {
      const r = {};
      headers.forEach((h, i) => {
        r[h] = (row[i] instanceof Date)
          ? Utilities.formatDate(row[i], Session.getScriptTimeZone(), "yyyy-MM-dd")
          : (row[i] != null ? String(row[i]).trim() : "");
      });
      return r;
    });
    return jsonOut({ success: true, records });
  } catch (err) {
    return jsonOut({ success: false, error: err.message }, 500);
  }
}

function doPost(e) {
  try {
    const body = safeJson(e.postData?.contents);
    const action = String(body.action || "").toLowerCase();

    if (action === "addattendance") return addAttendance(body);
    if (action === "updateattendance") return updateAttendance(body);
    if (action === "deleteattendance") return deleteAttendance(body);

    return jsonOut({ success: false, error: "Unknown action" }, 400);
  } catch (err) {
    return jsonOut({ success: false, error: err.message }, 500);
  }
}

function addAttendance(body) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const key = `${body.date}|${body.employee}`;
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const rowKey = `${formatDate(data[i][0])}|${String(data[i][1] || "").trim()}`;
    if (rowKey === key) return jsonOut({ success: false, error: "Duplicate record. Use updateAttendance instead." }, 409);
  }
  sh.appendRow([
    toDate(body.date),
    body.employee || "",
    body.inTime || "",
    body.outTime || "",
    body.totalHours || "",
    body.status || "",
    body.notes || ""
  ]);
  return jsonOut({ success: true });
}

function updateAttendance(body) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const key = `${body.date}|${body.employee}`;
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const rowKey = `${formatDate(data[i][0])}|${String(data[i][1] || "").trim()}`;
    if (rowKey === key) {
      const row = i + 1;
      sh.getRange(row, 3).setValue(body.inTime || "");
      sh.getRange(row, 4).setValue(body.outTime || "");
      sh.getRange(row, 5).setValue(body.totalHours || "");
      sh.getRange(row, 6).setValue(body.status || "");
      sh.getRange(row, 7).setValue(body.notes || "");
      return jsonOut({ success: true });
    }
  }
  return jsonOut({ success: false, error: "Record not found to update." }, 404);
}

function deleteAttendance(body) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const key = `${body.date}|${body.employee}`;
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const rowKey = `${formatDate(data[i][0])}|${String(data[i][1] || "").trim()}`;
    if (rowKey === key) {
      sh.deleteRow(i + 1);
      return jsonOut({ success: true });
    }
  }
  return jsonOut({ success: false, error: "Record not found to delete." }, 404);
}

// ---------- helpers ----------
function safeJson(s) { try { return JSON.parse(s || "{}"); } catch (_) { return {}; } }
function jsonOut(obj, code) {
  const out = ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
  if (code) out.setHeaders({ "X-Response-Code": String(code) });
  return out;
}
function pad(n){return n<10?"0"+n:""+n;}
function formatDate(v) {
  if (v instanceof Date) return `${v.getFullYear()}-${pad(v.getMonth()+1)}-${pad(v.getDate())}`;
  if (!v) return "";
  return String(v).trim().slice(0,10);
}
function toDate(str) {
  if (!str) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(str).trim());
  if (!m) return str;
  return new Date(Number(m[1]), Number(m[2])-1, Number(m[3]));
}
```

### 2.3 Deploy the Apps Script as a Web App
- Click **Deploy → New deployment**.
- Click the **gear** icon → choose **Web app**.
- Fill:
  - **Description**: e.g. `Sanyam Attendance v1`
  - **Execute as**: `Me (your@email)`
  - **Who has access**: **Anyone** (required — otherwise anonymous browser calls fail)
- Click **Deploy** → authorize → choose your Google account → "Advanced → Go to…" → Allow.
- **Copy the Web App URL** that looks like `https://script.google.com/macros/s/ABC...xyz/exec`

### 2.4 Paste the URL into the front-end code
Open [api.js](file:///c:/Users/Admin/Documents/AtenForm/js/api.js) and edit **line 7**:

```js
const API_URL = "PASTE_YOUR_DEPLOYED_WEB_APP_URL_HERE";
```

Leave `DEMO_MODE = false` (line 8) so the banner goes away and the real API is used.

### 2.5 Verify live sync
- Reload http://localhost:8080
- The orange "Google Apps Script API is not configured" banner on top should disappear.
- Submit one attendance record using the form → open the Google Sheet → the new row should appear instantly.
- Edit a record (click ✎ on a row) → save → the same row updates in the sheet.
- Delete a record → row disappears from the sheet.

If any step fails: check **Executions** tab in the Apps Script sidebar for error messages.

---

## 3. Optional — Temporary local demo (no Apps Script)

If you just want to preview the UI with mock data before you finish step 2:
Open [api.js](file:///c:/Users/Admin/Documents/AtenForm/js/api.js), change **line 8**:

```js
const DEMO_MODE = true;
```

Refresh the page → shows 5 mock attendance rows (Vijay Present, Sahil Present 8h48m, Janvi Half, Anju Leave, Garvi Present).
Don't forget to set it back to `false` when going live.

---

## 4. Deploy the website to production (optional but recommended)

The app is static (no server required) — host on Vercel / GitHub Pages / Netlify for free.

### 4a. Vercel (recommended, one click)
1. Go to https://vercel.com/new
2. Import your project folder (or push the folder to GitHub first, then import the repo).
3. Framework Preset: **Other** (static files).
4. Click **Deploy** → done. You get a URL like `sanyam-consultants.vercel.app`.
5. Open the deployed URL → attendance app loads.
6. Since the Apps Script is already allowed for "Anyone", the live site works with the real sheet immediately.

### 4b. GitHub Pages
1. Push `c:\Users\Admin\Documents\AtenForm` to a GitHub repo.
2. Repo → Settings → Pages → Branch = `main` / root folder → Save.
3. After ~1 min visit `https://your-username.github.io/repo-name/`.

### 4c. Custom domain (optional)
Add a custom domain (e.g. `attendance.sanyamconsultants.in`) via the Vercel/GH Pages dashboard. Update the DNS records they give you with your domain registrar.

---

## 5. Daily usage workflow (for anyone using the site)
1. Open the deployed URL in the browser (mobile or desktop).
2. Select **Employee → Date → In Time → Out Time → Status → Notes** (if any) → **SAVE ATTENDANCE**.
3. Use search + filters in Today's Attendance to find records → ✎ edits → 🗑 deletes (with red confirm modal).
4. Use the Monthly Report section to pick a month + employee, hit **Generate Report** to see attendance %.

---

## 6. Maintenance checklist (once every few months)
- [ ] Rotate Apps Script deployment if Google resets the URL (re-deploy → copy new URL → update [api.js](file:///c:/Users/Admin/Documents/AtenForm/js/api.js)).
- [ ] Back up the Google Sheet periodically: File → Make a copy.
- [ ] Add new employees → update the 3 dropdowns in [index.html](file:///c:/Users/Admin/Documents/AtenForm/index.html) AND `EMPLOYEE_ROSTER` in [api.js](file:///c:/Users/Admin/Documents/AtenForm/js/api.js) → re-deploy site.
- [ ] Check the toast API banner on load — if it reappears, API_URL got reset.

---

## Quick Reference — File Map
| You need to edit manually | Purpose |
|---|---|
| Google Sheet `Attendance` tab, Row 1 headers | Data storage (columns exactly as above) |
| Apps Script `Code.gs` → Deploy as Web App | REST API layer |
| [api.js](file:///c:/Users/Admin/Documents/AtenForm/js/api.js) L7 | Paste the Apps Script URL |
| [api.js](file:///c:/Users/Admin/Documents/AtenForm/js/api.js) L8 | Toggle DEMO_MODE if you want mock preview |
| [api.js](file:///c:/Users/Admin/Documents/AtenForm/js/api.js) L10 | Update EMPLOYEE_ROSTER if employees change |
| [index.html](file:///c:/Users/Admin/Documents/AtenForm/index.html) (search options tags) | Sync dropdown options with roster |

That's it — everything else (HTML/CSS/JS, UI, validation, reports, mobile, accessibility, toasts, focus trap, duplicate detection, etc.) is done for you already.
