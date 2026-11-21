# KWARAVEND_REBRAND_CHANGES.md: headline, plan name and languages

Date: 21 November 2026. Owner: Mukhtar (IDEV Inc.).

This file is newer than every other file. Where it disagrees with `BUILD.md`, `KWARAVEND_IMPROVEMENTS.md`, `REDESIGN.md`, `REDESIGN_V2.md` or `KWARAVEND_UPDATES.md`, this file wins. The owner has asked for these three changes in plain words, so the old "locked copy" rule is lifted for the headline below, and then locked again.

One task at a time, small commits (`R1: headline`, `R2: plan rename`, `R3: languages`). After each: lint, types, tests, build, then report what changed and how to test it.

## R1. Headline: "storefront" replaces "business"

Why: The product is a storefront. A seller reads "Your storefront deserves more" and sees what they get: a real shop front that does more than a chat catalogue. It also matches the name of the thing we sell.

New locked headline (word `more` stays gold):

**Your storefront deserves more than a WhatsApp catalogue.**

Everything else in the locked hero stays exactly as it was:

- Sub-line: `Create an online store, take orders and deliveries, and let customers near you in Ilorin find you.`
- Buttons: `Open your store, free` and `Explore stores near you`
- Pills: `No card to start`, `No commission`, `Pickup or delivery`
- Nav button: `Sell free`
- Mockup label: `EXAMPLE STOREFRONT`

Do:

1. Change the headline string in the single locked content file (the one marked `LOCKED BY OWNER`) and update the unit test that guards it to the new text.
2. Search the whole repo for `Your business deserves more` and replace every use: hero, page title and meta description, Open Graph and Twitter tags, share image text, emails, README, docs.
3. Check that the headline still fits at 390px and 1280px. If it wraps badly, change the layout or font size. Never change the words.
4. Keep the comment `LOCKED BY OWNER (changed to "storefront" on 21 Nov 2026)` above the string.

Done when: a repo search for `business deserves more` returns nothing, the guard test passes with the new text, and screenshots show the headline with a gold `more`.

## R2. Rename the plan "Business Plus" to "Emirates Plus"

Why: Ilorin is an emirate, and the middle plan should feel local and proud, not generic. "Emirates Plus" gives the featured plan a name sellers in Ilorin remember.

New plan names: `Starter` (free), `Emirates Plus` (the featured, gold-highlighted card), `Business Pro` (unchanged).

Do:

1. In the plan config, change the display name from `Business Plus` to `Emirates Plus`. Keep the internal plan id stable (for example `plus`) so existing data and any saved plan values do not break. Do not run a migration that renames stored values unless the stored value is the display name. If it is, stop and ask.
2. Replace the name everywhere it is shown: pricing cards, `/pricing` comparison table, upgrade prompts, dashboard plan badge, emails, FAQ, waitlist form, admin screens, tests and docs.
3. Search the repo for `Business Plus`, `business plus`, `BusinessPlus` and `business_plus`, and list every hit with the action taken.
4. Keep everything else about the plan: features, configurable price, Coming soon and Join the waitlist while billing is off.
5. Check the pricing page after the rename: the card is still gold-highlighted, and the label fits on one line at 390px.

Done when: no UI text or doc says `Business Plus`, the pricing page and waitlist show `Emirates Plus`, and existing stores on this plan still show the right plan.

Ask the owner first if: you want the name singular (`Emirate Plus`). The owner wrote "Emirates", so use that spelling.

## R3. Remove Igbo and Hausa

Why: We launch in Ilorin only. Offering languages we cannot write and check well risks bad translations. It is better to do fewer languages properly.

Languages after this change: English (default, complete). Nigerian Pidgin and Yoruba stay as optional, later additions through the i18n layer. Hausa and Igbo are removed and are not planned.

Do:

1. Remove Hausa (`ha`) and Igbo (`ig`) from the language switcher, locale config, supported-locale list, route prefixes, `hreflang` tags, sitemap entries and any language preference stored in the profile.
2. Delete their translation files and catalogue entries. If a user has saved `ha` or `ig` as a preference, fall back to English without an error.
3. If any route like `/ha/...` or `/ig/...` exists, redirect it to the English page.
4. Remove any "Hausa" or "Igbo" text from the FAQ, About page, docs and marketing copy.
5. Keep the i18n layer itself. All UI strings stay in the catalogue, with no hard-coded strings.
6. If the app has no language switcher yet, only make sure nothing mentions these two languages.

Done when: a repo search for `Hausa`, `Igbo`, `ha-NG`, `ig-NG` returns nothing except this file, and switching language or opening an old language URL never shows an error.

## What was already updated in the other files

Because the owner asked for these changes in plain words, the text in `BUILD.md`, `KWARAVEND_IMPROVEMENTS.md`, `KWARAVEND_UPDATES.md`, `REDESIGN.md` and `REDESIGN_V2.md` was changed to match: the headline now says `storefront`, the plan is `Emirates Plus`, and the language lists say English, Pidgin and Yoruba. If the agent finds an old copy of any of them that still says `business deserves`, `Business Plus` or `Hausa`, follow this file.

## Do not do

- Do not change the sub-line, buttons, pills or any other locked copy.
- Do not rename `Business Pro` or change plan prices or features.
- Do not add other languages.
- Do not rename stored plan ids without a plan the owner approves.

## Final check

- Headline reads `Your storefront deserves more than a WhatsApp catalogue.` with a gold `more`, in the hero and in share cards, titles and emails.
- The pricing page shows Starter, Emirates Plus and Business Pro.
- No Hausa or Igbo anywhere, and old language URLs redirect to English.

## Implementation notes (21 Nov 2026)

- R1: locked copy lives in `packages/shared/src/locked-copy.ts`, guarded by `locked-copy.test.ts`; the hero, `BRAND.tagline` and all docs use it.
- R2: only the display name changed (`plans.ts`, id `plus`). The app has four tiers (Free, Business, Emirates Plus, Business Pro) set by the owner on 18 Nov; this file lists three. The free tier is still called "Free", not "Starter". Ask the owner before merging or renaming tiers.
- R3: no `/ha` or `/ig` routes, `hreflang` tags or sitemap entries existed. Saved choices fall back to English through `isLanguageCode`.
