(function () {
  "use strict";
  var KEY = "sovieccuoi.v1";
  var $ = function (s) { return document.querySelector(s); };
  var jobs = [], tab = "up", query = "", editingId = null, delArmed = false, delTimer = null, storageOk = true;
  var startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);

  /* ---------- Lưu trữ ---------- */
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      var arr = raw ? JSON.parse(raw) : [];
      jobs = Array.isArray(arr) ? arr.filter(function (x) { return x && typeof x === "object" && x.id; }) : [];
    } catch (e) { jobs = []; storageOk = false; }
  }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(jobs)); return true; }
    catch (e) { storageOk = false; showNote(); return false; }
  }
  function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  /* ---------- Tiện ích ---------- */
  function digits(s) { return parseInt(String(s || "").replace(/\D/g, ""), 10) || 0; }
  function money(n) { return new Intl.NumberFormat("vi-VN").format(n || 0) + " ₫"; }
  function grouped(n) { return n ? new Intl.NumberFormat("vi-VN").format(n) : ""; }
  function parseWhen(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(s || "");
    return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : null;
  }
  var DAYS = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];
  function fmtWhen(s) {
    var d = parseWhen(s); if (!d) return "Chưa có ngày giờ";
    var p = function (x) { return String(x).padStart(2, "0"); };
    return DAYS[d.getDay()] + ", " + p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear() + " · " + p(d.getHours()) + ":" + p(d.getMinutes());
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function noAccent(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase(); }
  function isUpcoming(j) { var d = parseWhen(j.when); return !d || d >= startOfToday; }
  function remaining(j) { return Math.max(0, (j.price || 0) - (j.deposit || 0)); }
  function showNote() {
    var n = $("#note");
    n.textContent = storageOk ? "" : "Điện thoại đang chặn lưu dữ liệu (có thể do chế độ riêng tư). Hãy mở ứng dụng từ biểu tượng trên màn hình chính.";
    n.hidden = storageOk;
  }

  /* ---------- Hiển thị ---------- */
  function row(label, node, cls) {
    var r = el("div", "row" + (cls ? " " + cls : ""));
    r.appendChild(el("dt", null, label));
    var dd = el("dd"); dd.appendChild(node); r.appendChild(dd);
    return r;
  }
  function span(t, cls) { return el("span", cls, t); }

  function copyText(text, btn, node) {
    var done = function () { var o = btn.textContent; btn.textContent = "Đã chép"; setTimeout(function () { btn.textContent = o; }, 1400); };
    var fallback = function () {
      try { var r = document.createRange(); r.selectNodeContents(node); var s = getSelection(); s.removeAllRanges(); s.addRange(r); } catch (e) {}
    };
    try { navigator.clipboard.writeText(text).then(done, fallback); } catch (e) { fallback(); }
  }

  function card(j) {
    var left = remaining(j), c = el("article", "card");
    var head = el("div", "card-head"), top = el("div", "card-top");
    top.appendChild(el("h3", "name", j.name || "Chưa đặt tên"));
    top.appendChild(el("span", "pill " + (left > 0 ? "owed" : "paid"), left > 0 ? "Còn nợ" : "Đã đủ"));
    head.appendChild(top);
    head.appendChild(el("div", "when", fmtWhen(j.when)));
    c.appendChild(head);

    var dl = el("dl", "rows"), ph = el("div", "phone-line");
    if (j.phone) {
      var ps = span(j.phone, "num"); ph.appendChild(ps);
      var call = el("a", "btn small", "Gọi"); call.href = "tel:" + j.phone.replace(/[^\d+]/g, ""); ph.appendChild(call);
      var cb = el("button", "btn small", "Chép số"); cb.type = "button";
      cb.addEventListener("click", function () { copyText(j.phone, cb, ps); });
      ph.appendChild(cb);
    } else ph.appendChild(span("Chưa có", "dim"));
    dl.appendChild(row("Điện thoại", ph));
    dl.appendChild(row("Gói chụp", span(j.pkg || "Chưa ghi", j.pkg ? "" : "dim")));
    dl.appendChild(row("Giá gói", span(money(j.price), "num")));
    dl.appendChild(row("Đã cọc", span(money(j.deposit), "num")));
    dl.appendChild(row("Còn lại", span(money(left), "num"), "remain " + (left > 0 ? "owed" : "paid")));

    var parts = String(j.ekip || "").split(/[,\n]/).map(function (x) { return x.trim(); }).filter(Boolean);
    var ch = el("div", "chips");
    if (parts.length) parts.forEach(function (p) { ch.appendChild(el("span", "chip", p)); });
    else ch.appendChild(span("Chưa ghi", "dim"));
    dl.appendChild(row("Ekip", ch));
    dl.appendChild(row("Yêu cầu riêng", span(j.notes || "Không có", "notes" + (j.notes ? "" : " dim"))));
    c.appendChild(dl);

    var foot = el("div", "card-foot"), eb = el("button", "btn", "Sửa"); eb.type = "button";
    eb.addEventListener("click", function () { openSheet(j); });
    foot.appendChild(eb); c.appendChild(foot);
    return c;
  }

  function byWhen(a, b) {
    var da = parseWhen(a.when), db = parseWhen(b.when);
    return (da ? da.getTime() : Infinity) - (db ? db.getTime() : Infinity);
  }

  function render() {
    var up = jobs.filter(isUpcoming).sort(byWhen);
    var past = jobs.filter(function (j) { return !isUpcoming(j); }).sort(function (a, b) { return byWhen(b, a); });
    $("#tOwed").textContent = money(jobs.reduce(function (s, j) { return s + remaining(j); }, 0));
    $("#tCount").textContent = String(up.length);
    $("#tabUp").textContent = "Sắp tới (" + up.length + ")";
    $("#tabPast").textContent = "Đã qua (" + past.length + ")";
    $("#tabUp").setAttribute("aria-selected", String(tab === "up"));
    $("#tabPast").setAttribute("aria-selected", String(tab === "past"));

    var shown = tab === "up" ? up : past, q = noAccent(query.trim());
    if (q) shown = shown.filter(function (j) { return noAccent(j.name).indexOf(q) > -1 || String(j.phone || "").replace(/\s/g, "").indexOf(q.replace(/\s/g, "")) > -1; });

    var list = $("#list"); list.textContent = "";
    if (!shown.length) {
      var e = el("div", "empty");
      if (q) {
        e.appendChild(el("strong", null, "Không tìm thấy khách phù hợp"));
        e.appendChild(el("span", null, "Thử gõ tên hoặc số điện thoại khác."));
      } else {
        e.appendChild(el("strong", null, tab === "up" ? "Chưa có lịch chụp sắp tới" : "Chưa có lịch đã qua"));
        e.appendChild(el("span", null, tab === "up" ? "Bấm “Thêm lịch chụp” để ghi khách đầu tiên." : "Lịch chụp đã qua ngày sẽ nằm ở đây."));
      }
      list.appendChild(e);
    } else shown.forEach(function (j) { list.appendChild(card(j)); });
  }

  /* ---------- Form thêm/sửa ---------- */
  function updateRemain() { $("#fRemain").textContent = money(Math.max(0, digits($("#fPrice").value) - digits($("#fDeposit").value))); }
  ["#fPrice", "#fDeposit"].forEach(function (s) {
    $(s).addEventListener("input", function (e) { var n = digits(e.target.value); e.target.value = n ? grouped(n) : ""; updateRemain(); });
  });

  function openSheet(j) {
    editingId = j ? j.id : null; delArmed = false;
    $("#sheetTitle").textContent = j ? "Sửa lịch chụp" : "Thêm lịch chụp";
    $("#fName").value = j ? (j.name || "") : "";
    $("#fPhone").value = j ? (j.phone || "") : "";
    $("#fWhen").value = j ? (j.when || "") : "";
    $("#fPkg").value = j ? (j.pkg || "") : "";
    $("#fPrice").value = j ? grouped(j.price) : "";
    $("#fDeposit").value = j ? grouped(j.deposit) : "";
    $("#fEkip").value = j ? (j.ekip || "") : "";
    $("#fNotes").value = j ? (j.notes || "") : "";
    $("#err").textContent = "";
    $("#delBtn").hidden = !j; $("#delBtn").textContent = "Xóa lịch này";
    updateRemain();
    $("#scrim").hidden = false;
  }
  function closeSheet() { $("#scrim").hidden = true; clearTimeout(delTimer); }

  $("#addBtn").addEventListener("click", function () { openSheet(null); });
  $("#cancelBtn").addEventListener("click", closeSheet);
  $("#scrim").addEventListener("click", function (e) { if (e.target === $("#scrim")) closeSheet(); });
  $("#tabUp").addEventListener("click", function () { tab = "up"; render(); });
  $("#tabPast").addEventListener("click", function () { tab = "past"; render(); });
  $("#q").addEventListener("input", function (e) { query = e.target.value; render(); });

  $("#f").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var name = $("#fName").value.trim();
    if (!name) { $("#err").textContent = "Nhập tên khách hàng trước khi lưu."; $("#fName").focus(); return; }
    var data = {
      name: name, phone: $("#fPhone").value.trim(), when: $("#fWhen").value, pkg: $("#fPkg").value.trim(),
      price: digits($("#fPrice").value), deposit: digits($("#fDeposit").value),
      ekip: $("#fEkip").value.trim(), notes: $("#fNotes").value.trim()
    };
    var before = jobs.slice();
    if (editingId) {
      jobs = jobs.map(function (j) { return j.id === editingId ? Object.assign({}, j, data) : j; });
    } else {
      data.id = newId(); data.createdAt = Date.now(); jobs.push(data);
    }
    if (!persist()) { jobs = before; $("#err").textContent = "Chưa lưu được. Điện thoại đang chặn lưu dữ liệu hoặc bộ nhớ đã đầy."; return; }
    closeSheet(); render();
  });

  $("#delBtn").addEventListener("click", function () {
    if (!editingId) return;
    if (!delArmed) {
      delArmed = true; $("#delBtn").textContent = "Bấm lần nữa để xóa hẳn";
      delTimer = setTimeout(function () { delArmed = false; $("#delBtn").textContent = "Xóa lịch này"; }, 4000);
      return;
    }
    var before = jobs.slice();
    jobs = jobs.filter(function (j) { return j.id !== editingId; });
    if (!persist()) { jobs = before; $("#err").textContent = "Chưa xóa được. Thử lại sau."; return; }
    closeSheet(); render();
  });

  /* ---------- Sao lưu / khôi phục ---------- */
  $("#backupBtn").addEventListener("click", function () {
    $("#bText").value = JSON.stringify({ app: "so-viec-cuoi", version: 1, exportedAt: new Date().toISOString(), jobs: jobs }, null, 1);
    $("#bErr").textContent = "";
    $("#bscrim").hidden = false;
  });
  $("#bClose").addEventListener("click", function () { $("#bscrim").hidden = true; });
  $("#bscrim").addEventListener("click", function (e) { if (e.target === $("#bscrim")) $("#bscrim").hidden = true; });
  $("#bCopy").addEventListener("click", function () {
    var t = $("#bText"), btn = $("#bCopy");
    var done = function () { btn.textContent = "Đã chép"; setTimeout(function () { btn.textContent = "Chép dữ liệu"; }, 1400); };
    var fb = function () { t.focus(); t.select(); t.setSelectionRange(0, t.value.length); };
    try { navigator.clipboard.writeText(t.value).then(done, fb); } catch (e) { fb(); }
  });
  $("#bRestore").addEventListener("click", function () {
    var err = $("#bErr"); err.textContent = "";
    var parsed;
    try { parsed = JSON.parse($("#bText").value); } catch (e) { err.textContent = "Dữ liệu dán vào chưa đúng định dạng."; return; }
    var arr = Array.isArray(parsed) ? parsed : (parsed && parsed.jobs);
    if (!Array.isArray(arr)) { err.textContent = "Không tìm thấy danh sách lịch chụp trong dữ liệu này."; return; }
    var clean = arr.filter(function (x) { return x && typeof x === "object"; }).map(function (x) {
      return {
        id: x.id ? String(x.id) : newId(), name: String(x.name || ""), phone: String(x.phone || ""), when: String(x.when || ""),
        pkg: String(x.pkg || ""), price: Number(x.price) || 0, deposit: Number(x.deposit) || 0,
        ekip: String(x.ekip || ""), notes: String(x.notes || ""), createdAt: Number(x.createdAt) || Date.now()
      };
    });
    var byId = {}; jobs.forEach(function (j) { byId[j.id] = j; });
    clean.forEach(function (j) { byId[j.id] = j; });
    var before = jobs.slice();
    jobs = Object.keys(byId).map(function (k) { return byId[k]; });
    if (!persist()) { jobs = before; err.textContent = "Chưa lưu được dữ liệu khôi phục."; return; }
    render();
    $("#bscrim").hidden = true;
  });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (!$("#bscrim").hidden) $("#bscrim").hidden = true; else if (!$("#scrim").hidden) closeSheet();
  });

  /* ---------- Khởi động ---------- */
  load();
  showNote();
  render();
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
  }
})();
