// Reviews loader. Reads the "Reviews" tab of the menu Google Sheet by name, so re-importing the
// menu (which changes tab gids) cannot break it. Same safety rules as the menu: bad rows are
// skipped, a broken or missing tab falls back to the committed data/reviews.csv.
"use strict";

const fs = require("fs");
const path = require("path");
const { parseCsv, parseBool, fetchSheet } = require("./menu.js");

const SNAPSHOT = path.join(__dirname, "..", "data", "reviews.csv");
const MAX_TEXT = 1200;

function reviewsUrl(env) {
  if (env.REVIEWS_CSV_URL) return env.REVIEWS_CSV_URL;
  if (!env.MENU_SHEET_ID) return null;
  return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(env.MENU_SHEET_ID)}/gviz/tq?tqx=out:csv&sheet=Reviews`;
}

function buildReviews(table) {
  if (!table.length) throw new Error("empty reviews tab");
  const head = table[0].map((h) => h.trim().toLowerCase());
  const col = (n) => head.indexOf(n);
  // gviz returns the FIRST tab when "Reviews" does not exist; the menu tab has no "text" column.
  for (const req of ["name", "text"]) if (col(req) < 0) throw new Error(`missing column: ${req}`);
  const get = (r, n) => (col(n) < 0 ? "" : String(r[col(n)] ?? "").trim());
  const warnings = [];
  const reviews = [];
  table.slice(1).forEach((r, i) => {
    const name = get(r, "name");
    const text = get(r, "text");
    if (!name && !text) return;
    if (!name || !text) { warnings.push(`row ${i + 2}: needs name and text, skipped`); return; }
    if (!parseBool(get(r, "show"), true).value) return;
    const n = Number(get(r, "rating"));
    reviews.push({
      name: name.slice(0, 60),
      rating: Number.isInteger(n) && n >= 1 && n <= 5 ? n : null,
      text: text.length > MAX_TEXT ? text.slice(0, MAX_TEXT).replace(/\s+\S*$/, "") + "..." : text,
    });
  });
  if (!reviews.length) throw new Error("no visible reviews");
  return { reviews, warnings };
}

async function loadReviews({ env = process.env, fetchImpl = globalThis.fetch, log = console } = {}) {
  const url = reviewsUrl(env);
  if (url) {
    try {
      const out = buildReviews(parseCsv(await fetchSheet(url, fetchImpl)));
      if (out.warnings.length) log.warn("[reviews] " + out.warnings.join(" | "));
      return { ...out, source: "live" };
    } catch (err) {
      log.error("[reviews] live sheet failed: " + err.message);
    }
  }
  return { ...buildReviews(parseCsv(fs.readFileSync(SNAPSHOT, "utf8"))), source: "snapshot" };
}

module.exports = { buildReviews, loadReviews, reviewsUrl };
