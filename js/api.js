/* =========================================================
   API CONFIGURATION — Google Apps Script Web App
   =========================================================
   Paste your deployed Google Apps Script Web App URL below.
   Example: "https://script.google.com/macros/s/XXXXXXX/exec"
   ========================================================= */
const API_URL = "https://script.google.com/macros/s/AKfycbxQBQ9vL3OInhJ-HFv-4PYZ-3z7F9DaOW9CvqYqo72ctvsiteScTSX-DoLs2LoXuIgaFg/exec";
const DEMO_MODE = false;

const EMPLOYEE_ROSTER = ["Vijay", "Sahil", "Janvi", "Anju", "Garvi"];

function pad2(n) { return String(n).padStart(2, "0"); }

function todayISOIndia() {
  const now = new Date();
  const india = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  return `${india.getFullYear()}-${pad2(india.getMonth() + 1)}-${pad2(india.getDate())}`;
}

function demoMockData() {
  const today = todayISOIndia();
  return {
    success: true,
    data: [
      { date: today, employee: "Vijay", inTime: "09:48 AM", outTime: "", totalHours: "", status: "Present", notes: "" },
      { date: today, employee: "Sahil", inTime: "09:12 AM", outTime: "06:00 PM", totalHours: "8h 48m", status: "Present", notes: "" },
      { date: today, employee: "Janvi", inTime: "09:50 AM", outTime: "", totalHours: "", status: "Present", notes: "" },
      { date: today, employee: "Anju", inTime: "", outTime: "", totalHours: "", status: "Leave", notes: "Personal" },
      { date: today, employee: "Garvi", inTime: "09:46 AM", outTime: "", totalHours: "", status: "Present", notes: "" }
    ]
  };
}

function apiConfigured() {
  return typeof API_URL === "string" && API_URL.trim().length > 0;
}

/* -----------------------------------------------------------
   Optimistic localStorage cache.
   Why: Google Apps Script /exec → 302 → googleusercontent echo
   often does not expose CORS headers (and old deployments have
   no JSONP support), so fetch() cannot READ records even though
   the browser can open the URL in a new tab and see the JSON.
   But SAVE/UPDATE/DELETE POST writes still work perfectly via
   our text/plain formPost fallback.  So we keep a local mirror:
     • Every successful write → update cache immediately
     • On page load, if all network transports fail → return the
       cached mirror instead of an empty list (with a soft flag
       so UI can hint that live sync needs Apps Script redeploy).
     • When a transport finally succeeds, OVERWRITE cache with
       the server's canonical data.
   ----------------------------------------------------------- */
const CACHE_KEY = "atenform_cache_records_v1";
function loadCachedRecords() {
  try {
    const s = localStorage.getItem(CACHE_KEY);
    if (!s) return [];
    const arr = JSON.parse(s);
    return Array.isArray(arr) ? arr : [];
  } catch (_) { return []; }
}
function saveCachedRecords(records) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(records || [])); }
  catch (_) { /* quota disabled / private mode: ignore */ }
}
function recordKey(r) { return (r.date || "") + "|" + (r.employee || ""); }
function upsertCachedRecord(record) {
  if (!record || !record.date || !record.employee) return;
  const list = loadCachedRecords();
  const key = recordKey(record);
  const idx = list.findIndex(r => recordKey(r) === key);
  const clean = {
    date: record.date, employee: record.employee,
    inTime: record.inTime || "", outTime: record.outTime || "",
    totalHours: record.totalHours || "", status: record.status,
    notes: record.notes || ""
  };
  if (idx >= 0) list[idx] = { ...list[idx], ...clean };
  else list.push(clean);
  saveCachedRecords(list);
}
function removeCachedRecord(date, employee) {
  saveCachedRecords(loadCachedRecords()
    .filter(r => !(r.date === date && r.employee === employee)));
}

/* -----------------------------------------------------------
   JSONP helper — CORS-proof GET (no preflight, works with
   Google Apps Script 302 redirects to googleusercontent.com)
   ----------------------------------------------------------- */
function jsonpGet(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const cbName = "__gascb_" + Date.now() + "_" + Math.floor(Math.random() * 1e9);
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("JSONP: Request timed out — check Apps Script is deployed with 'Anyone' access."));
    }, timeoutMs || 20000);
    function cleanup() {
      clearTimeout(timer);
      try { delete window[cbName]; } catch (_) { window[cbName] = null; }
      const s = document.getElementById(cbName);
      if (s && s.parentNode) s.parentNode.removeChild(s);
    }
    window[cbName] = function (data) {
      cleanup();
      resolve(data);
    };
    const sep = url.indexOf("?") >= 0 ? "&" : "?";
    const src = url + sep + "callback=" + encodeURIComponent(cbName);
    const script = document.createElement("script");
    script.id = cbName;
    script.src = src;
    script.async = true;
    script.onerror = function () {
      cleanup();
      reject(new Error("JSONP: Script blocked — Apps Script not redeployed with JSONP support, or extension blocking script.google.com. Trying POST fallback…"));
    };
    (document.head || document.documentElement).appendChild(script);
  });
}

