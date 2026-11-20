// The seller theme font library. Twenty-one families is ~1.6 s of render-blocking
// CSS, so it must never load on the marketplace: it is only mounted where a
// theme's font is actually rendered — public store pages and the appearance
// editors. The core Sora/Inter/JetBrains trio stays in the root layout.
const THEME_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Space+Grotesk:wght@500;700&family=Manrope:wght@400;600;700;800&family=Outfit:wght@400;600;700;800&family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Urbanist:wght@400;600;700;800&family=Playfair+Display:ital,wght@0,600;0,700;0,800;1,600;1,700&family=Merriweather:wght@400;700;900&family=Lora:ital,wght@0,400;0,600;0,700;1,600&family=Libre+Baskerville:wght@400;700&family=Fraunces:ital,wght@0,500;0,700;0,900;1,600&family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,600&family=Bricolage+Grotesque:wght@400;600;700;800&family=Bebas+Neue&family=Unbounded:wght@400;600;700;800&family=Oswald:wght@400;500;600;700&family=Dancing+Script:wght@500;600;700&family=Pacifico&family=Great+Vibes&family=Satisfy&family=Caveat:wght@500;600;700&display=swap';

export function ThemeFonts() {
  return <link rel="stylesheet" href={THEME_FONTS_HREF} />;
}
