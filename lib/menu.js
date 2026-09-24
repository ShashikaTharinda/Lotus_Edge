// Menu loader. One place that turns the Google Sheet into a checked menu.
// The /menu page renders from it today; a future order API must price from it too
// (never from anything the phone sends).
"use strict";

const fs = require("fs");
const path = require("path");

const FETCH_TIMEOUT_MS = 4000;
const MAX_BYTES = 1_000_000;
const MAX_ROWS = 2000;
const MAX_PRICE = 1_000_000; // rupees
const SNAPSHOT = path.join(__dirname, "..", "data", "menu.csv");

// RFC 4180: quoted fields, "" escapes, commas and newlines inside quotes.
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", q = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else q = false;
      } else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// Whole rupees. Accepts what staff actually type: 1250, 1,250, Rs. 1250, 1250.00.
function parsePrice(raw) {
  const s = String(raw || "").trim();
  if (!s) return { value: null };
  const clean = s.replace(/^(rs\.?|lkr)\s*/i, "").replace(/,/g, "").replace(/\.0+$/, "");
  if (!/^\d+$/.test(clean)) return { value: null, bad: true };
  const n = Number(clean);
  if (n > MAX_PRICE) return { value: null, bad: true };
  return { value: n };
}

const TRUE = new Set(["true", "yes", "y", "1", "x", "\u2713", "\u2714"]);
const FALSE = new Set(["false", "no", "n", "0"]);
function parseBool(raw, dflt) {
  const s = String(raw || "").trim().toLowerCase();
  if (!s) return { value: dflt };
  if (TRUE.has(s)) return { value: true };
  if (FALSE.has(s)) return { value: false };
  return { value: dflt, bad: true };
}

const slug = (s) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Rows in, menu out. Bad rows are skipped with a warning; a broken sheet throws.
function buildMenu(table) {
  if (!table.length) throw new Error("empty sheet");
  const head = table[0].map((h) => h.trim().toLowerCase());
  const col = (name) => head.indexOf(name);
  for (const req of ["category", "id", "name"]) {
    if (col(req) < 0) throw new Error(`missing column: ${req}`);
  }
  if (table.length - 1 > MAX_ROWS) throw new Error(`too many rows: ${table.length - 1}`);

  const warnings = [];
  const cats = new Map();
  const seen = new Set();
  const get = (r, name) => (col(name) < 0 ? "" : String(r[col(name)] ?? "").trim());

  table.slice(1).forEach((r, i) => {
    const line = i + 2; // sheet row number
    if (r.every((v) => !String(v).trim())) return;
    const category = get(r, "category");
    const name = get(r, "name");
    const id = get(r, "id").toLowerCase();
    if (!category || !name || !id) {
      warnings.push(`row ${line}: needs category, id and name, skipped`);
      return;
    }
    if (seen.has(id)) {
      warnings.push(`row ${line}: duplicate id "${id}", skipped`);
      return;
    }
    seen.add(id);
    const show = parseBool(get(r, "show"), true);
    const available = parseBool(get(r, "available"), true);
    const price = parsePrice(get(r, "price"));
    const priceFull = parsePrice(get(r, "price_full"));
    if (show.bad) warnings.push(`row ${line}: show "${get(r, "show")}" not understood, shown`);
    if (available.bad) warnings.push(`row ${line}: available "${get(r, "available")}" not understood, treated as available`);
    if (price.bad) warnings.push(`row ${line}: price "${get(r, "price")}" not a whole number, left blank`);
    if (priceFull.bad) warnings.push(`row ${line}: price_full "${get(r, "price_full")}" not a whole number, left blank`);
    if (!show.value) return;

    const key = category.toLowerCase();
    if (!cats.has(key)) cats.set(key, { id: "cat-" + slug(category), name: category, hasFull: false, items: [] });
    const cat = cats.get(key);
    const image = get(r, "image_url");
    cat.items.push({
      id,
      name,
      description: get(r, "description"),
      price: price.value,
      priceFull: priceFull.value,
      available: available.value,
      tags: get(r, "tags").split(",").map((t) => t.trim().toLowerCase()).filter(Boolean),
      image: /^https:\/\//i.test(image) ? image : null,
    });
    if (priceFull.value !== null) cat.hasFull = true;
  });

  const categories = [...cats.values()];
  if (!categories.length) throw new Error("no visible items");
  return { categories, warnings };
}

function sheetUrl(env) {
  if (env.MENU_CSV_URL) return env.MENU_CSV_URL;
  if (!env.MENU_SHEET_ID) return null;
  const gid = env.MENU_SHEET_GID || "0";
  return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(env.MENU_SHEET_ID)}/export?format=csv&gid=${encodeURIComponent(gid)}`;
}

async function fetchSheet(url, fetchImpl) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, { signal: ctrl.signal, redirect: "follow" });
    if (!res.ok) throw new Error(`sheet HTTP ${res.status}`);
    const text = await res.text();
    if (text.length > MAX_BYTES) throw new Error("sheet too large");
    // A sheet that is not shared returns Google's sign-in page with status 200.
    if (/^\s*</.test(text) || /text\/html/i.test(res.headers.get("content-type") || "")) {
      throw new Error("sheet is not shared as 'Anyone with the link'");
    }
    return text;
  } finally {
    clearTimeout(t);
  }
}

let lastGood = null; // survives while this function instance stays warm

// Always returns a menu. source: live | memory | snapshot. stale: a live read was expected and failed.
async function loadMenu({ env = process.env, fetchImpl = globalThis.fetch, log = console } = {}) {
  const url = sheetUrl(env);
  if (url) {
    try {
      const menu = buildMenu(parseCsv(await fetchSheet(url, fetchImpl)));
      if (menu.warnings.length) log.warn("[menu] " + menu.warnings.join(" | "));
      lastGood = menu;
      return { ...menu, source: "live", stale: false };
    } catch (err) {
      log.error("[menu] live sheet failed: " + err.message);
      if (lastGood) return { ...lastGood, source: "memory", stale: true };
    }
  }
  const menu = buildMenu(parseCsv(fs.readFileSync(SNAPSHOT, "utf8")));
  return { ...menu, source: "snapshot", stale: Boolean(url) };
}

module.exports = { parseCsv, parsePrice, parseBool, buildMenu, loadMenu, sheetUrl, _reset: () => { lastGood = null; } };
