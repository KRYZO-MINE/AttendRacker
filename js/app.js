(function () {
  "use strict";

  const state = {
    allRecords: [],
    filters: { query: "", date: "", employee: "", status: "" },
    form: { updateMode: false, pendingRecord: null }
  };

  const $ = (id) => document.getElementById(id);

  function inputTo12hDisplay(value) {
    if (!value) return "";
    const [h, m] = value.split(":").map(Number);
    if (isNaN(h) || isNaN(m)) return "";
    return minutesTo12h(h * 60 + m);
  }
  function inputTo24h(value12) {
    const m = parse12hToMinutes(value12);
    if (m == null) return "";
    const h = Math.floor(m / 60), mm = m % 60;
    return `${pad2(h)}:${pad2(mm)}`;
  }

  function applyFormStatusUX() {
    const status = $("f-status")?.value || "";
    const timeWrap = $("time-fields-wrap");
    const leaveInfo = $("leave-info");
    const inp = $("f-in"), outp = $("f-out");
    if (!timeWrap || !leaveInfo) return;
    if (status.toLowerCase() === "leave") {
      timeWrap.style.opacity = "0.5";
      timeWrap.style.pointerEvents = "none";
      [inp, outp].forEach(el => { if (el) el.disabled = true; });
      leaveInfo.classList.remove("hidden");
    } else {
      timeWrap.style.opacity = "1";
      timeWrap.style.pointerEvents = "auto";
      [inp, outp].forEach(el => { if (el) el.disabled = false; });
      leaveInfo.classList.add("hidden");
    }
  }

  function recomputeFormTotals() {
    const inVal = $("f-in").value;
    const outVal = $("f-out").value;
    const status = $("f-status").value;
    const inDisplay = inputTo12hDisplay(inVal);
    const outDisplay = inputTo12hDisplay(outVal);
    const res = validateAndCalcTotal(inDisplay, outDisplay, status);
    const totalRow = $("total-hours-row");
    const totalLabel = $("total-hours");
    const timeError = $("time-error");
    const submitBtn = $("submit-btn");

    if (res.error.toLowerCase().includes("out time")) {
      timeError.classList.remove("hidden");
    } else {
      timeError.classList.add("hidden");
    }
    if (res.totalHours) {
      totalRow?.classList.remove("hidden");
      if (totalLabel) totalLabel.textContent = res.totalHours;
    } else {
      totalRow?.classList.add("hidden");
    }
    submitBtn.disabled = !res.valid;
    return { inDisplay, outDisplay, res };
  }

  function currentFormRecord() {
    const { inDisplay, outDisplay, res } = recomputeFormTotals();
    return {
      date: $("f-date").value,
      employee: $("f-employee").value,
      inTime: inDisplay,
      outTime: outDisplay,
      totalHours: res.totalHours,
      status: $("f-status").value,
      notes: $("f-notes").value.trim()
    };
  }

  function validateFormBasics(rec) {
    if (!rec.employee) { showToast("Please select an employee.", "error"); return false; }
    if (!rec.date) { showToast("Please select a date.", "error"); return false; }
    const s = rec.status.toLowerCase();
    if (s !== "leave") {
      if (!rec.inTime) { showToast("In Time is required.", "error"); return false; }
    }
    const v = validateAndCalcTotal(rec.inTime, rec.outTime, rec.status);
    if (!v.valid) { showToast(v.error || "Invalid entry.", "error"); return false; }
    rec.totalHours = v.totalHours;
    return true;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const rec = currentFormRecord();
    if (!validateFormBasics(rec)) return;

    setSubmitLoading(true);
    try {
      const dup = findDuplicate(state.allRecords, rec.date, rec.employee);
      if (dup && !state.form.updateMode) {
        setSubmitLoading(false);
        state.form.pendingRecord = rec;
        $("dup-text").textContent = `An attendance record already exists for ${rec.employee} on ${rec.date}.`;
        showDuplicateModal(async () => {
          state.form.updateMode = true;
          await performSave(rec, true);
          state.form.updateMode = false;
        });
        return;
      }
      await performSave(rec, !!state.form.updateMode || !!dup);
    } finally {
      state.form.updateMode = false;
      setSubmitLoading(false);
    }
  }

  async function performSave(rec, doUpdate) {
    setSubmitLoading(true);
    try {
      const resp = doUpdate ? await updateAttendance(rec) : await submitAttendance(rec);
      if (resp && resp.success) {
        showToast(doUpdate ? "Attendance updated successfully" : "Attendance saved successfully", "success");
        document.getElementById("attendance-form").reset();
        initFormDefaults();
        applyFormStatusUX();
        recomputeFormTotals();
        await refresh();
      } else {
        showToast((resp && resp.error) || "Unable to save attendance. Please try again.", "error");
      }
    } catch (err) {
      showToast("Unable to save attendance. Please try again.", "error");
    } finally {
      setSubmitLoading(false);
    }
  }

  async function refresh() {
    showSkeleton(true);
    const resp = await fetchAttendance();
    showSkeleton(false);
    if (resp && resp.notConfigured) {
      showAPIBanner("Google Apps Script API is not configured. Set API_URL in js/api.js to enable live sync.");
    }
    if (resp && resp.success) {
      state.allRecords = resp.data || [];
    } else {
      state.allRecords = [];
      if (resp && resp.error && !resp.notConfigured) showToast(resp.error, "error");
    }
    updateView();
  }

  function updateView() {
    const filtered = filterRecords(state.allRecords, state.filters);
    renderStats(calcStats(state.allRecords));
    renderRecords(filtered, state.allRecords);
  }

  function initFormDefaults() {
    const today = todayISOIndia();
    const d = $("f-date"); if (d && !d.value) d.value = today;
    const fd = $("filter-date"); if (fd && !fd.value) fd.value = today;
    const rm = $("r-month"); if (rm && !rm.value) rm.value = today.slice(0, 7);
  }

  function bindFormEvents() {
    const form = $("attendance-form");
    form.addEventListener("submit", handleSubmit);
    ["f-status", "f-in", "f-out"].forEach(id => {
      $(id).addEventListener("change", () => { applyFormStatusUX(); recomputeFormTotals(); });
      $(id).addEventListener("input", () => { applyFormStatusUX(); recomputeFormTotals(); });
    });
    form.addEventListener("input", recomputeFormTotals);
  }

  function bindFilterEvents() {
    const debounce = (fn, ms = 100) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
    $("search-input").addEventListener("input", debounce((e) => { state.filters.query = e.target.value; updateView(); }, 80));
    $("filter-date").addEventListener("change", (e) => { state.filters.date = e.target.value; updateView(); });
    $("filter-employee").addEventListener("change", (e) => { state.filters.employee = e.target.value; updateView(); });
    $("filter-status").addEventListener("change", (e) => { state.filters.status = e.target.value; updateView(); });
  }

  function bindRecordActions() {
    document.addEventListener("click", async (e) => {
      const editBtn = e.target.closest("[data-edit]");
      const delBtn = e.target.closest("[data-delete]");
      if (editBtn) {
        const emp = editBtn.getAttribute("data-employee");
        const date = editBtn.getAttribute("data-date");
        const rec = findDuplicate(state.allRecords, date, emp);
        if (rec) loadRecordIntoForm(rec);
      }
      if (delBtn) {
        const emp = delBtn.getAttribute("data-employee");
        const date = delBtn.getAttribute("data-date");
        const ok = await confirmActionDelete(emp, date);
        if (!ok) return;
        setSubmitLoading(true);
        const r = await deleteAttendance(date, emp);
        setSubmitLoading(false);
        if (r && r.success) { showToast("Attendance record deleted.", "success"); await refresh(); }
        else showToast((r && r.error) || "Unable to delete record.", "error");
      }
    });
  }

  function confirmActionDelete(emp, date) {
    return showConfirmModal({
      title: "Delete record",
      text: `Delete attendance for ${emp} on ${date}? This cannot be undone.`,
      okText: "Delete",
      cancelText: "Cancel",
      danger: true
    });
  }

  function loadRecordIntoForm(rec) {
    $("f-employee").value = rec.employee || "";
    $("f-date").value = rec.date || todayISOIndia();
    $("f-in").value = inputTo24h(rec.inTime || "");
    $("f-out").value = inputTo24h(rec.outTime || "");
    $("f-status").value = rec.status || "Present";
    $("f-notes").value = rec.notes || "";
    state.form.updateMode = true;
    applyFormStatusUX();
    recomputeFormTotals();
    document.getElementById("mark").scrollIntoView({ behavior: "smooth", block: "start" });
    showToast("Record loaded into form. Edit and click Save to update.", "success");
  }

  function bindReportEvents() {
    const run = $("r-run");
    if (!run) return;
    const go = () => {
      const mv = $("r-month").value;
      const ev = $("r-employee").value;
      if (!mv) { showToast("Please select a month.", "error"); return; }
      const rows = calcMonthlyReport(state.allRecords, mv, ev || "");
      renderReport(rows);
    };
    run.addEventListener("click", go);
    $("r-month").addEventListener("change", () => { if ($("r-month").value) go(); });
    $("r-employee").addEventListener("change", () => { if ($("r-month").value) go(); });
  }

  function bindNavSmooth() {
    document.querySelectorAll('a[href^="#"]').forEach(a => {
      a.addEventListener("click", (e) => {
        const href = a.getAttribute("href");
        if (!href || href.length < 2) return;
        const t = document.querySelector(href);
        if (t) {
          e.preventDefault();
          t.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    renderHeroDate();
    initFormDefaults();
    initDrawer();
    bindFormEvents();
    bindFilterEvents();
    bindRecordActions();
    bindReportEvents();
    bindNavSmooth();
    applyFormStatusUX();
    recomputeFormTotals();
    await refresh();
  });
})();
