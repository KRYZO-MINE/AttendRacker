/* =========================================================
   API CONFIGURATION — Google Apps Script Web App
   =========================================================
   Paste your deployed Google Apps Script Web App URL below.
   Example: "https://script.google.com/macros/s/XXXXXXX/exec"
   ========================================================= */
const API_URL = "";
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

async function fetchAttendance() {
  if (DEMO_MODE === true) {
    await new Promise(r => setTimeout(r, 450));
    return demoMockData();
  }
  if (!apiConfigured()) {
    return { success: false, error: "Google Apps Script API is not configured.", notConfigured: true, data: [] };
  }
  try {
    const res = await fetch(API_URL, { method: "GET", headers: { "Accept": "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json || typeof json !== "object") throw new Error("Invalid response");
    json.data = Array.isArray(json.data) ? json.data : [];
    return json;
  } catch (e) {
    return { success: false, error: e.message || "Unable to fetch attendance.", data: [] };
  }
}

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
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return json || { success: true };
  } catch (e) {
    return { success: false, error: e.message || "Unable to save attendance." };
  }
}

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
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return json || { success: true, updated: true };
  } catch (e) {
    return { success: false, error: e.message || "Unable to update attendance." };
  }
}

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
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return json || { success: true, deleted: true };
  } catch (e) {
    return { success: false, error: e.message || "Unable to delete attendance." };
  }
}
