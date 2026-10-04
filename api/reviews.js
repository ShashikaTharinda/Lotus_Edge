// GET /api/reviews: the guest reviews as JSON, for the home page to refresh its built-in list.
"use strict";

const { loadReviews } = require("../lib/reviews.js");

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  try {
    const { reviews, source } = await loadReviews();
    res.statusCode = 200;
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=3600");
    res.setHeader("X-Reviews-Source", source);
    res.end(JSON.stringify({ reviews }));
  } catch (err) {
    console.error("[reviews] snapshot failed: " + err.message);
    res.statusCode = 503;
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify({ error: { code: "reviews_unavailable", message: "Reviews are not available right now." } }));
  }
};