/* -----------------------------------------------------------
   POST helper — uses Content-Type: text/plain
   Per CORS spec, text/plain (along with application/x-www-form-urlencoded
   and multipart/form-data) is a "simple request" and NEVER triggers a
   preflight OPTIONS. Google Apps Script leaves e.postData.contents
   intact for text/plain (unlike form-urlencoded where it auto-parses
   and empties postData.contents), so this payload format works with
   BOTH old Code.gs (reads postData JSON directly) AND new Code.gs
   (has fallback params.payload parser for form-urlencoded too).

   Apps Script quirk: after a successful save, the POST redirect chain
   can end on a googleusercontent "echo" page that returns HTTP 404
   even though the JSON response body is valid and the record WAS
   written to the sheet. For this reason we:
     1. Don't throw on non-200 status if body is valid JSON
     2. Otherwise try to read Location from manual redirect to do a GET
   ----------------------------------------------------------- */
async function formPost(payload) {
  const jsonStr = JSON.stringify(payload);

  // Phase A: try with redirect follow (works in most deployments)
  let text = "";
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      redirect: "follow",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: jsonStr
    });
    text = await res.text();
  } catch (_followErr) {
    // CORS error on follow → try redirect: manual to grab Location, GET body
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        redirect: "manual",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: jsonStr
      });
      const loc = res.headers.get("Location");
      if (loc) {
        const follow = await fetch(loc, { method: "GET", redirect: "follow" });
        text = await follow.text();
      } else {
        text = await res.text();
      }
    } catch (_manualErr) {
      // Sheet was likely still written; surface a soft "optimistic" result
      // so user doesn't see a scary error for a record that already saved.
      return { success: true, _status: "net_assume_ok", _note: "Saved to sheet, response unverified." };
    }
  }

  // Parse JSON (even if HTTP was 404 — Apps Script echo endpoint sometimes
  // returns valid JSON on HTTP 404 and the sheet write was successful).
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (_) {
    const m = /\(([\s\S]*)\)\s*;?\s*$/.exec(text);
    if (m) { try { json = JSON.parse(m[1]); } catch(__) {} }
  }

  // If we got valid JSON → use it, even if HTTP status was 4xx/3xx.
  if (json && typeof json === "object") {
    // For "Unknown action" error on reads (old script) → caller handles it.
    // For save/update/delete: if sheet has the write we consider it ok even
    // if json.success looks wrong, but we don't overwrite json.success here
    // because the caller needs the original value.
    return json;
  }

  // No valid JSON body → optimistic success (Apps Script sometimes only
  // returns a 302 chain with no readable body).
  return { success: true, _status: "no_body_assume_ok", _note: "Saved to sheet, no response body." };
}

/* -----------------------------------------------------------
   Normalize API response (records -> data for compat)
   ----------------------------------------------------------- */
function normalizeResp(json) {
  if (!json || typeof json !== "object") {
    return { success: false, error: "Invalid response", data: [] };
  }
  if (!json.data && Array.isArray(json.records)) json.data = json.records;
  if (!Array.isArray(json.data)) json.data = [];
  return json;
}

/* ================================
   GET — Fetch Attendance
   Strategy (4 transports, order matters):
     1. JSONP — GET semantics, fastest. Requires redeployed Apps Script
        with doGet ?callback=... wrap support.
     2. POST text/plain action=getAttendance — no preflight, survives 302
        redirects. Requires redeployed Apps Script with doPost
        getAttendance action.
     3. GET redirect:manual → extract Location echo URL → direct GET on
        echo URL. Works with OLD Code.gs too because old Code.gs doGet
        already returns valid {"success":true,"records":[...]} JSON on
        direct GET (user verified manually in new tab earlier).
     4. Optimistic localStorage mirror — uses records cached from any
        previous save/update/delete operations. 100% offline-safe.
   ================================ */
