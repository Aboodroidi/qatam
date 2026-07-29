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
  const categoryName = (id) => (CATEGORIES.find((c) => c.id === id) || {}).name || id;

  const nf = new Intl.NumberFormat("ar-EG", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const fmtMoney = (n) => nf.format(Number(n) || 0);

  function fmtDate(iso) {
    if (!iso) return "";
    const d = new Date(iso + "T00:00:00");
    if (isNaN(d)) return iso;
    return new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "long", year: "numeric" }).format(d);
  }
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
  let currentUser = localStorage.getItem("qatam_user") || null;
  let receipts = [];
  let filterPartner = "all";
  let filterCategory = "all";

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
      b.textContent = p.name;
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
    pill.textContent = "👤 " + partnerName(currentUser);
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
    CATEGORIES.forEach((c) => {
      const o = el("option");
      o.value = c.id; o.textContent = c.name;
      cs.appendChild(o);
    });
  }

  // ---------- Filters ----------
  function buildFilters() {
    const pf = $("#filter-partner");
    pf.innerHTML = "";
    const partnerOpts = [{ id: "all", name: "الكل" }, ...PARTNERS];
    partnerOpts.forEach((p) => {
      const chip = el("button", "chip" + (filterPartner === p.id ? " active" : ""));
      chip.textContent = p.name;
      chip.onclick = () => { filterPartner = p.id; buildFilters(); renderList(); };
      pf.appendChild(chip);
    });

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
      wrap.appendChild(totalCard(p.name, totals[p.id].sum, totals[p.id].count, false));
    });
    wrap.appendChild(totalCard("الإجمالي الكلي", grand, grandCount, true));
  }
  function totalCard(label, value, count, grand) {
    const c = el("div", "total-card" + (grand ? " grand" : ""));
    const l = el("div", "tc-label"); l.textContent = label;
    const v = el("div", "tc-value");
    v.textContent = fmtMoney(value);
    const cur = el("span", "tc-cur"); cur.textContent = CURRENCY; v.appendChild(cur);
    const cnt = el("div", "tc-count"); cnt.textContent = count + " إيصال";
    c.append(l, v, cnt);
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

    if (r.photo_url) {
      const img = el("img", "receipt-thumb");
      img.src = r.photo_url; img.alt = "إيصال"; img.loading = "lazy";
      img.onclick = () => openLightbox(r.photo_url);
      row.appendChild(img);
    } else {
      const ph = el("div", "receipt-thumb placeholder");
      ph.textContent = "🧾";
      row.appendChild(ph);
    }

    const main = el("div", "receipt-main");
    const top = el("div", "receipt-top");
    const amt = el("div", "receipt-amount");
    amt.textContent = fmtMoney(r.amount);
    const cur = el("span", "cur"); cur.textContent = CURRENCY; amt.appendChild(cur);
    const cat = el("span", "receipt-cat"); cat.textContent = categoryName(r.category);
    top.append(amt, cat);

    const meta = el("div", "receipt-meta");
    const who = el("span"); who.textContent = "👤 " + partnerName(r.partner);
    const dt = el("span"); dt.textContent = "📅 " + fmtDate(r.receipt_date);
    meta.append(who, dt);

    main.append(top, meta);
    if (r.note) { const note = el("div", "receipt-note"); note.textContent = r.note; main.appendChild(note); }

    const del = el("button", "receipt-del");
    del.textContent = "🗑";
    del.title = "حذف";
    del.onclick = () => deleteReceipt(r);

    row.append(main, del);
    return row;
  }

  // ---------- Data ----------
  async function loadReceipts() {
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
    $("#f-date").value = todayISO();
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
      let photo_url = null, photo_path = null;
      if (file) {
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
        const rand = Math.random().toString(36).slice(2, 8);
        photo_path = `${date}_${partner}_${rand}.${ext}`;
        const up = await sb.storage.from(BUCKET).upload(photo_path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || "image/jpeg",
        });
        if (up.error) throw up.error;
        const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(photo_path);
        photo_url = pub.publicUrl;
      }

      const { error } = await sb.from("receipts").insert({
        partner, amount, category, receipt_date: date,
        note: note || null, photo_url, photo_path,
      });
      if (error) throw error;

      closeModal();
      await reloadQuiet();
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

  // ---------- Boot ----------
  if (currentUser && PARTNERS.some((p) => p.id === currentUser)) {
    showApp();
  } else {
    showWho();
  }
})();
