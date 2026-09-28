---
name: anti-vibecoded-ui
description: 100 concrete rules for making AI-built apps stop looking like default AI output, with shadcn/ui-specific guidance baked in.
---

# Anti-Vibecoded UI Checklist

Use this as a pre-flight and post-build checklist for any app scaffolded with AI, especially ones built on shadcn/ui. The goal is never "add more polish" — it's "remove the tells that give away a templated build." Work through relevant sections before writing code, then again as a critique pass on the finished UI.

## The 5 default clusters to actively steer away from

Every one of these is legitimate *if the brief calls for it*. The problem is using them by default.

1. Warm cream background (~#F4F1EA) + high-contrast serif + terracotta accent (~#D97757).
2. Near-black background with one bright acid-green or vermilion accent.
3. Broadsheet layout: hairline rules, zero border-radius, dense newspaper columns.
4. "SaaS-card kit": everything chopped into identical rounded cards, one border-radius applied everywhere, the same soft grey box-shadow under each, gradient washes as decoration.
5. Generic template chrome: tracked-out ALL-CAPS eyebrow labels, meta strings joined with middle dots, spaced em-dashes in labels, tinted near-black standing in for true black, monospace for small data labels, a "→" appended to every link/button.

## Typography (1–14)

1. Pick two typefaces max, and make them clearly distinct in role, not just swapped defaults.
2. Never default to Inter + system stack without deciding that's actually right for this brief.
3. Set an explicit type scale (e.g. 12/14/16/20/24/32/48) — don't let Tailwind's default `text-*` steps be the whole plan.
4. Avoid bolding/coloring a single word in a headline for "emphasis" — it's the #1 AI tell.
5. Don't use ALL CAPS for section labels or eyebrows unless the brand voice demands it.
6. Kill unnecessary eyebrow labels above headings ("OUR SERVICES" above "Services").
7. Line length under ~80 characters for body copy.
8. Give serif body text more line-height than sans-serif equivalents.
9. Vary font-weight deliberately across hierarchy — don't leave everything at 400/600.
10. Avoid letter-spacing on body text; reserve tracking for genuinely small caps labels.
11. Don't center-align long paragraphs — left-align body copy by default.
12. Headings should carry actual personality (size, weight, or treatment), not just be a bigger version of body text.
13. Check that numerals (prices, stats) use tabular/lining figures, not mismatched old-style figures.
14. Proofread for real copy — no "Lorem ipsum," no "Amazing Feature #1," no placeholder brand name like "Acme Inc." unless explicitly a placeholder brief.

## Color & theming (15–28)

15. Choose a palette as 4–6 named hex values *before* touching code — don't let it emerge from Tailwind defaults.
15b. Default core palette: white background, black/near-black text, blue as the primary action color, green reserved for success/positive states. Keep this as the baseline for standard UI (buttons, links, form states) — reach for a custom accent only on custom/one-off components (hero treatments, illustrations, brand moments) where the brief calls for something distinct.
16. Don't default to `slate` as your gray scale just because shadcn ships it — pick the neutral that fits the brand (zinc, stone, neutral, or a custom one).
17. Avoid the terracotta/clay accent (#D97757 area) unless it's actually right — it reads as "Claude built this."
18. Use one accent color with intent, not a gradient wash as filler decoration.
19. Don't apply the same drop-shadow (`shadow-sm`/`shadow-md` defaults) to every card — vary elevation to match actual hierarchy.
20. Dark mode shouldn't just be `bg-black` — use a genuinely dark neutral (near #0A0A0B to #121214) with adjusted accent saturation.
21. Check contrast ratios (WCAG AA minimum) on every text/background pairing, not just the hero.
22. Don't let destructive actions default to shadcn's stock red — confirm it matches your palette.
23. Avoid rainbow/gradient text for headlines as a default flourish.
24. Border colors should be a step off background, not pure `border-gray-200` on every surface regardless of context.
25. Semantic colors (success/warning/error/info) should be tuned to sit in the same palette family, not raw Tailwind red-500/green-500/yellow-500 out of the box.
26. Avoid glassmorphism/frosted blur as a default — only use it where depth genuinely helps.
27. Check color use is consistent for meaning (e.g. the accent color means "primary action" everywhere, not decoration in one place and CTA in another).
28. Don't let every icon default to the same muted gray — icons in context (status, nav) can carry color meaning.

## Layout & spacing (29–42)

29. Don't default to a centered 1200px container with equal padding on every section — vary rhythm section to section.
30. Avoid identical vertical spacing between every section (`py-24` everywhere) — let spacing communicate hierarchy.
31. Don't chop all content into equal-width cards in a 3-column grid by default — ask what structure the content actually has.
32. Check whether a numbered list (01/02/03) is actually a sequence before using numbered markers — most AI output uses them decoratively.
33. Vary alignment intentionally: decide left/center/justified per section, not one rule for the whole page.
34. Avoid symmetric two-column "image left, text right, repeat" sections as the default template for every feature block.
35. Give the hero an intentional focal point — not just headline + subhead + two buttons + vague gradient blob.
36. Don't let every border-radius on the page be the same value — radius should scale with element size/prominence. Default to a small, subtle radius (roughly 4–8px) on standard elements like buttons, inputs, and cards rather than heavy rounding — save larger radii for components where it's a deliberate brand choice.
37. Check whitespace isn't just uniform Tailwind spacing scale applied blindly — group related elements tighter, separate unrelated ones more.
38. Avoid full-bleed sections with a stock "abstract gradient mesh" background as filler.
39. Tables/data-dense views shouldn't be squeezed into card grids just because cards feel "modern" — pick the right layout for the data shape.
40. Check the page doesn't collapse into a single generic scroll of stacked sections with no visual rhythm change.
41. Confirm real responsive behavior at 375px, 768px, 1024px — not just squishing the desktop layout.
42. Nav bar shouldn't default to logo-left, 4 links center, CTA-right unless that's actually right for the product.

## Motion & interaction (43–52)

43. Cut scroll-triggered fade-and-slide-up on every section — it's the single most common AI tell.
44. Cut hover-lift + shadow on every card by default — only animate what genuinely benefits from it.
45. Use one orchestrated moment (page load, key reveal) rather than scattering effects everywhere.
46. Motion should answer a user action (open, confirm, expand) — not run unprompted.
47. Respect `prefers-reduced-motion` for every animation you add.
48. Transitions on interactive elements should use consistent easing/duration tokens, not ad hoc values per component.
49. Don't animate opacity+transform on literally every mounted component "for polish."
50. Loading states should be real skeletons matching final content shape, not a generic spinner slapped everywhere.
51. Toasts/confirmations should match the interface's actual voice, not generic "Success!" copy.
52. Micro-interactions (checkbox check, button press) should feel considered, not left at browser/library defaults untouched.

## shadcn/ui specific (53–72)

53. Don't ship the stock shadcn theme (default zinc/slate + default radius) untouched — treat `components.json` and your CSS variables as a starting point, not the final palette.
54. Customize the CSS variables in `globals.css` (`--primary`, `--radius`, `--background`, etc.) to your actual brand tokens before building screens.
55. Pick a deliberate `--radius` value (or scale of values) instead of leaving the default `0.5rem` everywhere.
56. Don't leave every `Button` at `variant="default"` — use `outline`, `ghost`, `link`, `secondary`, `destructive` with actual intent, not randomly.
57. Avoid stacking `Card` components for every piece of content — shadcn's `Card` is a tool, not the default container for all content.
58. Customize `Badge` colors for real semantic states instead of leaving default gray/black variants everywhere.
59. Don't leave `Input`/`Select`/`Textarea` at stock styling in a product with a distinct visual identity — adjust border, focus ring, and sizing to match.
60. Use the `cn()` utility to compose variants deliberately — don't let className soup accumulate from copy-pasted shadcn examples.
61. Customize focus-visible ring color to match your accent, not the default blue/black ring.
62. Don't use `Dialog` for everything that could be a `Sheet`, `Popover`, or inline expansion — match the pattern to the interaction weight.
63. Check `Toast`/`Sonner` styling matches your palette — default shadcn toasts are a giveaway if untouched.
64. Avoid leaving `Skeleton` components as plain gray bars — shape them to match actual content layout.
65. Don't use shadcn's default chart color palette (`chart-1` through `chart-5`) without checking it against your actual brand palette.
66. Tables (`Table` component) shouldn't default to dense borders on every cell — use row separators intentionally.
67. Customize `Avatar` fallback styling (initials, color) rather than leaving the default gray circle.
68. Don't let `DropdownMenu`/`Command` menus use default spacing/icon sizing without checking density fits your product.
69. Typography inside shadcn components (`CardTitle`, `CardDescription`) should follow your type scale, not the library's default `text-sm`/`text-2xl` assumptions.
70. Check dark mode isn't just shadcn's default dark palette — verify your custom tokens actually propagate through `dark:` variants.
71. Don't leave `Separator` as the default full-opacity border-color line everywhere — vary weight/opacity by context.
72. Audit for shadcn components used purely because they exist (e.g. `Accordion` for content that isn't actually collapsible-by-nature).

## Content & copy (73–84)

73. Write copy from the end user's perspective — name things by what they mean to the user, not by internal system terms.
74. Use active voice in CTAs: "Save changes," not "Submit."
75. Keep the same verb for an action across its whole flow (button "Publish" → toast "Published," not "Success!").
76. Error messages state what happened and how to fix it — no vague "Something went wrong."
77. Errors and system copy don't apologize on behalf of a person ("Oops!") — state facts.
78. Empty states are an invitation to act, not just a muted illustration and gray text.
79. Cut filler intro sentences before getting to real content ("In today's fast-paced world...").
80. Avoid marketing-speak adjectives with no content behind them ("revolutionary," "seamless," "powerful") unless backed by a specific claim.
81. Button labels should be specific to the action, not generic "Learn More" / "Get Started" on every CTA.
82. Check placeholder text in inputs is genuinely helpful (format example), not just repeating the label.
83. Keep tone consistent site-wide — don't mix playful microcopy with formal legal-style copy in adjacent sections.
84. Real content (not lorem ipsum) should be used to test layouts, since fake content hides real wrapping/overflow issues.

## Accessibility & polish floor (85–94)

85. Visible keyboard focus state on every interactive element, not just mouse hover states.
86. Every image has real alt text, not empty strings or filenames.
87. Form inputs have associated `<label>` elements, not placeholder-as-label.
88. Check tab order matches visual order, especially in custom layouts.
89. Color is never the only signal for state (error, success, selected) — pair with icon/text too.
90. Touch targets are at least ~44px on mobile, not shrunk to fit a dense desktop layout.
91. Test with content at real-world length (long names, long numbers) — not just the demo data that fits perfectly.
92. Confirm the page doesn't break with zero data (empty tables, no results) — design that state on purpose.
93. Check meta title/description aren't left as the framework's default ("Create Next App").
94. Favicon and page title reflect the actual product, not framework boilerplate.

## Final critique pass (95–100)

95. Take a screenshot and ask: could this exact screen be the output for a different, unrelated brief with the copy swapped? If yes, it's still generic — revise.
96. Identify the one element meant to be memorable — check everything else is quiet enough to let it stand out.
97. Remove one thing (Chanel rule): find one accessory, badge, gradient, or animation to cut before shipping.
98. Check border-radius, shadow, and spacing values are consistent with a deliberate system, not scattered ad hoc Tailwind classes.
99. Re-run the "5 default clusters" list above against the finished screen — flag any unintentional match.
100. Have a second look after a break — tells are easiest to spot with fresh eyes, not mid-build.
