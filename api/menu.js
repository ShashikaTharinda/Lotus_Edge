// GET /menu (rewritten here by vercel.json). Server-renders the menu from the Google Sheet.
// Edge cache holds each render for 60s and keeps serving the last one while it refreshes.
"use strict";

const { loadMenu } = require("../lib/menu.js");

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const rupees = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const IG = "https://www.instagram.com/lotus__edge";
const FB = "https://www.facebook.com/profile.php?id=61594233363684";

function priceCell(value, label) {
  if (value === null) return `<span class="price"></span>`;
  return `<span class="price"><span class="vh">${label} </span>${rupees(value)}</span>`;
}

function item(it, cat) {
  const priced = cat.items.some((i) => i.price !== null || i.priceFull !== null);
  const prices = !priced ? "" : cat.hasFull
    ? priceCell(it.price, "Regular") + priceCell(it.priceFull, "Full")
    : priceCell(it.price, "Price");
  return `
          <li class="dish${it.available ? "" : " sold"}">
            <div class="dish-main"><span class="dish-name">${esc(it.name)}</span>${it.available ? "" : `<span class="soldout">Sold out</span>`}${it.description ? `<span class="dish-desc">${esc(it.description)}</span>` : ""}</div>
${prices ? `
            <div class="dish-prices">${prices}</div>` : ""}
          </li>`;
}

function renderPage(menu) {
  const anyPrice = menu.categories.some((c) => c.items.some((i) => i.price !== null || i.priceFull !== null));
  const pills = menu.categories.map((c) => `\n        <a href="#${c.id}">${esc(c.name)}</a>`).join("");
  const sections = menu.categories.map((c) => `
        <section class="course" id="${c.id}" aria-labelledby="${c.id}-h">
          <div class="course-head"><h2 id="${c.id}-h">${esc(c.name)}</h2>${c.hasFull ? `<div class="portions" aria-hidden="true"><span>Regular</span><span>Full</span></div>` : ""}</div>
          <ul class="dishes">${c.items.map((it) => item(it, c)).join("")}
          </ul>
        </section>`).join("");
  const notice = menu.stale
    ? `\n      <p class="notice" role="status">This menu may not show today's latest changes. Please check with your waiter.</p>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Menu | Lotus Edge, Matale</title>
<meta name="description" content="The Lotus Edge menu: fried rice, noodles, kottu, devilled dishes, rice and curry and more. Garden restaurant and lounge at Palapathwala, Matale.">
<link rel="canonical" href="https://lotusedge.lk/menu">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Lotus Edge">
<meta property="og:title" content="Menu | Lotus Edge, Matale">
<meta property="og:description" content="Fried rice, noodles, kottu, rice and curry and more at Lotus Edge, Palapathwala, Matale.">
<meta property="og:url" content="https://lotusedge.lk/menu">
<meta property="og:image" content="https://lotusedge.lk/images/og-lotus-edge.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#12140F">
<link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500&amp;family=Inter:wght@400;500;600&amp;display=swap" onload="this.onload=null;this.rel='stylesheet'">
<noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500&amp;family=Inter:wght@400;500;600&amp;display=swap"></noscript>
<link rel="stylesheet" href="/site.css">
</head>
<body>
<a class="skip" href="#main">Skip to the menu</a>

<header class="site-header stuck">
  <div class="wrap">
    <a class="brand" href="/">
      <img class="mark" src="/images/logo-mark.webp" alt="" width="96" height="96">
      <span class="brand-type"><span class="n1">Lotus</span> <span class="n2">Edge</span></span>
    </a>
    <nav class="nav" aria-label="Primary">
      <a href="/#venue">The Garden</a>
      <a href="/#visit">Find Us</a>
    </nav>
  </div>
</header>

<main id="main">
  <section class="menu-page" style="background:var(--slate-850)">
    <div class="wrap">
      <h1>Menu</h1>
      <p class="lede">${anyPrice ? "Prices in Sri Lankan rupees. " : ""}Tell your waiter what you'd like.</p>${notice}

      <nav class="menu-nav" id="menuNav" aria-label="Menu sections">${pills}
      </nav>

      <div class="menu-grid">${sections}
      </div>

      <div class="menu-foot">
        <a class="btn btn-ghost" href="/">Lotus Edge home</a>
        <a class="btn btn-ghost" href="${IG}">Instagram</a>
        <a class="btn btn-ghost" href="${FB}">Facebook</a>
      </div>
    </div>
  </section>
</main>

<footer class="site-footer">
  <div class="wrap">
    <p>LOTUS EDGE RESTAURANT &amp; LOUNGE (Pvt) Ltd<br>25/1 Kirigalpotta, Palapathwala, Matale</p>
  </div>
</footer>

<script>
/* Menu scroll spy, same behaviour as the home page. Only page with a menu nav now that the home page links here. */
(function(){
  var nav=document.getElementById("menuNav"),secs=[].slice.call(document.querySelectorAll(".course"));
  if(!nav||!secs.length||!("IntersectionObserver" in window))return;
  var reduce=matchMedia("(prefers-reduced-motion: reduce)").matches,links={};
  [].forEach.call(nav.querySelectorAll("a"),function(a){links[a.getAttribute("href").slice(1)]=a});
  var spy=new IntersectionObserver(function(es){es.forEach(function(e){
    if(!e.isIntersecting)return;var a=links[e.target.id];if(!a||a.classList.contains("active"))return;
    nav.querySelectorAll("a.active").forEach(function(x){x.classList.remove("active")});a.classList.add("active");
    nav.scrollTo({left:a.offsetLeft-nav.clientWidth/2+a.clientWidth/2,behavior:reduce?"auto":"smooth"});
  })},{rootMargin:"-42% 0px -50% 0px"});
  secs.forEach(function(s){spy.observe(s)});
})();
</script>
</body>
</html>
`;
}

module.exports = async function handler(req, res) {
  let menu;
  try {
    menu = await loadMenu();
  } catch (err) {
    // Only reachable if the committed snapshot itself is broken.
    console.error("[menu] snapshot failed: " + err.message);
    res.statusCode = 503;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Menu | Lotus Edge</title><p style="font:18px system-ui;padding:24px">The menu is not available right now. Please ask your waiter. <a href="/">Lotus Edge home</a></p>`);
    return;
  }
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  // Live: cache 60s at the edge. Fallback: 15s, so a recovered sheet shows up quickly.
  res.setHeader("Cache-Control", menu.stale
    ? "public, max-age=0, s-maxage=15, stale-while-revalidate=60"
    : "public, max-age=0, s-maxage=60, stale-while-revalidate=600");
  res.setHeader("X-Menu-Source", menu.source);
  res.end(renderPage(menu));
};

module.exports.renderPage = renderPage;
