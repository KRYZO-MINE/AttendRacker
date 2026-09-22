function parse12hToMinutes(str) {
  if (!str) return null;
  const s = String(str).trim().toUpperCase();
  const m = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  const period = m[3];
  if (period === "PM" && h < 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  if (h < 0 || h > 23 || mm < 0 || mm > 59) return null;
  return h * 60 + mm;
}

function minutesTo12h(total) {
  if (total == null || isNaN(total)) return "";
  const h = Math.floor(total / 60);
  const m = total % 60;
  const period = h >= 12 ? "PM" : "AM";
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return `${pad2(h12)}:${pad2(m)} ${period}`;
}

function formatDurationMinutes(diff) {
  if (diff == null || isNaN(diff) || diff <= 0) return "";
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function validateAndCalcTotal(inStr, outStr, status) {
  const s = (status || "").toLowerCase();
  if (s === "leave") {
    return { valid: true, error: "", totalHours: "", inMin: null, outMin: null };
  }
  const inMin = parse12hToMinutes(inStr);
  const outMin = parse12hToMinutes(outStr);

  if (s === "present" && !inStr) {
    return { valid: false, error: "In Time is required for Present status.", totalHours: "", inMin, outMin };
  }
  if (s === "half day" && !inStr) {
    return { valid: false, error: "In Time is required for Half Day status.", totalHours: "", inMin, outMin };
  }

  if (inMin != null && outMin != null) {
    if (outMin <= inMin) {
      return { valid: false, error: "Out time cannot be earlier than in time.", totalHours: "", inMin, outMin };
    }
    return { valid: true, error: "", totalHours: formatDurationMinutes(outMin - inMin), inMin, outMin };
  }
  return { valid: true, error: "", totalHours: "", inMin, outMin };
}

function calcStats(records) {
  const data = Array.isArray(records) ? records : [];
  const employees = new Set();
  let present = 0, half = 0, leave = 0, pending = 0;
  for (const r of data) {
    if (r.employee) employees.add(r.employee);
    const s = (r.status || "").toLowerCase();
    if (s === "present") {
      present++;
      if (!r.outTime) pending++;
    } else if (s === "half day") {
      half++;
      if (!r.outTime) pending++;
    } else if (s === "leave") {
      leave++;
    }
  }
  for (const name of EMPLOYEE_ROSTER) employees.add(name);
  return {
    totalEmployees: employees.size,
    present, half, leave,
    pendingCheckout: pending
  };
}

function filterRecords(records, { query = "", date = "", employee = "", status = "" } = {}) {
  const q = String(query).trim().toLowerCase();
  return records.filter(r => {
    if (date && r.date !== date) return false;
    if (employee && r.employee !== employee) return false;
    if (status && r.status !== status) return false;
    if (q) {
      const hay = `${r.employee || ""} ${r.date || ""} ${r.status || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function findDuplicate(records, date, employee) {
  return records.find(r => r.date === date && r.employee === employee) || null;
}

function calcMonthlyReport(records, monthISO, employeeFilter) {
  const [y, m] = monthISO.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0));
  const daysInMonth = end.getUTCDate();

  let workingDays = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(Date.UTC(y, m - 1, d));
    const wd = dt.getUTCDay();
    if (wd !== 0 && wd !== 6) workingDays++;
  }

  const monthPrefix = `${y}-${pad2(m)}`;
  const monthRecords = records.filter(r => String(r.date || "").startsWith(monthPrefix));

  const groups = {};
  const roster = employeeFilter ? [employeeFilter] : EMPLOYEE_ROSTER.slice();
  for (const name of roster) groups[name] = { present: 0, half: 0, leave: 0 };

  for (const r of monthRecords) {
    if (!(r.employee in groups)) continue;
    const s = (r.status || "").toLowerCase();
    if (s === "present") groups[r.employee].present++;
    else if (s === "half day") groups[r.employee].half++;
    else if (s === "leave") groups[r.employee].leave++;
  }

  return Object.entries(groups).map(([employee, c]) => {
    const denom = workingDays > 0 ? workingDays : 1;
    const points = c.present + (c.half / 2);
    const pct = Math.max(0, Math.min(100, (points / denom) * 100));
    return {
      employee,
      workingDays,
      present: c.present,
      half: c.half,
      leave: c.leave,
      attendancePct: Math.round(pct * 10) / 10
    };
  });
}
