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
   POST helper — uses application/x-www-form-urlencoded
   (this is a "simple request" per CORS spec — NO preflight,
   so it works even when Google Apps Script redirects)
   ----------------------------------------------------------- */
async function formPost(payload) {
  const bodyData = "payload=" + encodeURIComponent(JSON.stringify(payload));
  const res = await fetch(API_URL, {
    method: "POST",
    redirect: "follow",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8"
    },
    body: bodyData
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch (_) {
    // If response is JSONP-wrapped despite POST, try to extract it
    const m = /\(([\s\S]*)\)\s*;?\s*$/.exec(text);
    json = m ? JSON.parse(m[1]) : { success: true };
  }
  return json || { success: true };
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
   Strategy: Try JSONP first; if it fails (e.g. old Apps Script deployment,
   extension block, MIME nosniff block) fall back to form-urlencoded POST
   with action=getAttendance. POST is a CORS "simple request" — no preflight,
   survives 302 redirects to googleusercontent.com reliably.
   ================================ */
async function fetchAttendance() {
  if (DEMO_MODE === true) {
    await new Promise(r => setTimeout(r, 450));
    return demoMockData();
  }
  if (!apiConfigured()) {
    return { success: false, error: "Google Apps Script API is not configured.", notConfigured: true, data: [] };
  }

  // Transport 1: JSONP (ideal — GET semantics, cached)
  try {
    const raw = await jsonpGet(API_URL, 25000);
    return normalizeResp(raw);
  } catch (_e1) {
    // fall through silently to Transport 2
  }

  // Transport 2: form-urlencoded POST with action=getAttendance
  try {
    const raw = await formPost({ action: "getAttendance" });
    return normalizeResp(raw);
  } catch (e2) {
    return {
      success: false,
      error: e2.message || "Cannot reach Apps Script — Redeploy Code.gs with 'Anyone' access, disable ad/privacy extensions, then refresh.",
      data: []
    };
  }
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
    return json || { success: true };
  } catch (e) {
    return { success: false, error: e.message || "Unable to save attendance." };
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
    return json || { success: true, updated: true };
  } catch (e) {
    return { success: false, error: e.message || "Unable to update attendance." };
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
    return json || { success: true, deleted: true };
  } catch (e) {
    return { success: false, error: e.message || "Unable to delete attendance." };
  }
}
