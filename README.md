# Lotus Edge

Site for Lotus Edge, a garden restaurant and lounge at 25/1 Kirigalpotta, Palapathwala,
Matale, Sri Lanka. Open since 11 September 2026. Served at lotusedge.lk.

One static HTML file. No build step, no dependencies, no framework.

## What is on the page

Only confirmed facts: name, legal entity, address, Instagram, Facebook, and the venue's
own night photographs and logo. No menu, prices, phone number or opening hours yet. Each
has a commented slot in `index.html` (`MENU SLOT`, `PHONE SLOT A/B/C`, `DIRECTIONS SLOT`)
so it drops in as a content edit.

## Files

- `index.html` the page, with a Restaurant JSON-LD block
- `images/` WebP photos and logo built from the client originals, plus `og-lotus-edge.jpg` (1200x630)
- `favicon.ico`, `apple-touch-icon.png` from the real logo mark
- `robots.txt`, `sitemap.xml`
- `vercel.json` long cache on `/images`, basic security headers

## Hosting

Static on Vercel, no build command, no output directory. Pushing to `main` redeploys.
