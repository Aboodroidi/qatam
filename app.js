/* ============================================================
   حسابات المزرعة — Qatam Farm expense tracker
   ============================================================ */

(function () {
  "use strict";

  const CFG = window.QATAM_CONFIG || {};
  const PARTNERS = CFG.PARTNERS || [];
  const CATEGORIES = CFG.CATEGORIES || [];
  const CURRENCY = CFG.CURRENCY || "";
  const BUCKET = "receipts";

  // ---------- Helpers ----------
  const $ = (sel) => document.querySelector(sel);
  const el = (tag, cls) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    return n;
  };
  const partnerName = (id) => (PARTNERS.find((p) => p.id === id) || {}).name || id;
  const partnerColor = (id) => (PARTNERS.find((p) => p.id === id) || {}).color || "var(--brand)";
  const categoryName = (id) => (CATEGORIES.find((c) => c.id === id) || {}).name || id;

  // Western digits with thousands separators for clarity (3,380).
  const nf = new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const fmtMoney = (n) => nf.format(Number(n) || 0);

  function fmtDate(iso) {
    if (!iso) return "";
    const d = new Date(iso + "T00:00:00");
    if (isNaN(d)) return iso;
    // Arabic month names, Western digits — e.g. "15 يوليو 2026"
    return new Intl.DateTimeFormat("ar-u-nu-latn", { day: "numeric", month: "long", year: "numeric" }).format(d);
  }

  // Official Omani Rial symbol (Central Bank of Oman guideline). Scalable
  // vector that inherits the text colour; placed to the LEFT of the numeral.
  const RIAL_PATH = "M 60.05 261.94 L 98.55 192.21 L 230.20 191.90 C 228.88 142.98 247.16 83.29 279.20 45.75 C 318.23 0.00 376.41 22.47 415.27 55.84 C 420.17 60.04 434.50 72.86 434.29 78.52 L 408.30 177.87 C 377.58 143.70 338.13 105.87 287.70 114.30 C 278.21 115.89 265.40 124.91 260.51 133.13 C 248.36 153.56 273.55 178.35 287.23 191.89 L 656.01 191.89 L 617.18 261.94 L 356.08 261.94 C 367.28 271.51 383.15 280.37 396.75 286.32 C 403.88 289.45 431.12 299.97 437.15 299.97 L 596.10 299.97 L 557.27 370.03 L 0.00 370.03 L 39.03 299.97 L 284.23 299.97 L 256.20 261.94 Z M 60.05 261.94";
  const RIAL_SVG = `<svg class="omr" viewBox="0 0 656 370" role="img" aria-label="ريال عماني"><path d="${RIAL_PATH}"/></svg>`;
  // symbol + number (symbol on the left, with a gap) — container needs class "money"
  function moneyInner(n) { return `<span class="omr-wrap">${RIAL_SVG}</span><span class="amt">${fmtMoney(n)}</span>`; }
  function moneyHTML(n) { return `<span class="money">${moneyInner(n)}</span>`; }
  function todayISO() {
    const d = new Date();
    const off = d.getTimezoneOffset();
    return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
  }

  // ---------- Config check ----------
  if (!CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY) {
    $("#setup-banner").classList.remove("hidden");
    // still show the who screen so the layout is visible, but disable saving
  }

  const sb = (CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && window.supabase)
    ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY)
    : null;

  // ---------- State ----------
  const DEMO_MODE = /[?&]demo/.test(location.search);
  let currentUser = localStorage.getItem("qatam_user") || null;
  let receipts = [];
  let filterPartner = "all";
  let filterCategory = "all";

  // Chart colour palette (legible on light & dark)
  const PALETTE = [
    "#2f7d4f", "#c9a24b", "#4a90d9", "#d16b54", "#7a5ea8",
    "#3fae9c", "#d98cb3", "#8a9a3b", "#c77d3a", "#5d7a8c",
    "#9b59b6", "#16a085", "#e67e22", "#607d8b",
  ];

  // Sample data for previewing the dashboard without Supabase (?demo=1).
  // These are fictional numbers — NOT the farm's real figures.
  const DEMO_DATA = [
    { partner: "abo_abdullah",    amount: 1200, category: "official_fees", receipt_date: "2024-09-08", note: "عينة" },
    { partner: "abo_abdulrahman", amount: 300,  category: "survey",        receipt_date: "2024-10-17", note: "عينة" },
    { partner: "abo_abdullah",    amount: 450,  category: "legal",         receipt_date: "2025-10-25", note: "عينة" },
    { partner: "abo_abdullah",    amount: 800,  category: "survey",        receipt_date: "2025-12-17", note: "عينة" },
    { partner: "abo_abdullah",    amount: 150,  category: "development",   receipt_date: "2025-12-20", note: "عينة" },
    { partner: "abo_abdulrahman", amount: 250,  category: "registration",  receipt_date: "2026-05-12", note: "عينة" },
    { partner: "abo_abdullah",    amount: 600,  category: "roadworks",     receipt_date: "2026-07-15", note: "عينة" },
    { partner: "abo_abdulrahman", amount: 500,  category: "seeds",         receipt_date: "2026-08-03", note: "عينة" },
    { partner: "abo_abdullah",    amount: 320,  category: "fuel",          receipt_date: "2026-08-20", note: "عينة" },
    { partner: "abo_abdulrahman", amount: 700,  category: "labor",         receipt_date: "2026-09-10", note: "عينة" },
  ].map((r, i) => ({ id: "demo-" + i, ...r }));

  // ---------- Brand names ----------
  if (CFG.FARM_NAME) {
    $("#who-farm-name").textContent = CFG.FARM_NAME;
    $("#farm-name").textContent = CFG.FARM_NAME;
  }

  // ---------- Who screen ----------
  function renderWhoButtons() {
    const wrap = $("#who-buttons");
    wrap.innerHTML = "";
    PARTNERS.forEach((p) => {
      const b = el("button");
      b.style.setProperty("--pc", p.color || "var(--brand)");
      const dot = el("span", "pdot"); dot.style.background = p.color || "var(--brand)";
      b.appendChild(dot);
      b.appendChild(document.createTextNode(p.name));
      b.onclick = () => setUser(p.id);
      wrap.appendChild(b);
    });
  }
  function setUser(id) {
    currentUser = id;
    localStorage.setItem("qatam_user", id);
    showApp();
  }
  function showWho() {
    $("#app").classList.add("hidden");
    $("#who-screen").classList.remove("hidden");
    renderWhoButtons();
  }

  // ---------- App shell ----------
  function showApp() {
    $("#who-screen").classList.add("hidden");
    $("#app").classList.remove("hidden");
    const pill = $("#who-pill");
    pill.innerHTML = "";
    const pdot = el("span", "pdot"); pdot.style.background = partnerColor(currentUser);
    pill.appendChild(pdot);
    pill.appendChild(document.createTextNode(partnerName(currentUser)));
    pill.style.color = partnerColor(currentUser);
    pill.style.borderColor = partnerColor(currentUser);
    pill.onclick = showWho;
    buildFormOptions();
    buildFilters();
    renderTotals();
    renderList();
    loadReceipts();
  }

  // ---------- Form options ----------
  function buildFormOptions() {
    const ps = $("#f-partner");
    ps.innerHTML = "";
    PARTNERS.forEach((p) => {
      const o = el("option");
      o.value = p.id; o.textContent = p.name;
      if (p.id === currentUser) o.selected = true;
      ps.appendChild(o);
    });
    const cs = $("#f-category");
    cs.innerHTML = "";
    const ph = el("option");           // blank placeholder — stays empty if the AI can't tell
    ph.value = ""; ph.textContent = "— اختر الفئة —";
    cs.appendChild(ph);
    CATEGORIES.forEach((c) => {
      const o = el("option");
      o.value = c.id; o.textContent = c.name;
      cs.appendChild(o);
    });
  }

  // ---------- Filters ----------
  function buildFilters() {
    // Partner filtering is done by clicking the total cards (see renderTotals).
    const cf = $("#filter-category");
    cf.innerHTML = "";
    const catOpts = [{ id: "all", name: "كل الفئات" }, ...CATEGORIES];
    catOpts.forEach((c) => {
      const chip = el("button", "chip" + (filterCategory === c.id ? " active" : ""));
      chip.textContent = c.name;
      chip.onclick = () => { filterCategory = c.id; buildFilters(); renderList(); };
      cf.appendChild(chip);
    });
  }

  // ---------- Totals ----------
  function renderTotals() {
    const wrap = $("#totals");
    wrap.innerHTML = "";
    const totals = {};
    PARTNERS.forEach((p) => (totals[p.id] = { sum: 0, count: 0 }));
    let grand = 0, grandCount = 0;
    receipts.forEach((r) => {
      if (totals[r.partner]) { totals[r.partner].sum += Number(r.amount); totals[r.partner].count++; }
      grand += Number(r.amount); grandCount++;
    });

    PARTNERS.forEach((p) => {
      wrap.appendChild(totalCard(p.name, totals[p.id].sum, totals[p.id].count, { partner: p.id, color: partnerColor(p.id) }));
    });
    wrap.appendChild(totalCard("الإجمالي الكلي", grand, grandCount, { partner: "all", grand: true }));
  }
  function setPartnerFilter(id) {
    filterPartner = id;
    renderTotals();
    renderList();
  }
  function totalCard(label, value, count, opts) {
    const active = filterPartner === opts.partner;
    const c = el("div", "total-card" + (opts.grand ? " grand" : "") + (active ? " active" : ""));
    if (opts.color) c.style.setProperty("--pc", opts.color);
    c.dataset.partner = opts.partner;
    const l = el("div", "tc-label"); l.textContent = label;
    const v = el("div", "tc-value money");
    v.innerHTML = moneyInner(value);
    const cnt = el("div", "tc-count"); cnt.textContent = count + " إيصال";
    c.append(l, v, cnt);
    // Clicking a card filters by that partner; clicking the active one (or the
    // grand-total card) shows everyone again.
    c.onclick = () => {
      const next = opts.partner !== "all" && filterPartner === opts.partner ? "all" : opts.partner;
      setPartnerFilter(next);
    };
    return c;
  }

  // ---------- List ----------
  function filtered() {
    return receipts.filter((r) => {
      if (filterPartner !== "all" && r.partner !== filterPartner) return false;
      if (filterCategory !== "all" && r.category !== filterCategory) return false;
      return true;
    });
  }
  function renderList() {
    const list = $("#receipts-list");
    const rows = filtered();
    list.innerHTML = "";
    $("#empty-state").classList.toggle("hidden", rows.length > 0);
    rows.forEach((r) => list.appendChild(receiptRow(r)));
  }
  function receiptRow(r) {
    const row = el("div", "receipt");

    // Amount takes the leading spot (where the receipt icon used to be).
    const amt = el("div", "receipt-amount");
    amt.innerHTML = moneyHTML(r.amount);
    row.appendChild(amt);

    // Keep a small thumbnail only when a real receipt photo exists.
    if (r.photo_url) {
      const img = el("img", "receipt-thumb");
      img.src = r.photo_url; img.alt = "إيصال"; img.loading = "lazy";
      img.onclick = () => openLightbox(r.photo_url);
      row.appendChild(img);
    }

    const main = el("div", "receipt-main");
    const top = el("div", "receipt-top");
    const cat = el("span", "receipt-cat"); cat.textContent = categoryName(r.category);
    const dt = el("span", "receipt-date"); dt.textContent = "📅 " + fmtDate(r.receipt_date);
    top.append(cat, dt); // category on the right, date on the left (top row)

    const meta = el("div", "receipt-meta");
    const who = el("span", "receipt-who");
    who.style.color = partnerColor(r.partner);
    const dot = el("span", "pdot"); dot.style.background = partnerColor(r.partner);
    who.appendChild(dot);
    who.appendChild(document.createTextNode(partnerName(r.partner)));
    meta.append(who);

    main.append(top, meta);
    if (r.note) { const note = el("div", "receipt-note"); note.textContent = r.note; main.appendChild(note); }

    row.append(main);
    return row;
  }

  // ---------- Data ----------
  async function loadReceipts() {
    if (DEMO_MODE) {
      $("#loading-state").classList.add("hidden");
      receipts = DEMO_DATA.slice();
      renderTotals();
      renderList();
      return;
    }
    if (!sb) { $("#loading-state").classList.add("hidden"); return; }
    const { data, error } = await sb
      .from("receipts")
      .select("*")
      .order("receipt_date", { ascending: false })
      .order("created_at", { ascending: false });
    $("#loading-state").classList.add("hidden");
    if (error) { console.error(error); alert("تعذّر تحميل البيانات: " + error.message); return; }
    receipts = data || [];
    renderTotals();
    renderList();
    subscribeRealtime();
  }

  let subscribed = false;
  function subscribeRealtime() {
    if (!sb || subscribed) return;
    subscribed = true;
    sb.channel("receipts-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "receipts" }, () => {
        // simplest robust approach: reload on any change
        reloadQuiet();
      })
      .subscribe();
  }
  async function reloadQuiet() {
    if (!sb) return;
    const { data } = await sb.from("receipts").select("*")
      .order("receipt_date", { ascending: false })
      .order("created_at", { ascending: false });
    receipts = data || [];
    renderTotals();
    renderList();
  }

  async function deleteReceipt(r) {
    if (!confirm("حذف هذا الإيصال؟")) return;
    if (!sb) return;
    // remove storage object if present
    if (r.photo_path) {
      await sb.storage.from(BUCKET).remove([r.photo_path]).catch(() => {});
    }
    const { error } = await sb.from("receipts").delete().eq("id", r.id);
    if (error) { alert("تعذّر الحذف: " + error.message); return; }
    receipts = receipts.filter((x) => x.id !== r.id);
    renderTotals();
    renderList();
  }

  // ---------- Modal ----------
  const modal = $("#modal");
  function openModal() {
    if (!sb) { alert("الإعدادات غير مكتملة. راجع ملف config.js وملف README."); return; }
    $("#receipt-form").reset();
    buildFormOptions();
    // Start blank — the scan fills what it can read; unknowns stay empty.
    $("#f-category").value = "";
    $("#photo-preview").classList.add("hidden");
    $("#analyze-status").classList.add("hidden");
    $("#form-error").classList.add("hidden");
    modal.classList.remove("hidden");
  }
  function closeModal() { modal.classList.add("hidden"); }

  document.querySelectorAll("[data-close]").forEach((b) => (b.onclick = closeModal));
  $("#add-btn").onclick = openModal;

  // photo preview + auto-analysis
  $("#f-photo").onchange = (e) => {
    const file = e.target.files && e.target.files[0];
    const box = $("#photo-preview");
    if (!file) { box.classList.add("hidden"); return; }
    const url = URL.createObjectURL(file);
    $("#photo-preview-img").src = url;
    box.classList.remove("hidden");
    analyzeReceipt(file);
  };

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function setAnalyzeStatus(kind, text) {
    const box = $("#analyze-status");
    if (!kind) { box.classList.add("hidden"); return; }
    box.className = "analyze-status " + kind;
    box.innerHTML =
      (kind === "loading" ? '<span class="spin"></span>' : "") +
      "<span></span>";
    box.querySelector("span:last-child").textContent = text;
  }

  async function analyzeReceipt(file) {
    if (!sb) return;
    setAnalyzeStatus("loading", "جارٍ قراءة الإيصال بالذكاء الاصطناعي…");
    try {
      const base64 = await fileToBase64(file);
      const { data, error } = await sb.functions.invoke("analyze-receipt", {
        body: {
          image: base64,
          media_type: file.type || "image/jpeg",
          categories: CATEGORIES,
          today: todayISO(),
        },
      });
      if (error) throw new Error(error.message);
      if (!data || data.error) throw new Error((data && data.error) || "فشل التحليل");

      const r = data.result || {};
      if (typeof r.amount === "number" && r.amount > 0) $("#f-amount").value = r.amount;
      if (r.date && /^\d{4}-\d{2}-\d{2}$/.test(r.date)) $("#f-date").value = r.date;
      if (r.category && CATEGORIES.some((c) => c.id === r.category)) $("#f-category").value = r.category;
      if (r.merchant && !$("#f-note").value) $("#f-note").value = r.merchant;

      setAnalyzeStatus("ok", "تم استخراج البيانات — يمكنك مراجعتها وتعديلها.");
    } catch (err) {
      console.error(err);
      setAnalyzeStatus("err", "تعذّر تحليل الصورة تلقائيًا — أدخل البيانات يدويًا.");
    }
  }

  // submit
  $("#receipt-form").onsubmit = async (e) => {
    e.preventDefault();
    const errBox = $("#form-error");
    errBox.classList.add("hidden");
    const btn = $("#submit-btn");

    const partner = $("#f-partner").value;
    const amount = parseFloat($("#f-amount").value);
    const date = $("#f-date").value;
    const category = $("#f-category").value;
    const note = $("#f-note").value.trim();
    const file = $("#f-photo").files[0];

    if (!(amount >= 0) || !date || !category || !partner) {
      errBox.textContent = "يرجى تعبئة الحقول المطلوبة.";
      errBox.classList.remove("hidden");
      return;
    }

    btn.disabled = true;
    btn.textContent = "جارٍ الحفظ…";

    try {
      let photo_url = null, photo_path = null, photoFailed = false;
      if (file) {
        try {
          const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
          const rand = Math.random().toString(36).slice(2, 8);
          const path = `${date}_${partner}_${rand}.${ext}`;
          const up = await sb.storage.from(BUCKET).upload(path, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type || "image/jpeg",
          });
          if (up.error) throw up.error;
          const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(path);
          photo_url = pub.publicUrl; photo_path = path;
        } catch (upErr) {
          // Don't lose the expense over a photo problem — save without it.
          console.warn("photo upload failed, saving without photo:", upErr);
          photoFailed = true; photo_url = null; photo_path = null;
        }
      }

      const { error } = await sb.from("receipts").insert({
        partner, amount, category, receipt_date: date,
        note: note || null, photo_url, photo_path,
      });
      if (error) throw error;

      closeModal();
      await reloadQuiet();
      if (photoFailed) alert("تم حفظ الإيصال، لكن تعذّر رفع الصورة (لم يتم إعداد التخزين بعد). ستُرفع الصور بعد إنشاء مخزّن receipts.");
    } catch (err) {
      console.error(err);
      errBox.textContent = "تعذّر الحفظ: " + (err.message || err);
      errBox.classList.remove("hidden");
    } finally {
      btn.disabled = false;
      btn.textContent = "حفظ";
    }
  };

  // ---------- Lightbox ----------
  function openLightbox(url) {
    $("#lightbox-img").src = url;
    $("#lightbox").classList.remove("hidden");
  }
  document.querySelectorAll("[data-lb-close]").forEach((b) => (b.onclick = () => $("#lightbox").classList.add("hidden")));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { closeModal(); $("#lightbox").classList.add("hidden"); }
  });

  // ---------- Dashboard ----------
  $("#dash-btn").onclick = openDashboard;
  $("#dash-close").onclick = () => $("#dashboard").classList.add("hidden");

  function openDashboard() {
    renderDashboard();
    $("#dashboard").classList.remove("hidden");
    $("#dashboard").scrollTop = 0;
  }

  function svgEl(v) { return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }

  function donutSVG(segments, centerTop) {
    const total = segments.reduce((s, x) => s + x.value, 0) || 1;
    const r = 62, C = 2 * Math.PI * r, cx = 85, cy = 85, sw = 32;
    let acc = 0, arcs = "";
    segments.forEach((seg) => {
      const f = seg.value / total;
      arcs +=
        `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${seg.color}" ` +
        `stroke-width="${sw}" stroke-dasharray="${f * C} ${C}" ` +
        `stroke-dashoffset="${-acc * C}" transform="rotate(-90 ${cx} ${cy})" />`;
      acc += f;
    });
    return (
      `<svg class="donut" viewBox="0 0 170 170" role="img">` +
      `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--surface-2)" stroke-width="${sw}" />` +
      arcs +
      `<text x="${cx}" y="${cy - 2}" text-anchor="middle" class="donut-center" ` +
      `fill="var(--text)" font-size="23" font-weight="800">${svgEl(centerTop)}</text>` +
      `<g transform="translate(${cx - 15} ${cy + 6}) scale(0.0457)">` +
      `<path d="${RIAL_PATH}" fill="var(--muted)"/></g>` +
      `</svg>`
    );
  }

  function renderDashboard() {
    const body = $("#dash-body");
    const rows = receipts;

    if (!rows.length) {
      body.innerHTML =
        (DEMO_MODE ? "" : "") +
        `<div class="dash-empty">🧾 لا توجد بيانات بعد.<br>أضف إيصالات لعرض الرسوم البيانية.</div>`;
      return;
    }

    // ---- aggregates ----
    const total = rows.reduce((s, r) => s + Number(r.amount), 0);
    const count = rows.length;
    const avg = total / count;

    const perPartner = PARTNERS.map((p) => ({
      id: p.id, name: p.name,
      sum: rows.filter((r) => r.partner === p.id).reduce((s, r) => s + Number(r.amount), 0),
    }));

    const catMap = {};
    rows.forEach((r) => { catMap[r.category] = (catMap[r.category] || 0) + Number(r.amount); });
    const perCategory = Object.keys(catMap)
      .map((id) => ({ id, name: categoryName(id), sum: catMap[id] }))
      .sort((a, b) => b.sum - a.sum);

    const monMap = {};
    rows.forEach((r) => {
      const m = (r.receipt_date || "").slice(0, 7);
      if (m) monMap[m] = (monMap[m] || 0) + Number(r.amount);
    });
    const perMonth = Object.keys(monMap).sort().map((m) => ({ m, sum: monMap[m] }));

    const money = (n) => moneyHTML(n);

    // ---- balance ----
    const p0 = perPartner[0], p1 = perPartner[1] || { name: "", sum: 0 };
    const diff = Math.abs(p0.sum - p1.sum);
    const moreName = p0.sum >= p1.sum ? p0.name : p1.name;
    const w0 = total ? (p0.sum / total) * 100 : 50;
    const w1 = 100 - w0;

    // ---- category colors ----
    perCategory.forEach((c, i) => (c.color = PALETTE[i % PALETTE.length]));
    const partnerColors = PARTNERS.map((p) => partnerColor(p.id));

    let html = "";

    if (DEMO_MODE) {
      html += `<div class="demo-badge">⚠️ وضع العرض التجريبي — الأرقام هنا وهمية للتوضيح فقط.</div>`;
    }

    // stat cards
    html +=
      `<div class="dash-grid3">` +
      `<div class="dcard dstat"><div class="dlabel">الإجمالي الكلي</div><div class="dval">${money(total)}</div></div>` +
      `<div class="dcard dstat"><div class="dlabel">عدد الإيصالات</div><div class="dval">${count}</div></div>` +
      `<div class="dcard dstat"><div class="dlabel">متوسط الإيصال</div><div class="dval">${money(Math.round(avg))}</div></div>` +
      `</div>`;

    // balance
    html +=
      `<div class="dcard"><h3>التوازن بين الشريكين</h3>` +
      `<div class="balance-bar">` +
      `<span style="width:${w0}%;background:${partnerColors[0]}">${Math.round(w0)}%</span>` +
      `<span style="width:${w1}%;background:${partnerColors[1]}">${Math.round(w1)}%</span>` +
      `</div>` +
      `<div class="balance-note">` +
      (diff === 0
        ? "الشريكان متساويان في المصروفات ✅"
        : `<span class="up">${svgEl(moreName)}</span> دفع أكثر بمقدار <b class="money">${moneyInner(diff)}</b>`) +
      `</div></div>`;

    // per partner bars
    const maxP = Math.max(...perPartner.map((p) => p.sum), 1);
    html += `<div class="dcard"><h3>المصروفات حسب الشريك</h3>`;
    perPartner.forEach((p, i) => {
      html +=
        `<div class="hbar-row">` +
        `<div class="hbar-name">${svgEl(p.name)}</div>` +
        `<div class="hbar-track"><div class="hbar-fill" style="width:${(p.sum / maxP) * 100}%;background:${partnerColors[i % 2]}"></div></div>` +
        `<div class="hbar-val">${money(p.sum)}</div>` +
        `</div>`;
    });
    html += `</div>`;

    // category donut + legend
    html += `<div class="dcard"><h3>المصروفات حسب الفئة</h3><div class="donut-wrap">`;
    html += donutSVG(
      perCategory.map((c) => ({ value: c.sum, color: c.color })),
      fmtMoney(total)
    );
    html += `<div class="legend">`;
    perCategory.forEach((c) => {
      const pct = total ? Math.round((c.sum / total) * 100) : 0;
      html +=
        `<div class="legend-row">` +
        `<span class="legend-dot" style="background:${c.color}"></span>` +
        `<span class="legend-name">${svgEl(c.name)}</span>` +
        `<span class="legend-val">${money(c.sum)}</span>` +
        `<span class="legend-pct">${pct}%</span>` +
        `</div>`;
    });
    html += `</div></div></div>`;

    // monthly bars
    if (perMonth.length) {
      const maxM = Math.max(...perMonth.map((x) => x.sum), 1);
      html += `<div class="dcard"><h3>المصروفات عبر الأشهر</h3><div class="mbars">`;
      perMonth.forEach((x) => {
        const [y, mo] = x.m.split("-");
        html +=
          `<div class="mbar" title="${x.m}">` +
          `<div class="mbar-val">${fmtMoney(x.sum)}</div>` +
          `<div class="mbar-fill" style="height:${(x.sum / maxM) * 100}%"></div>` +
          `<div class="mbar-label">${Number(mo)}/${y}</div>` +
          `</div>`;
      });
      html += `</div></div>`;
    }

    body.innerHTML = html;
  }

  // ---------- Boot ----------
  if (DEMO_MODE) {
    if (!currentUser || !PARTNERS.some((p) => p.id === currentUser)) currentUser = PARTNERS[0].id;
    $("#setup-banner").classList.add("hidden");
    showApp();
  } else if (currentUser && PARTNERS.some((p) => p.id === currentUser)) {
    showApp();
  } else {
    showWho();
  }
})();
