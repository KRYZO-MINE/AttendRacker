# AtenForm — Attendance Tracker

Minimalist, responsive attendance management web app for small teams. Frontend-only (HTML + Tailwind CSS + Vanilla JS), backend via Google Sheets + Apps Script.

## Features

- Mark attendance (Employee, Date, In/Out Time, Status, Notes)
- Auto-calculates total hours (standard workday: 8h 48m)
- Live records view with search, date, employee & status filters
- Desktop: table view / Mobile: card view
- Monthly report generator with attendance %
- Edit / Delete records with confirmation modals
- Custom toast notifications + focus-trapped dialogs (a11y)
- Works offline in Demo Mode with mock data

## Stack

- **Frontend:** HTML, Tailwind CSS (CDN), Vanilla JS modules
- **Backend:** Google Sheets as DB + Google Apps Script Web API
- **Timezone:** Asia/Kolkata (IST)

## Project Structure

```
AtenForm/
├── index.html          # Main UI
├── css/style.css       # Custom styles on top of Tailwind
├── js/
│   ├── api.js          # Apps Script API layer (GET via JSONP, POST via form-urlencoded)
│   ├── attendance.js   # Business logic (hours calc, filtering, formatting)
│   ├── ui.js           # UI helpers (toasts, modals, focus traps)
│   └── app.js          # Event wiring + init
├── code.gs             # Google Apps Script backend (paste into Apps Script editor)
├── work.md             # Detailed manual setup checklist
└── plan.txt
```

## Quick Start

### 1. Run locally

Serve the folder with any static server:

```bash
# Python 3
python -m http.server 5500

# Node (npx)
npx serve .
```

Open `http://localhost:5500`

### 2. Demo Mode (no backend)

Open [js/api.js](js/api.js) and set:

```js
const DEMO_MODE = true;
```

Reload — the app loads with 5 mock employee records.

### 3. Connect Google Sheets (live backend)

See [work.md](work.md) for full step-by-step. Short version:

1. **Create sheet** → tab named `Attendance`, headers exactly:
   `Date | Employee Name | In Time | Out Time | Total Hours | Status | Notes`

2. **Apps Script** → inside the sheet, Extensions → Apps Script. Delete default code, paste [code.gs](code.gs), save.

3. **Deploy** → New deployment → **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone** (critical)
   - Deploy → authorize → copy the `.../exec` URL.

4. **Configure** → open [js/api.js](js/api.js#L7):
   ```js
   const API_URL = "https://script.google.com/macros/s/XXXX/exec";
   const DEMO_MODE = false;
   ```

5. Reload. Submit a record → should appear in Google Sheet instantly.

## Deploy

Static site → host on Vercel / GitHub Pages / Netlify (no build step needed).

## Employees Roster

Update in **two** places to keep dropdowns in sync:

1. [js/api.js](js/api.js#L10) → `EMPLOYEE_ROSTER`
2. `<option>` tags inside the 3 employee dropdowns in [index.html](index.html)

## License

Internal use — Sanyam Consultants.
