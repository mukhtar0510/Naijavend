// The one category map for the app UI: icon (Lucide) + colour group + label.
// Replaces the emoji map (`categoryEmoji` in @idevtenancy/shared) everywhere
// in the UI. Slugs come from STORE_CATEGORIES in the shared package.
//
// Colour groups follow REDESIGN.md 2.6 and live as tokens (--cat-<group>) in
// styles/tokens.css, so a category never relies on colour alone: it always
// shows its icon and its text label too.

import type { LucideIcon } from 'lucide-react';
import {
  Baby,
  Briefcase,
  Brush,
  Camera,
  Car,
  Code,
  CookingPot,
  Download,
  Dumbbell,
  Gamepad2,
  Gem,
  GraduationCap,
  HeartPulse,
  House,
  Megaphone,
  Music,
  Package,
  Palette,
  PartyPopper,
  PawPrint,
  Printer,
  Scissors,
  Shirt,
  ShoppingBasket,
  Smartphone,
  Sofa,
  Sparkles,
  Sprout,
  Store,
  Truck,
  Utensils,
  WashingMachine,
  Wrench,
} from 'lucide-react';
import { categoryLabel } from '@idevtenancy/shared';

/** Colour groups (REDESIGN 2.6). Each maps to --cat-<group> in tokens.css. */
export type CategoryGroup =
  | 'food'
  | 'cakes'
  | 'beauty'
  | 'hair'
  | 'fashion'
  | 'accessories'
  | 'gadgets'
  | 'groceries'
  | 'home'
  | 'tutors'
  | 'other';

export interface CategoryMeta {
  id: string;
  label: string;
  icon: LucideIcon;
  group: CategoryGroup;
}

const DEFS: Record<string, { icon: LucideIcon; group: CategoryGroup }> = {
  food: { icon: Utensils, group: 'food' },
  kitchen: { icon: CookingPot, group: 'food' },
  beauty: { icon: Sparkles, group: 'beauty' },
  'health-wellness': { icon: HeartPulse, group: 'beauty' },
  laundry: { icon: WashingMachine, group: 'home' },
  fashion: { icon: Shirt, group: 'fashion' },
  'baby-kids': { icon: Baby, group: 'fashion' },
  jewelry: { icon: Gem, group: 'accessories' },
  crafts: { icon: Scissors, group: 'accessories' },
  art: { icon: Palette, group: 'accessories' },
  electronics: { icon: Smartphone, group: 'gadgets' },
  software: { icon: Code, group: 'gadgets' },
  'digital-products': { icon: Download, group: 'gadgets' },
  gaming: { icon: Gamepad2, group: 'gadgets' },
  groceries: { icon: ShoppingBasket, group: 'groceries' },
  agriculture: { icon: Sprout, group: 'groceries' },
  'home-services': { icon: Wrench, group: 'home' },
  furniture: { icon: Sofa, group: 'home' },
  'real-estate': { icon: House, group: 'home' },
  auto: { icon: Car, group: 'home' },
  education: { icon: GraduationCap, group: 'tutors' },
  music: { icon: Music, group: 'tutors' },
  fitness: { icon: Dumbbell, group: 'other' },
  photography: { icon: Camera, group: 'other' },
  events: { icon: PartyPopper, group: 'other' },
  marketing: { icon: Megaphone, group: 'other' },
  pets: { icon: PawPrint, group: 'other' },
  logistics: { icon: Truck, group: 'other' },
  dropshippers: { icon: Package, group: 'other' },
  printing: { icon: Printer, group: 'other' },
  'professional-services': { icon: Briefcase, group: 'other' },
  general: { icon: Store, group: 'other' },
};

// Brush is kept for future "hair" categories (braids, barbing).
export const HAIR_ICON: LucideIcon = Brush;

export function categoryMeta(id: string): CategoryMeta {
  const def = DEFS[id] ?? DEFS.general;
  return { id, label: categoryLabel(id), icon: def.icon, group: def.group };
}

/** CSS colour for a category (a token, never a hex). */
export function categoryColor(id: string): string {
  return `var(--cat-${categoryMeta(id).group})`;
}

/**
 * Category icon. Decorative by default (aria-hidden) because it is always
 * shown next to the category's text label; pass `label` when it stands alone.
 */
export function CategoryIcon({
  category,
  size = 16,
  label,
  tinted = true,
  className,
}: {
  category: string;
  size?: 16 | 20 | 24 | 32 | number;
  label?: string;
  tinted?: boolean;
  className?: string;
}) {
  const { icon: Icon } = categoryMeta(category);
  return (
    <Icon
      size={size}
      strokeWidth={2}
      className={className}
      style={tinted ? { color: categoryColor(category) } : undefined}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
      focusable={false}
    />
  );
}
