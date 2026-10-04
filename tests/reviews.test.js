// Run: node --test tests/reviews.test.js
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { parseCsv } = require("../lib/menu.js");
const r = require("../lib/reviews.js");

const quiet = { warn() {}, error() {} };
const ok = (body) => async () => ({ ok: true, status: 200, text: async () => body, headers: { get: () => "text/csv" } });

test("reviews: rating 1-5 kept, anything else dropped; show=FALSE hidden; blank rows ignored", () => {
  const out = r.buildReviews(parseCsv([
    "name,rating,text,show",
    "Asha K.,5,Lovely,TRUE",
    "Ben L.,7,Too many stars,",
    "Hidden H.,5,Not shown,FALSE",
    ",,,FALSE",
    "No Text,5,,",
  ].join("\n")));
  assert.deepEqual(out.reviews.map((x) => [x.name, x.rating]), [["Asha K.", 5], ["Ben L.", null]]);
  assert.equal(out.warnings.length, 1);
});

test("reviews: the menu tab (what Google returns when 'Reviews' is missing) is rejected", () => {
  assert.throws(() => r.buildReviews(parseCsv("category,id,name\nFried Rice,fr-c,Chicken")), /missing column: text/);
});

test("reviews: very long text is cut at a word boundary", () => {
  const out = r.buildReviews(parseCsv(`name,text\nA,"${"word ".repeat(400)}"`));
  assert.ok(out.reviews[0].text.length <= 1203 && out.reviews[0].text.endsWith("..."));
});

test("load: live tab wins; missing tab or outage falls back to the committed snapshot", async () => {
  const env = { MENU_SHEET_ID: "abc" };
  const live = await r.loadReviews({ env, log: quiet, fetchImpl: ok("name,rating,text\nZed Q.,5,Great") });
  assert.equal(live.source, "live");
  assert.equal(live.reviews[0].name, "Zed Q.");
  const missing = await r.loadReviews({ env, log: quiet, fetchImpl: ok("category,id,name\nA,b,c") });
  assert.equal(missing.source, "snapshot");
  const down = await r.loadReviews({ env, log: quiet, fetchImpl: async () => { throw new Error("ENOTFOUND"); } });
  assert.equal(down.source, "snapshot");
  assert.ok(down.reviews.length >= 4);
});

test("url: reads the Reviews tab by name", () => {
  assert.equal(r.reviewsUrl({ MENU_SHEET_ID: "x" }),
    "https://docs.google.com/spreadsheets/d/x/gviz/tq?tqx=out:csv&sheet=Reviews");
  assert.equal(r.reviewsUrl({}), null);
});
