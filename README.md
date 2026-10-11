# AlbionForge - Free Profit Calculators for Albion Online

**Domain:** `albionforge.top` · **Stack:** [Astro](https://astro.build) 5 (100% static) · **Hosting target:** Cloudflare Pages

A complete, ready-to-deploy tool website: four profit calculators (refining, crafting,
transport arbitrage, artifact enchanting) with verified Albion Online economy data,
a medieval-ledger design, tested math, and full SEO (sitemap, JSON-LD, OG images,
robots, FAQ content, guides).

## Quick start

```bash
npm install
npm run dev       # local dev at http://localhost:4321
npm test          # hand-computed Vitest scenarios for the math engine
npm run build     # static build → dist/
npm run preview   # serve dist/ locally
```

## Deploying to Cloudflare Pages

### Option A - Git integration (recommended)

1. Push this folder to a Git repository (GitHub/GitLab).
2. In the Cloudflare dashboard: **Workers & Pages → Create → Pages → Connect to Git**.
3. Select the repo and set:
 - **Framework preset:** `Astro`
 - **Build command:** `npm run build`
 - **Build output directory:** `dist`
 - **Node version:** environment variable `NODE_VERSION = 22` (or ≥ 20.3)
4. Deploy. Every push to the production branch builds and publishes automatically.

### Option B - Direct upload (CLI)

```bash
npm run build
npx wrangler pages deploy dist --project-name=albionforge
```

(The included `wrangler.toml` already points `pages_build_output_dir` at `dist`.)

### Custom domain `albionforge.top`

1. In the Pages project: **Custom domains → Set up a domain → `albionforge.top`**.
2. If the domain's DNS is already on Cloudflare, the `CNAME` to the project is added
   automatically (apex uses CNAME flattening). Otherwise add:
 - `albionforge.top` → `CNAME` → `<project>.pages.dev`
 - `www.albionforge.top` → `CNAME` → `<project>.pages.dev`
3. SSL is provisioned automatically. Verify `https://albionforge.top/` after activation.

### Already included for Cloudflare

- `public/_headers` - security headers + long-cache for hashed `/_astro/*` assets
- `public/robots.txt` - allows everything, points to the sitemap
- `sitemap-index.xml` / `sitemap-0.xml` - generated at build with `https://albionforge.top`
- `404.html` - real 404 page (Cloudflare Pages serves it automatically)
- `og.png` - social share image referenced by all pages

## Project structure

```
src/
  lib/
    engine.ts        # pure profit math (taxes, return rates, break-evens) - no DOM
    engine.test.ts   # Vitest: hand-computed scenarios matching the on-page examples
    data.ts          # verified game constants + source URLs (last verified 2026-10)
    format.ts        # number formatting helpers
  layouts/BaseLayout.astro   # SEO head, header/footer, theme
  components/        # Faq (accordion + optional JSON-LD), ToolCard, Ornament
  pages/
    index.astro                 # home + Organization/WebSite JSON-LD
    tools/{refining,crafting,transport,enchanting}.astro
    guides/index.astro          # hub + recipe & return-rate reference tables
    guides/{refining-city-bonus,market-tax,focus-worth-it}.astro
    faq.astro  about.astro  methodology.astro  changelog.astro
    privacy.astro  terms.astro  sitemap.astro  404.astro
```

## Updating game data after patches

All presets live in `src/lib/data.ts` with their source URLs and last-verified
dates. Change a value, run `npm test`, update `src/pages/methodology.astro` and
`src/pages/changelog.astro`, rebuild.

## Notes

- All computation runs client-side; no analytics, cookies, or accounts.
- Fan-made tool; Albion Online is a trademark of Sandbox Interactive GmbH.
