# Lotus Edge

Launch site for Lotus Edge, a garden restaurant and licensed lounge bar in Matale,
Sri Lanka. Rebrand of Summer Hut. Opens 11 September 2026.

One static HTML file. No build step, no dependencies, no framework. Open `index.html`
or drop the folder on any host.

## What it does

- **Day and night hero.** Reads the visitor's clock. 6am to 6pm shows the daytime garden
  and lunch copy, otherwise the lit garden and dinner copy. A header toggle overrides it
  and remembers the choice. Both copy variants stay in the DOM for crawlers and no-JS.
- **Opening countdown** that removes itself once the venue opens.
- Full HTML menu, 10 categories, half and full portions, with a sticky category bar that
  tracks the section you are reading.
- Scroll reveals, a pointer-tracking lantern glow on the hero, Ken Burns drift.
  Everything switches off under `prefers-reduced-motion`.
- WhatsApp-first booking. No backend.

## Before this goes live

Everything below is demo or placeholder. The full list is in the comment block at the
top of `index.html`.

- [ ] Replace `images/*.jpg` with real venue photos, same filenames
- [ ] Replace the inline SVG logo. It is redrawn by eye from a photo of the
      signboard, not the real vector. Ask the sign maker for the AI or SVG file.
- [ ] Real phone and WhatsApp number (search `770000000`)
- [ ] `FILL_ADDRESS`, `FILL_MAPS_URL`, `FILL_HOURS`, `FILL_DOMAIN`
- [ ] **Menu prices are SAMPLE numbers.** They exist so the layout can be judged
      with real content in it. The page says so in a gold notice above the menu.
      Replace them all with the kitchen's real list before this is public.
- [ ] Drinks list, the bar section has categories only
- [ ] Social links in the footer
- [ ] Fill and uncomment the JSON-LD block at the end of `<head>`.
      Do not ship placeholder values as structured data.

Photos are Unsplash stock placeholders.

## Hosting

Static. Vercel with no build command and no output directory. `vercel.json` sets
long cache on `/images` and basic security headers.

## Verified

375px and 1280px, no horizontal scroll. Contrast 8.06:1 muted body, 10.53:1 on buttons, 16.09:1 white on ground.
Body text 16px. No tap target under 44px. One `h1`. Title 42 chars, meta description
126 chars.
