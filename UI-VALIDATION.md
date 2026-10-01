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

## October 1 follow-up: iOS and Supabase

- Emulated a 390 × 844 phone with a 59px top and 34px bottom safe area. The header ends at 135px, its logo clears the notch, and the map canvas reaches the viewport bottom without an extra page scroll. The dock ends at 798px, clear of the home indicator.
- With real BYEBYE / NY records, the final map card ends at 666px inside a list ending at 685px after scrolling to the end. Registration sheets stay between the top and bottom safe areas.
- TypeScript, all 27 tests, and the Vercel production build pass. Account language changes no longer reset the saved garage.
- Live Supabase transaction checks pass for consent gating, owner isolation, rename, duplicate prevention, anonymous denial, immutable ownership, and protected consent timestamps. Temporary fixtures were rolled back. Security and performance advisors report no findings after the hardening migration.
- Public signup/confirmation and password-reset email delivery remain unverified pending custom SMTP and production redirect/environment configuration. See `SUPABASE_SETUP.md`. Supabase accounts currently support saving cars only; notification, billing, and partner workflows remain outside this release.

## October 1 interface and email follow-up

- Registration and recovery show and validate an eight-character minimum with ASCII lowercase, uppercase, and a digit. Symbols remain optional. Existing-password sign-in is unchanged; hosted Supabase password settings were not modified.
- Settings changes preview across the app without writing the draft to browser preferences. Cancel restores the previous appearance/language; Apply persists them after reload. Closing the popup clears preview and restores the dock.
- Legal pages have app destination links, policy navigation, and separate section navigation. Desktop uses a sticky sidebar; mobile uses custom policy/section menus. Anchors clear the mobile controls and the section selection follows scroll position. Contact and source references are included.
- Dock checks at 390 × 844: visible after 42px and 84px downward scroll, hidden after 127px, visible after upward scrolling. The configured hide threshold is 96px; motion uses only opacity and scale/translation and respects reduced motion.
- Static map overlays are lighter in both themes; light-map brightness is reduced before contrast so its roads are not clipped to white. The interactive map styling is unchanged.
- All 22 English/Chinese email HTML files pass variable/dependency/table checks. Browser previews cover signup and Chinese reauthentication at phone width. These files are ready to paste into Supabase, but have not been installed or sent; real inbox compatibility and delivery still require provider tests.
- The hero eyebrow, two-line heading, and subtitle share centered alignment. Chinese interfaces use the short wordmark “泊查.”, while English retains “curbside.”. Chinese email copy uses the same name and identifies Curbside in the footer.
- Empty mobile map panels fit their content instead of reserving a full ticket-list height. The footer-to-container gap measures 15px on a 390px phone and 21px on desktop, including the border; populated lists retain their scroll area. The final Vercel build and public credential audit pass.
