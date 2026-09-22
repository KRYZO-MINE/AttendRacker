let toastCounter = 0;

function collectFocusable(root) {
  if (!root) return [];
  const sel = "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex=\"-1\"])";
  return Array.from(root.querySelectorAll(sel)).filter(el => el.offsetParent !== null || el.getClientRects().length > 0);
}

function runFocusTrap(container, opts) {
  const els = () => collectFocusable(container);
  let list = els();
  if (!list.length) return () => {};
  const lastFocused = document.activeElement;
  const initial = (opts && opts.initial) || list[0];
  setTimeout(() => initial && initial.focus && initial.focus(), 0);
  const onKey = (e) => {
    if (e.key === "Tab") {
      list = els();
      if (!list.length) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    if (e.key === "Escape" && opts && typeof opts.onEsc === "function") opts.onEsc();
  };
  document.addEventListener("keydown", onKey);
  return function cleanup() {
    document.removeEventListener("keydown", onKey);
    setTimeout(() => { if (lastFocused && lastFocused.focus) lastFocused.focus(); }, 0);
  };
}

function showToast(message, type = "success") {
  const root = document.getElementById("toast-root");
  if (!root) return;
  const id = ++toastCounter;
  const el = document.createElement("div");
  el.className = `toast toast-${type === "error" ? "error" : "success"}`;
  el.setAttribute("role", type === "error" ? "alert" : "status");
  el.setAttribute("data-toast-id", String(id));
  const iconSvg = type === "error"
    ? '<svg viewBox="0 0 24 24" class="toast-icon" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"></path></svg>'
    : '<svg viewBox="0 0 24 24" class="toast-icon" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"></path></svg>';
  el.innerHTML = `${iconSvg}<div>${String(message || "")}</div>`;
  root.appendChild(el);
  setTimeout(() => {
    const node = root.querySelector(`[data-toast-id="${id}"]`);
    if (!node) return;
    node.style.transition = "opacity 200ms ease, transform 200ms ease";
    node.style.opacity = "0";
    node.style.transform = "translateX(-50%) translateY(8px)";
    setTimeout(() => node.remove(), 220);
  }, 3000);
}

function initDrawer() {
  const btn = document.getElementById("hamburger-btn");
  const closeBtn = document.getElementById("drawer-close");
  const drawer = document.getElementById("mobile-drawer");
  const overlay = document.getElementById("drawer-overlay");
  if (!btn || !drawer || !overlay) return;
  let cleanupTrap = null;

  const open = () => {
    drawer.classList.add("drawer-open");
    overlay.classList.add("overlay-open");
    btn.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
    cleanupTrap = runFocusTrap(drawer, { initial: closeBtn || btn });
  };
  const close = () => {
    drawer.classList.remove("drawer-open");
    overlay.classList.remove("overlay-open");
    btn.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
    if (cleanupTrap) { cleanupTrap(); cleanupTrap = null; }
  };

  btn.addEventListener("click", () => drawer.classList.contains("drawer-open") ? close() : open());
  closeBtn?.addEventListener("click", close);
  overlay.addEventListener("click", close);
  drawer.querySelectorAll("[data-mobile-nav]").forEach(a => a.addEventListener("click", close));
}

function showSkeleton(show) {
  const el = document.getElementById("skeleton-wrap");
  if (!el) return;
  el.classList.toggle("hidden", !show);
}

function renderRecords(filtered, all) {
  const tbody = document.getElementById("records-tbody");
  const cards = document.getElementById("records-cards-wrap");
  const tableWrap = document.getElementById("records-table-wrap");
  const cardsWrap = document.getElementById("records-cards-wrap");
  const empty = document.getElementById("records-empty");
  const count = document.getElementById("records-count");
  if (count) count.textContent = `${filtered.length} ${filtered.length === 1 ? "record" : "records"}`;

  if (!filtered.length) {
    tableWrap.classList.add("hidden");
    cardsWrap.classList.add("hidden");
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");
  tableWrap.classList.remove("hidden");
  cardsWrap.classList.remove("hidden");

  if (tbody) {
    tbody.innerHTML = "";
    for (const r of filtered) {
      const tr = document.createElement("tr");
      tr.className = "hover:bg-white/[0.02] transition";
      tr.innerHTML = `
        <td class="px-4 sm:px-5 py-4">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full bg-charcoal-700 border border-white/5 text-xs font-bold text-gray-200 flex items-center justify-center">${(r.employee || "?").slice(0,1)}</div>
            <div>
              <div class="font-semibold text-white text-sm">${escapeHtml(r.employee)}</div>
              <div class="text-xs text-gray-500 md:hidden">${escapeHtml(r.date || "")}</div>
            </div>
          </div>
        </td>
        <td class="px-4 sm:px-5 py-4 text-gray-200 tabular-nums">${r.inTime ? escapeHtml(r.inTime) : '<span class="text-gray-500">—</span>'}</td>
        <td class="px-4 sm:px-5 py-4 text-gray-200 tabular-nums">${r.outTime ? escapeHtml(r.outTime) : '<span class="text-gray-500">—</span>'}</td>
        <td class="px-4 sm:px-5 py-4 text-gray-200 tabular-nums">${r.totalHours ? escapeHtml(r.totalHours) : '<span class="text-gray-500">—</span>'}</td>
        <td class="px-4 sm:px-5 py-4"><span class="status-pill status-${statusClass(r.status)}">${escapeHtml(r.status || "-")}</span></td>
        <td class="hidden md:table-cell px-4 sm:px-5 py-4 text-gray-400 text-xs max-w-[220px] truncate">${r.notes ? escapeHtml(r.notes) : '<span class="text-gray-600">—</span>'}</td>
        <td class="px-4 sm:px-5 py-4 text-right">
          <div class="inline-flex items-center gap-1">
            <button data-edit type="button" aria-label="Edit record" data-employee="${escapeAttr(r.employee)}" data-date="${escapeAttr(r.date)}" class="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 text-gray-300 hover:text-white transition inline-flex items-center justify-center">
              <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
            <button data-delete type="button" aria-label="Delete record" data-employee="${escapeAttr(r.employee)}" data-date="${escapeAttr(r.date)}" class="w-9 h-9 rounded-lg bg-white/5 hover:bg-red-500/10 hover:border-red-500/30 border border-white/5 text-gray-300 hover:text-red-400 transition inline-flex items-center justify-center">
              <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"></path></svg>
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    }
  }

  if (cards) {
    cards.innerHTML = "";
    for (const r of filtered) {
      const card = document.createElement("div");
      card.className = "rounded-2xl border border-white/5 bg-charcoal-800/50 p-4";
      card.innerHTML = `
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-9 h-9 rounded-full bg-charcoal-700 border border-white/5 text-xs font-bold text-gray-200 flex items-center justify-center flex-shrink-0">${(r.employee || "?").slice(0,1)}</div>
            <div class="min-w-0">
              <div class="font-bold text-white truncate">${escapeHtml(r.employee)}</div>
              <div class="text-xs text-gray-500 mt-0.5">${escapeHtml(r.date || "")}</div>
            </div>
          </div>
          <span class="status-pill status-${statusClass(r.status)} flex-shrink-0">${escapeHtml(r.status || "-")}</span>
        </div>
        <div class="mt-4 grid grid-cols-3 gap-3">
          <div>
            <div class="text-[10px] font-bold tracking-[0.2em] text-gray-500 uppercase">In</div>
            <div class="mt-1 text-sm font-semibold text-gray-200 tabular-nums">${r.inTime ? escapeHtml(r.inTime) : '<span class="text-gray-500">—</span>'}</div>
          </div>
          <div>
            <div class="text-[10px] font-bold tracking-[0.2em] text-gray-500 uppercase">Out</div>
            <div class="mt-1 text-sm font-semibold text-gray-200 tabular-nums">${r.outTime ? escapeHtml(r.outTime) : '<span class="text-gray-500">—</span>'}</div>
          </div>
          <div>
            <div class="text-[10px] font-bold tracking-[0.2em] text-gray-500 uppercase">Hours</div>
            <div class="mt-1 text-sm font-bold text-white tabular-nums">${r.totalHours ? escapeHtml(r.totalHours) : '<span class="text-gray-500">—</span>'}</div>
          </div>
        </div>
        ${r.notes ? `<div class="mt-3 pt-3 border-t border-white/5 text-xs text-gray-400">Note: ${escapeHtml(r.notes)}</div>` : ""}
      `;
      cards.appendChild(card);
    }
  }
}

function renderStats(stats) {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = pad2(val); };
  set("stat-present", stats.present);
  set("stat-half", stats.half);
  set("stat-leave", stats.leave);
  set("stat-total", stats.totalEmployees);
  set("stat-pending", stats.pendingCheckout);
}

function statusClass(s) {
  const t = String(s || "").toLowerCase();
  if (t === "present") return "present";
  if (t === "half day") return "half";
  if (t === "leave") return "leave";
  return "present";
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, m => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));
}
function escapeAttr(s) { return escapeHtml(s); }

function showDuplicateModal(onUpdate) {
  const modal = document.getElementById("dup-modal");
  const overlay = document.getElementById("dup-overlay");
  const btnCancel = document.getElementById("dup-cancel");
  const btnUpdate = document.getElementById("dup-update");
  if (!modal) return;

  modal.classList.remove("hidden");
  modal.classList.add("flex");
  document.body.style.overflow = "hidden";
  let cleanup = null;

  const close = () => {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    document.body.style.overflow = "";
    if (cleanup) { cleanup(); cleanup = null; }
  };

  btnCancel.onclick = close;
  overlay.onclick = close;
  btnUpdate.onclick = () => { close(); onUpdate && onUpdate(); };
  cleanup = runFocusTrap(modal, { initial: btnCancel, onEsc: close });
}

function showConfirmModal({ title = "Confirm", text = "Are you sure?", okText = "Confirm", cancelText = "Cancel", danger = false }) {
  return new Promise((resolve) => {
    const modal = document.getElementById("confirm-modal");
    const overlay = document.getElementById("confirm-overlay");
    const t = document.getElementById("confirm-title");
    const tx = document.getElementById("confirm-text");
    const ok = document.getElementById("confirm-ok");
    const cxl = document.getElementById("confirm-cancel");
    if (!modal) { resolve(true); return; }
    if (t) t.textContent = title;
    if (tx) tx.textContent = text;
    if (ok) ok.textContent = okText;
    if (cxl) cxl.textContent = cancelText;
    if (ok) {
      ok.className = danger
        ? "h-11 px-5 rounded-lg bg-gradient-to-b from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-sm font-bold text-white transition active:scale-[.98]"
        : "h-11 px-5 rounded-lg bg-gradient-to-b from-blaze-400 to-blaze-500 hover:from-blaze-300 hover:to-blaze-400 text-sm font-bold text-white shadow-glow-orange transition active:scale-[.98]";
    }
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    document.body.style.overflow = "hidden";

    let done = false, cleanup = null;
    const close = (result) => {
      if (done) return; done = true;
      modal.classList.add("hidden");
      modal.classList.remove("flex");
      document.body.style.overflow = "";
      if (cleanup) cleanup();
      resolve(result);
    };
    cxl.onclick = () => close(false);
    overlay.onclick = () => close(false);
    ok.onclick = () => close(true);
    cleanup = runFocusTrap(modal, { initial: cxl, onEsc: () => close(false) });
  });
}

function renderHeroDate() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-IN", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
    timeZone: "Asia/Kolkata"
  }).formatToParts(now);
  const by = Object.fromEntries(parts.map(p => [p.type, p.value]));
  const wd = document.getElementById("hero-weekday");
  const dt = document.getElementById("hero-date");
  if (wd) wd.textContent = (by.weekday || "").toUpperCase();
  if (dt) dt.textContent = `${by.day} ${by.month} ${by.year}`;
}

function showAPIBanner(message) {
  const el = document.getElementById("api-banner");
  if (!el) return;
  el.classList.remove("hidden");
  el.textContent = message;
}

function setSubmitLoading(loading) {
  const btn = document.getElementById("submit-btn");
  const label = document.getElementById("submit-label");
  const spin = document.getElementById("submit-spinner");
  if (!btn) return;
  btn.disabled = !!loading;
  if (loading) {
    label?.classList.add("hidden");
    spin?.classList.remove("hidden");
    spin?.classList.add("inline-flex");
  } else {
    label?.classList.remove("hidden");
    spin?.classList.add("hidden");
    spin?.classList.remove("inline-flex");
  }
}

function renderReport(rows) {
  const wrap = document.getElementById("report-wrap");
  const empty = document.getElementById("report-empty");
  if (!rows || rows.length === 0) {
    wrap?.classList.add("hidden");
    if (empty) { empty.classList.remove("hidden"); empty.textContent = "No attendance data found for the selected filters."; }
    return;
  }
  empty?.classList.add("hidden");
  wrap?.classList.remove("hidden");
  wrap.innerHTML = "";
  for (const r of rows) {
    const pct = Math.max(0, Math.min(100, r.attendancePct || 0));
    const barW = pct;
    const el = document.createElement("div");
    el.className = "rounded-2xl border border-white/5 bg-charcoal-800/50 p-5";
    el.innerHTML = `
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-charcoal-700 border border-white/5 text-sm font-bold text-white flex items-center justify-center">${(r.employee || "?").slice(0,1)}</div>
          <div>
            <div class="font-bold text-white">${escapeHtml(r.employee)}</div>
            <div class="text-xs text-gray-500">Attendance Report</div>
          </div>
        </div>
        <div class="text-right">
          <div class="text-2xl font-extrabold text-white tabular-nums">${pct.toFixed(1)}%</div>
          <div class="text-[10px] tracking-widest uppercase text-gray-500">Attendance</div>
        </div>
      </div>
      <div class="mt-5 h-2 w-full rounded-full bg-white/5 overflow-hidden">
        <div class="h-full rounded-full bg-gradient-to-r from-blaze-500 to-blaze-300" style="width:${barW}%"></div>
      </div>
      <div class="mt-5 grid grid-cols-4 gap-2 text-center">
        <div class="rounded-lg bg-white/[0.03] py-2"><div class="text-[10px] uppercase tracking-widest text-gray-500">Days</div><div class="mt-0.5 text-sm font-bold text-white tabular-nums">${r.workingDays}</div></div>
        <div class="rounded-lg bg-white/[0.03] py-2"><div class="text-[10px] uppercase tracking-widest text-status-present/80">P</div><div class="mt-0.5 text-sm font-bold text-status-present tabular-nums">${r.present}</div></div>
        <div class="rounded-lg bg-white/[0.03] py-2"><div class="text-[10px] uppercase tracking-widest text-status-half/80">H</div><div class="mt-0.5 text-sm font-bold text-status-half tabular-nums">${r.half}</div></div>
        <div class="rounded-lg bg-white/[0.03] py-2"><div class="text-[10px] uppercase tracking-widest text-status-leave/80">L</div><div class="mt-0.5 text-sm font-bold text-status-leave tabular-nums">${r.leave}</div></div>
      </div>
    `;
    wrap.appendChild(el);
  }
}
