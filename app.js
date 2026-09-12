let dir = "long";
let feeMode = "maker";
const TAKER = 0.05, MAKER = 0.02;

function $(id) { return document.getElementById(id); }
function n(id) { const v = parseFloat($(id).value); return isFinite(v) ? v : 0; }
function fmt(x) {
  if (!isFinite(x)) return "-";
  return (Math.round(x * 100) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtPx(x) {
  if (!isFinite(x) || x <= 0) return "-";
  if (x >= 1000) return x.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (x >= 1) return x.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 6 });
  return x.toLocaleString("en-US", { minimumFractionDigits: 6, maximumFractionDigits: 8 });
}
function signed(x) {
  if (!isFinite(x)) return "-";
  return (x > 0 ? "+" : "") + fmt(x);
}
function setDir(d, skipCalc) {
  dir = d;
  $("btnLong").className = d === "long" ? "active-long" : "";
  $("btnShort").className = d === "short" ? "active-short" : "";
  $("extLabel").textContent = d === "long" ? "当前价 / 高点" : "当前价 / 低点";
  $("title").textContent = d === "long" ? "对比高峰，大约少赚" : "对比低点，大约少赚";
  $("beTitle").textContent = d === "long" ? "做多保本激活价" : "做空保本激活价";
  $("exeTitle").textContent = d === "long" ? "从最高价回调后的执行价" : "从最低价反弹后的执行价";
  $("actGuide").textContent = d === "long"
    ? "不填激活价时，用当前价当高点做回调。请先点「拉最新价」。拉到的是最新价，高点请自己改。"
    : "不填激活价时，用当前价当低点做反弹。请先点「拉最新价」。拉到的是最新价，低点请自己改。";
  $("tLostLab").textContent = d === "long" ? "对比高点少赚" : "对比低点少赚";
  if (!skipCalc) calc();
}
function setFeeMode(mode) {
  feeMode = mode;
  $("feeA").className = mode === "maker" ? "active" : "";
  $("feeB").className = mode === "taker" ? "active" : "";
  $("feeC").className = mode === "custom" ? "active" : "";
  $("customFee").className = "row2" + (mode === "custom" ? "" : " hidden");
  if (mode === "maker") { $("feeOpen").value = MAKER; $("feeClose").value = TAKER; }
  if (mode === "taker") { $("feeOpen").value = TAKER; $("feeClose").value = TAKER; }
  syncFee();
}
function syncFee() {
  const open = n("feeOpen"), close = n("feeClose");
  $("fee").value = String(Math.round((open + close) * 10000) / 10000);
  $("feeCloseShow").value = close;
  calc();
}
function onFeeManual() {
  feeMode = "custom";
  $("feeA").className = ""; $("feeB").className = ""; $("feeC").className = "active";
  $("customFee").className = "row2";
  const total = n("fee"), close = n("feeCloseShow");
  const open = Math.max(0, Math.round((total - close) * 10000) / 10000);
  $("feeOpen").value = String(open);
  $("feeClose").value = String(close);
  calc();
}
function onCloseFee() {
  feeMode = "custom";
  $("feeA").className = ""; $("feeB").className = ""; $("feeC").className = "active";
  $("customFee").className = "row2";
  $("feeClose").value = $("feeCloseShow").value;
  $("fee").value = String(Math.round((n("feeOpen") + n("feeCloseShow")) * 10000) / 10000);
  calc();
}
function normSym(raw) {
  let s = (raw || "").trim().toUpperCase().replace(/[-\/]/g, "");
  if (!s) return "";
  if (s.endsWith("PERP")) s = s.slice(0, -4);
  if (s.endsWith("USD") && !s.endsWith("USDT")) s += "T";
  if (!s.endsWith("USDT")) s += "USDT";
  return s;
}
function gateContract(sym) {
  return sym.endsWith("USDT") ? sym.slice(0, -4) + "_USDT" : sym;
}
async function fetchJson(url, timeout) {
  timeout = timeout || 4500;
  const ctrl = new AbortController();
  const t = setTimeout(function() { ctrl.abort(); }, timeout);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error("http");
    return await res.json();
  } finally { clearTimeout(t); }
}
async function fetchPx() {
  const sym = normSym($("symbol").value);
  const msg = $("pxMsg");
  if (!sym) { msg.textContent = "先输入币种，比如 USELESS 或 BTC"; msg.className = "hint bad"; return; }
  $("symbol").value = sym.endsWith("USDT") ? sym.slice(0, -4) : sym;
  msg.textContent = "正在拉 " + sym + " 最新价…";
  msg.className = "hint";
  $("src").value = "查询中";
  const tries = [
    async function() {
      const j = await fetchJson("https://fapi.binance.com/fapi/v1/premiumIndex?symbol=" + sym);
      const px = parseFloat(j.markPrice);
      if (!px) throw new Error("no");
      return { px: px, src: "币安合约标记价" };
    },
    async function() {
      const j = await fetchJson("https://fapi.binance.com/fapi/v1/ticker/price?symbol=" + sym);
      const px = parseFloat(j.price);
      if (!px) throw new Error("no");
      return { px: px, src: "币安合约最新价" };
    },
    async function() {
      const j = await fetchJson("https://api.binance.com/api/v3/ticker/price?symbol=" + sym);
      const px = parseFloat(j.price);
      if (!px) throw new Error("no");
      return { px: px, src: "币安现货价" };
    },
    async function() {
      const j = await fetchJson("https://api.gateio.ws/api/v4/futures/usdt/tickers?contract=" + gateContract(sym));
      const row = Array.isArray(j) ? j[0] : j;
      const px = parseFloat(row && (row.mark_price || row.last));
      if (!px) throw new Error("no");
      return { px: px, src: "Gate 合约标记价", last: parseFloat(row.last) };
    },
    async function() {
      const j = await fetchJson("https://api.bybit.com/v5/market/tickers?category=linear&symbol=" + sym);
      const row = j.result && j.result.list && j.result.list[0];
      const px = parseFloat(row && (row.markPrice || row.lastPrice));
      if (!px) throw new Error("no");
      return { px: px, src: "Bybit 合约标记价" };
    },
    async function() {
      const j = await fetchJson("https://www.okx.com/api/v5/market/ticker?instId=" + sym.replace("USDT", "-USDT-SWAP"));
      const row = j.data && j.data[0];
      const px = parseFloat(row && row.last);
      if (!px) throw new Error("no");
      return { px: px, src: "OKX 合约最新价" };
    },
    async function() {
      const j = await fetchJson("https://contract.mexc.com/api/v1/contract/ticker?symbol=" + sym.replace("USDT", "_USDT"));
      const px = parseFloat(j.data && (j.data.fairPrice || j.data.lastPrice));
      if (!px) throw new Error("no");
      return { px: px, src: "MEXC 合约标记价" };
    }
  ];
  for (let i = 0; i < tries.length; i++) {
    try {
      const r = await tries[i]();
      $("extreme").value = String(r.px);
      $("src").value = r.src;
      msg.className = "hint ok";
      msg.textContent = r.src + " = " + fmtPx(r.px) + (r.last ? "（最新 " + fmtPx(r.last) + "）" : "") + "，已写入当前价";
      calc();
      return;
    } catch (e) {}
  }
  $("src").value = "失败";
  msg.className = "hint bad";
  msg.textContent = "拉价失败。可能是跨域限制或该币没有合约，请手动填当前价。";
}
function calc() {
  const m = n("margin"), L = n("lev"), rPct = n("cb"), feePct = n("fee"), closePct = n("feeCloseShow");
  const e = n("entry"), x = n("extreme"), actIn = n("actIn");
  const r = rPct / 100, fee = feePct / 100, closeFee = closePct / 100;
  const extreme = actIn > 0
    ? (dir === "long" ? Math.max(x, actIn) : (x > 0 ? Math.min(x, actIn) : actIn))
    : x;
  const missing = [];
  if (!(m > 0)) missing.push("保证金");
  if (!(L > 0)) missing.push("杠杆");
  if (!(rPct > 0)) missing.push("回调%");
  if (!(e > 0)) missing.push("开仓价");
  if (!(x > 0) && !(actIn > 0)) missing.push("当前价或激活价");
  const simple = m * L * rPct / 100;
  const ratio = e > 0 ? extreme / e : 0;
  const exact = simple * ratio;
  const pct = m > 0 ? exact / m * 100 : 0;
  $("main").textContent = missing.length ? "请先填齐" : fmt(exact) + " U";
  $("main").className = "big " + (dir === "long" ? "long" : "short");
  $("simple").textContent = fmt(simple) + " U";
  $("ratio").textContent = ratio.toFixed(4) + "x";
  $("pct").textContent = fmt(pct) + "%";
  $("roe").textContent = missing.length ? ("缺：" + missing.join("、")) : ("约等于保证金的 " + fmt(pct) + "%");
  $("explain").textContent = dir === "long"
    ? (ratio > 1 ? "做多已上涨，同样回调%会吐回更多。" : "刚开或小幅波动时，精确值和快速估算接近。")
    : (ratio < 1 && ratio > 0 ? "做空已下跌，同样回调%吐回更少。" : "刚开或小幅波动时，精确值和快速估算接近。");
  let act = NaN, exit = NaN, need = NaN;
  if (e > 0 && r > 0 && r < 1) {
    if (dir === "long") {
      const beExit = e * (1 + fee);
      act = beExit / (1 - r);
      exit = act * (1 - r);
      need = (act / e - 1) * 100;
    } else {
      const beExit = e * (1 - fee);
      act = beExit / (1 + r);
      exit = act * (1 + r);
      need = (1 - act / e) * 100;
    }
  }
  $("bePrice").textContent = fmtPx(act);
  $("beExit").textContent = fmtPx(exit);
  $("beNeed").textContent = isFinite(need) ? fmt(need) + "%" : "-";
  $("beMove").textContent = isFinite(need)
    ? (dir === "long" ? "价格先涨到这个价，立刻回调也能覆盖开平手续费" : "价格先跌到这个价，立刻反弹也能覆盖开平手续费")
    : "请填写有效开仓价和回调%";
  if (actIn > 0 && isFinite(act)) {
    const ok = dir === "long" ? actIn >= act : actIn <= act;
    $("actCmp").textContent = fmtPx(actIn) + (ok ? "  ≥保本" : "  未到保本");
    $("actCmp").style.color = ok ? "#3dd68c" : "#ff6b7a";
  } else {
    $("actCmp").textContent = actIn > 0 ? fmtPx(actIn) : "未填";
    $("actCmp").style.color = "";
  }
  $("beExplain").textContent = dir === "long"
    ? "激活价 = 开仓价 × (1+往返手续费) ÷ (1-回调%)"
    : "激活价 = 开仓价 × (1-往返手续费) ÷ (1+回调%)";
  const base = actIn > 0 ? actIn : extreme;
  let exe = NaN;
  if (base > 0 && r >= 0 && r < 1) exe = dir === "long" ? base * (1 - r) : base * (1 + r);
  $("exePrice").textContent = fmtPx(exe);
  if (isFinite(exe) && e > 0) {
    const pnl = dir === "long" ? m * L * (exe - e) / e : m * L * (e - exe) / e;
    const feeU = m * L * (exe / e) * closeFee;
    $("exeVsEntry").textContent = signed((exe / e - 1) * 100) + "%";
    $("exePnl").textContent = signed(pnl) + " U";
    $("exePnlNet").textContent = signed(pnl - feeU) + " U";
    $("exeMove").textContent = (actIn > 0 ? ("从激活价 " + fmtPx(actIn)) : ((dir === "long" ? "从最高价 " : "从最低价 ") + fmtPx(base)))
      + (dir === "long" ? " 回撤 " : " 反弹 ") + rPct + "% 后触发";
  } else {
    $("exeVsEntry").textContent = "-";
    $("exePnl").textContent = "-";
    $("exePnlNet").textContent = "-";
    $("exeMove").textContent = "请填写当前价/激活价和回调%";
  }
  $("exeExplain").textContent = (dir === "long"
    ? "执行价 = 高点 × (1-回调%)。市价成交可能比这个价稍差。"
    : "执行价 = 低点 × (1+回调%)。市价成交可能比这个价稍差。")
    + " 平仓费按执行价名义价值估算。";
  $("tSym").textContent = (($("symbol").value || "-") + " / " + (dir === "long" ? "做多" : "做空"));
  $("tLev").textContent = L + "x / " + fmt(m) + " U";
  $("tEntry").textContent = fmtPx(e);
  $("tNow").textContent = fmtPx(x);
  $("tAct").textContent = actIn > 0 ? fmtPx(actIn) : "未填，按当前价";
  $("tCb").textContent = rPct + "%";
  $("tExe").textContent = fmtPx(exe);
  $("tBe").textContent = fmtPx(act);
  if (actIn > 0 && isFinite(act)) {
    const ok = dir === "long" ? actIn >= act : actIn <= act;
    $("tOk").textContent = dir === "long"
      ? (ok ? "是，激活价 ≥ 保本线" : "否，激活价低于保本线")
      : (ok ? "是，激活价 ≤ 保本线" : "否，激活价高于保本线");
    $("tOk").style.color = ok ? "#3dd68c" : "#ff6b7a";
  } else {
    $("tOk").textContent = "-";
    $("tOk").style.color = "";
  }
  $("tNet").textContent = (isFinite(exe) && e > 0) ? $("exePnlNet").textContent : "-";
  $("tLost").textContent = fmt(exact) + " U";
}
let shotFile = null;
function onShot(ev) {
  const f = ev.target.files && ev.target.files[0];
  if (!f) return;
  shotFile = f;
  const url = URL.createObjectURL(f);
  $("preview").innerHTML = '<img alt="shot" src="' + url + '">';
  $("ocrMsg").textContent = "已选图，点「识别并填表」";
  $("ocrMsg").className = "hint ok";
}
document.addEventListener("paste", function(e) {
  const items = e.clipboardData && e.clipboardData.items;
  if (!items) return;
  for (let i = 0; i < items.length; i++) {
    if (items[i].type.indexOf("image") === 0) {
      shotFile = items[i].getAsFile();
      const url = URL.createObjectURL(shotFile);
      $("preview").innerHTML = '<img alt="shot" src="' + url + '">';
      $("ocrMsg").textContent = "已粘贴截图，正在识别…";
      $("ocrMsg").className = "hint";
      runOcr();
      break;
    }
  }
});
function afterLabel(text, labels) {
  for (let i = 0; i < labels.length; i++) {
    const idx = text.indexOf(labels[i]);
    if (idx < 0) continue;
    const slice = text.slice(idx, idx + 80);
    const m = slice.match(/\d[\d,]*(?:\.\d+)?/);
    if (m) return parseFloat(m[0].replace(/,/g, ""));
  }
  return NaN;
}
function parsePos(text) {
  const raw = text.replace(/[|]/g, " ").replace(/\s+/g, " ");
  const up = raw.toUpperCase();
  const out = {};
  const sym = up.match(/\b([A-Z][A-Z0-9]{1,14})[\/_-]?USDT\b/);
  if (sym) out.symbol = sym[1];
  const lev = raw.match(/(\d+)\s*[xX倍]/) || raw.match(/杠杆\s*[:：]?\s*(\d+)/);
  if (lev) out.lev = parseFloat(lev[1]);
  const hasShort = /做空|空头|SHORT/.test(up) || /做空|空头/.test(raw);
  const hasLong = /做多|多头|LONG/.test(up) || /做多|多头/.test(raw);
  if (hasShort && !hasLong) out.dir = "short";
  else if (hasLong && !hasShort) out.dir = "long";
  out.entry = afterLabel(raw, ["开仓价格", "开仓均价", "开仓价", "Entry Price", "Entry"]);
  out.mark = afterLabel(raw, ["标记价格", "标记价", "最新价格", "最新价", "Mark Price", "Mark"]);
  out.margin = afterLabel(raw, ["保证金", "起始保证金", "Margin"]);
  out.be = afterLabel(raw, ["损益两平价", "盈亏平衡", "两平价", "Break"]);
  const prices = [];
  const usdtAmt = [];
  const re = /\d[\d,]*(?:\.\d+)?/g;
  let m;
  while ((m = re.exec(raw))) {
    const token = m[0];
    const v = parseFloat(token.replace(/,/g, ""));
    if (!isFinite(v) || v <= 0) continue;
    const dec = (token.split(".")[1] || "").length;
    const after = raw.slice(m.index, m.index + token.length + 8).toUpperCase();
    if (after.indexOf("USDT") >= 0) usdtAmt.push(v);
    if (dec >= 4 && v < 100000) prices.push(v);
  }
  if (!out.entry && prices[0]) out.entry = prices[0];
  if (!out.mark && prices.length >= 3) out.mark = prices[2];
  else if (!out.mark && prices[1]) out.mark = prices[1];
  if (!out.margin && usdtAmt.length) {
    const cands = usdtAmt.filter(function(v) { return v >= 1 && v < 100000; });
    out.margin = cands.length ? cands[cands.length - 1] : usdtAmt[usdtAmt.length - 1];
  }
  if (!out.dir && out.entry && out.mark) out.dir = out.mark >= out.entry ? "long" : "short";
  return out;
}
function prepShot(file) {
  return new Promise(function(resolve) {
    const img = new Image();
    img.onload = function() {
      try {
        const scale = Math.min(3, Math.max(2, 1400 / Math.max(img.width, 1)));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        const ctx = c.getContext("2d");
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(img, 0, 0, c.width, c.height);
        const id = ctx.getImageData(0, 0, c.width, c.height);
        const d = id.data;
        for (let i = 0; i < d.length; i += 4) {
          let g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          g = 255 - g;
          g = (g - 128) * 1.7 + 140;
          if (g < 40) g = 0;
          else if (g > 210) g = 255;
          d[i] = d[i + 1] = d[i + 2] = g;
        }
        ctx.putImageData(id, 0, 0);
        c.toBlob(function(b) { resolve(b || file); }, "image/png");
      } catch (e) { resolve(file); }
    };
    img.onerror = function() { resolve(file); };
    img.src = URL.createObjectURL(file);
  });
}
async function runOcr() {
  if (!shotFile) { $("ocrMsg").textContent = "先选一张持仓截图，或直接粘贴"; $("ocrMsg").className = "hint bad"; return; }
  if (typeof Tesseract === "undefined") {
    $("ocrMsg").textContent = "识别库没加载成功，检查网络后刷新。";
    $("ocrMsg").className = "hint bad";
    return;
  }
  $("ocrMsg").textContent = "先处理截图再识别，暗色横屏会反色放大…";
  $("ocrMsg").className = "hint";
  try {
    const prepared = await prepShot(shotFile);
    const res = await Tesseract.recognize(prepared, "eng+chi_sim", {
      logger: function(m) {
        if (m.status === "recognizing text") {
          $("ocrMsg").textContent = "识别中 " + Math.round((m.progress || 0) * 100) + "%";
        }
      }
    });
    const text = (res.data && res.data.text) || "";
    const p = parsePos(text);
    const filled = [];
    if (p.symbol) { $("symbol").value = p.symbol; filled.push(p.symbol); }
    if (p.dir) { setDir(p.dir, true); filled.push(p.dir === "long" ? "做多" : "做空"); }
    if (p.lev) { $("lev").value = p.lev; filled.push(p.lev + "x"); }
    if (p.entry) { $("entry").value = p.entry; filled.push("开仓 " + p.entry); }
    if (p.mark) { $("extreme").value = p.mark; filled.push("当前 " + p.mark); }
    if (p.margin) { $("margin").value = p.margin; filled.push("保证金 " + p.margin); }
    calc();
    if (!filled.length) {
      $("ocrMsg").textContent = "没读出持仓数字。";
      $("ocrMsg").className = "hint bad";
    } else {
      $("ocrMsg").textContent = "已填：" + filled.join("，") + "。请核对后再看结果。";
      $("ocrMsg").className = "hint ok";
    }
  } catch (e) {
    $("ocrMsg").textContent = "识别失败。";
    $("ocrMsg").className = "hint bad";
  }
}
function clearInputs() {
  ["symbol","margin","lev","cb","actIn","entry","extreme"].forEach(function(id) { $(id).value = ""; });
  $("src").value = "自动";
  $("pxMsg").textContent = "点「拉最新价」优先取币安合约标记价，失败再试其他所。";
  $("pxMsg").className = "hint";
  $("preview").innerHTML = "";
  $("shot").value = "";
  shotFile = null;
  $("ocrMsg").textContent = "已清空。";
  $("ocrMsg").className = "hint";
  setFeeMode("maker");
}
function setLayout(mode) {
  document.body.classList.toggle("desktop", mode === "desktop");
  $("btnMobile").className = mode === "mobile" ? "active" : "";
  $("btnDesk").className = mode === "desktop" ? "active" : "";
  try { localStorage.setItem("trail_layout", mode); } catch (e) {}
}
(function initLayout() {
  var saved = "";
  try { saved = localStorage.getItem("trail_layout") || ""; } catch (e) {}
  if (!saved) saved = window.innerWidth >= 900 ? "desktop" : "mobile";
  setLayout(saved);
})();
calc();
