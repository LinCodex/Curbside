# Interface validation — September 30, 2026

This change retains the repository's Vercel build configuration. No production tokens or provider credentials are included. The Mapbox token used for local checks is in ignored `.env.local`; production builds were generated with Mapbox environment aliases blank.

## Automated checks

- TypeScript compilation passes.
- 27 tests pass, including real-world address normalization, Queens matches, busiest-neighborhood framing, deduplication, missing financial amounts, device preferences, Chinese text coverage, and the existing simulated 500-vehicle notification workload.
- The Vercel build completes and prerenders the home page and all legal routes.
- Compared with the original commit, the changed core files add no ESLint rule violations. Existing lint errors remain, chiefly legacy `any` types and React effect rules; this is not a clean repository-wide lint report.
- Local credential scanning of tracked files and generated public assets finds no supplied credentials.

## Browser checks

Only real NYC records were loaded, using the user-requested plate BYEBYE / NY. At verification time the search returned 17 deduplicated tickets, 15 with reported addresses, and 12 reliably mapped locations after enrichment. Financial totals retain the missing-amount disclaimer and do not imply lifetime ownership.

Responsive checks cover 320 × 667 and 390 × 844 phones and 1280 × 900 desktop, in English/Chinese and light/dark appearances. Checks include:

- Search dates, descriptions, addresses, and amounts remain inside their cards. The last search card has end clearance.
- The map has one independently scrollable ticket list; its final card has bottom clearance. Address-only and unlocatable records remain accessible.
- Selecting a mapped ticket opens a compact card; viewing its details keeps the map route usable. The selected desktop pin is centered horizontally.
- Financial values share a row even when Chinese labels wrap to different heights.
- The Account settings popup has staged Save/Cancel behavior and persisted preferences. Save, Cancel, reload persistence, and manual reopening of the installation guide were checked.
- The duplicate bottom padding and separate gradient scrim were removed. The dock uses a stationary background layer, with hover confined inside its rounded bounds.
- Legal routes expose a mobile policy picker and collapsible contents, plus desktop sidebar navigation. Source material is presented in cards.

## Limits

Browser emulation is not a substitute for physical iPhone/Safari testing or an exhaustive accessibility audit. The lazy Mapbox library remains a large vendor chunk, loaded only for the interactive map; no claim of universal lag-free performance is made. External provider pages and authoritative addresses/identifiers retain their original names.

Sign-in, emails, SMS, billing, private evidence, and partner filing need configured services and account infrastructure. Their live delivery/authorization flows were not exercised. The standalone Vercel functions currently cover configuration and public search; the remaining existing handlers still require their database/storage adapters. Paid entry points remain disabled for this free release. Legal content remains identified as a prelaunch version, not a legal certification.