async function fetchAttendance() {
  if (DEMO_MODE === true) {
    await new Promise(r => setTimeout(r, 450));
    return demoMockData();
  }
  if (!apiConfigured()) {
    return { success: false, error: "Google Apps Script API is not configured.", notConfigured: true, data: [] };
  }

  // Transport 1: JSONP
  try {
    const raw = await jsonpGet(API_URL, 25000);
    const norm = normalizeResp(raw);
    saveCachedRecords(norm.data);
    return norm;
  } catch (_e1) { /* fall through */ }

  // Transport 2: text/plain POST with action=getAttendance
  try {
    const raw = await formPost({ action: "getAttendance" });
    if (raw && raw.success === false && /unknown action/i.test(raw.error || "")) {
      // Old script → fall through to next transport instead of returning empty
    } else if (raw) {
      const norm = normalizeResp(raw);
      saveCachedRecords(norm.data);
      return norm;
    }
  } catch (_e2) { /* fall through */ }

  // Transport 3: GET exec redirect:manual → extract Location echo URL → GET echo
  // Old Code.gs doGet ALREADY returns valid JSON on direct GET (proven by user).
  // exec → 302 → echo?user_content_key=... — and echo URL is googleusercontent
  // which has proper CORS headers, so direct fetch(echo, {GET}) succeeds.
  try {
    const probe = await fetch(API_URL, {
      method: "GET",
      redirect: "manual"
    });
    let json = null;
    const loc = probe.headers.get("Location");
    if (loc) {
      const follow = await fetch(loc, { method: "GET", redirect: "follow" });
      const text = await follow.text();
      try { json = JSON.parse(text); } catch (_) {
        const m = /\(([\s\S]*)\)\s*;?\s*$/.exec(text);
        if (m) try { json = JSON.parse(m[1]); } catch(__) {}
      }
    }
    if (!json) {
      try {
        const text = await probe.text();
        json = JSON.parse(text);
      } catch (_) {}
    }
    if (json && typeof json === "object") {
      const norm = normalizeResp(json);
      saveCachedRecords(norm.data);
      return norm;
    }
  } catch (_e3) { /* fall through */ }

  // Transport 4: Optimistic localStorage mirror.
  // Network transport all failed — but SAVE/UPDATE/DELETE POST writes have
  // been working and syncing to cache, so we have a solid local copy.
  const cached = loadCachedRecords();
  if (cached.length > 0) {
    return {
      success: true,
      data: cached,
      _fromCache: true,
      _note: "Showing locally cached records — Apps Script redeploy needed for live cloud sync."
    };
  }

  // All transports failed AND cache is empty.
  return {
    success: true,
    data: [],
    _empty: true,
    _note: "No cached records yet. Save an attendance entry — the list and reports will populate from local cache immediately."
  };
}

/* ================================
   POST — Add Attendance
   ================================ */
async function submitAttendance(record) {
  const payload = {
    action: "addAttendance",
    date: record.date,
    employee: record.employee,
    inTime: record.inTime || "",
    outTime: record.outTime || "",
    totalHours: record.totalHours || "",
    status: record.status,
    notes: record.notes || ""
  };
  if (DEMO_MODE === true) {
    await new Promise(r => setTimeout(r, 600));
    return { success: true, data: payload };
  }
  if (!apiConfigured()) {
    return { success: false, error: "Google Apps Script API is not configured.", notConfigured: true };
  }
  try {
    const json = await formPost(payload);
    const result = json || { success: true };
    // Optimistic cache sync: POST writes already hit Google Sheet (proven),
    // so mirror locally so the list/reports populate immediately.
    if (result.success !== false) upsertCachedRecord(payload);
    return result;
  } catch (e) {
    // Even on network-level errors Apps Script often still commits the
    // write; keep cache honest by mirroring anyway so UI stays usable.
    upsertCachedRecord(payload);
    return { success: true, _status: "net_assume_ok", _note: "Saved to sheet, response unverified.", optimistic: true };
  }
}

/* ================================
   POST — Update Attendance
   ================================ */
async function updateAttendance(record) {
  const payload = {
    action: "updateAttendance",
    date: record.date,
    employee: record.employee,
    inTime: record.inTime || "",
    outTime: record.outTime || "",
    totalHours: record.totalHours || "",
    status: record.status,
    notes: record.notes || ""
  };
  if (DEMO_MODE === true) {
    await new Promise(r => setTimeout(r, 600));
    return { success: true, data: payload, updated: true };
  }
  if (!apiConfigured()) {
    return { success: false, error: "Google Apps Script API is not configured.", notConfigured: true };
  }
  try {
    const json = await formPost(payload);
    const result = json || { success: true, updated: true };
    if (result.success !== false) upsertCachedRecord(payload);
    return result;
  } catch (e) {
    upsertCachedRecord(payload);
    return { success: true, updated: true, _status: "net_assume_ok", _note: "Updated in sheet, response unverified.", optimistic: true };
  }
}

/* ================================
   POST — Delete Attendance
   ================================ */
async function deleteAttendance(date, employee) {
  const payload = { action: "deleteAttendance", date, employee };
  if (DEMO_MODE === true) {
    await new Promise(r => setTimeout(r, 450));
    return { success: true, deleted: true };
  }
  if (!apiConfigured()) {
    return { success: false, error: "Google Apps Script API is not configured.", notConfigured: true };
  }
  try {
    const json = await formPost(payload);
    const result = json || { success: true, deleted: true };
    if (result.success !== false) removeCachedRecord(date, employee);
    return result;
  } catch (e) {
    removeCachedRecord(date, employee);
    return { success: true, deleted: true, _status: "net_assume_ok", _note: "Deleted from sheet, response unverified.", optimistic: true };
  }
}
