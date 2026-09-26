// Run: node --test tests/menu.test.js
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const m = require("../lib/menu.js");

const HEAD = "category,id,name,description,price,price_full,available,show,tags,image_url,notes";
const csv = (...lines) => [HEAD, ...lines].join("\n");
const quiet = { warn() {}, error() {} };
const okFetch = (body, type = "text/csv") => async () => ({
  ok: true, status: 200, text: async () => body, headers: { get: () => type },
});

test("csv: quotes, escaped quotes, commas and newlines inside fields, CRLF, BOM", () => {
  const t = m.parseCsv('\uFEFFa,b\r\n"x, y","say ""hi""\nthere"\r\n');
  assert.deepEqual(t, [["a", "b"], ["x, y", 'say "hi"\nthere']]);
});

test("price: what staff type", () => {
  for (const [raw, want] of [["1250", 1250], ["1,250", 1250], ["Rs. 1250", 1250], ["LKR 980", 980], ["1250.00", 1250], ["", null]]) {
    assert.equal(m.parsePrice(raw).value, want, raw);
  }
  for (const raw of ["12.50", "abc", "-5", "1O0", "9999999"]) {
    const p = m.parsePrice(raw);
    assert.equal(p.value, null, raw);
    assert.equal(p.bad, true, raw);
  }
});

test("menu: groups by category in row order, hides show=FALSE, keeps sold out visible", () => {
  const menu = m.buildMenu(m.parseCsv(csv(
    "Lunch,lunch-chicken,Chicken,Rice and curry,580,,TRUE,TRUE,,,",
    "Add-ons,addon-egg,Egg,,80,,FALSE,TRUE,,,",
    "lunch,lunch-fish,Fish,,500,,TRUE,TRUE,,,",
    "Add-ons,addon-x,Secret,,10,,TRUE,FALSE,,,",
  )));
  assert.deepEqual(menu.categories.map((c) => c.name), ["Lunch", "Add-ons"]);
  assert.deepEqual(menu.categories[0].items.map((i) => i.id), ["lunch-chicken", "lunch-fish"]);
  assert.equal(menu.categories[1].items.length, 1);
  assert.equal(menu.categories[1].items[0].available, false);
});

test("menu: bad rows are skipped with a warning, the rest survives", () => {
  const menu = m.buildMenu(m.parseCsv(csv(
    "Lunch,lunch-a,A,,100,,,,,,",
    "Lunch,lunch-a,Duplicate,,100,,,,,,",
    "Lunch,,No id,,100,,,,,,",
    "Lunch,lunch-b,B,,1OO,,maybe,,,,",
    ",,,,,,,,,,",
  )));
  assert.deepEqual(menu.categories[0].items.map((i) => i.id), ["lunch-a", "lunch-b"]);
  assert.equal(menu.categories[0].items[1].price, null);
  assert.equal(menu.categories[0].items[1].available, true);
  assert.equal(menu.warnings.length, 4);
});

test("menu: portion columns only where a Full price exists", () => {
  const menu = m.buildMenu(m.parseCsv(csv(
    "Fried Rice,fr-c,Chicken,,700,1150,,,,,",
    "Stew,stew-c,Chicken,,950,,,,,,",
  )));
  assert.equal(menu.categories[0].hasFull, true);
  assert.equal(menu.categories[1].hasFull, false);
});

test("menu: only https image urls pass", () => {
  const menu = m.buildMenu(m.parseCsv(csv(
    "A,a1,One,,,,,,,https://img.example/a.webp,",
    "A,a2,Two,,,,,,,javascript:alert(1),",
  )));
  assert.equal(menu.categories[0].items[0].image, "https://img.example/a.webp");
  assert.equal(menu.categories[0].items[1].image, null);
});

test("menu: renamed heading or empty sheet throws (so the loader falls back)", () => {
  assert.throws(() => m.buildMenu(m.parseCsv("Category,ID,Dish\nA,a,b")), /missing column: name/);
  assert.throws(() => m.buildMenu([]), /empty/);
  assert.throws(() => m.buildMenu(m.parseCsv(csv("A,a,x,,,,,FALSE,,,"))), /no visible items/);
});

test("load: no sheet configured serves the committed snapshot, not flagged stale", async () => {
  m._reset();
  const r = await m.loadMenu({ env: {}, log: quiet });
  assert.equal(r.source, "snapshot");
  assert.equal(r.stale, false);
  assert.ok(r.categories.length >= 10);
});

test("load: live sheet wins, then a failure serves the last good copy from memory", async () => {
  m._reset();
  const env = { MENU_SHEET_ID: "abc" };
  const live = await m.loadMenu({ env, log: quiet, fetchImpl: okFetch(csv("Lunch,l1,Live dish,,999,,,,,,")) });
  assert.equal(live.source, "live");
  assert.equal(live.categories[0].items[0].price, 999);
  const down = await m.loadMenu({ env, log: quiet, fetchImpl: async () => { throw new Error("ENOTFOUND"); } });
  assert.equal(down.source, "memory");
  assert.equal(down.stale, true);
  assert.equal(down.categories[0].items[0].name, "Live dish");
});

test("load: cold start + Google down, unshared sheet, HTTP 500 and broken sheet all fall back to snapshot", async () => {
  const env = { MENU_SHEET_ID: "abc" };
  const cases = {
    network: async () => { throw new Error("ENOTFOUND"); },
    unshared: okFetch("<!doctype html><title>Sign in</title>", "text/html"),
    http500: async () => ({ ok: false, status: 500, text: async () => "", headers: { get: () => "" } }),
    broken: okFetch("Category,Dish\nx,y"),
  };
  for (const [name, fetchImpl] of Object.entries(cases)) {
    m._reset();
    const r = await m.loadMenu({ env, log: quiet, fetchImpl });
    assert.equal(r.source, "snapshot", name);
    assert.equal(r.stale, true, name);
  }
});

test("load: a hung Google request times out instead of hanging the page", async () => {
  m._reset();
  const hang = (url, { signal }) => new Promise((_, rej) => signal.addEventListener("abort", () => rej(new Error("aborted"))));
  const t0 = Date.now();
  const r = await m.loadMenu({ env: { MENU_SHEET_ID: "abc" }, log: quiet, fetchImpl: hang });
  assert.equal(r.source, "snapshot");
  assert.ok(Date.now() - t0 < 6000);
});

test("sheet url: export CSV of the first tab, id encoded", () => {
  assert.equal(m.sheetUrl({ MENU_SHEET_ID: "a/b" }),
    "https://docs.google.com/spreadsheets/d/a%2Fb/export?format=csv&gid=0");
  assert.equal(m.sheetUrl({}), null);
});
