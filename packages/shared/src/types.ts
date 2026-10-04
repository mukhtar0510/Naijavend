// Naijavend shared domain types — used by storefront, seller app, and server routes.

export type BusinessType = 'product' | 'service' | 'hybrid';
export type ListingType = 'product' | 'service';
export type OrderStatus = 'pending' | 'paid' | 'fulfilled' | 'cancelled';
export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';
export type Plan = 'free' | 'growth';
export type AiFeature =
  | 'store_setup'
  | 'listing_description'
  | 'style_store'
  | 'assistant_chat'
  | 'social_post';

/** Per-store appearance theme rendered by /s/* pages (one row per store). */
/** Structural templates a store site can use (see packages/shared/src/templates.ts). */
export type StoreLayout = 'modern' | 'classic' | 'bold' | 'minimal' | 'boutique' | 'merchant' | 'luxury' | 'playful' | 'sunset' | 'marketplace' | 'editorial' | 'neon' | 'pastel' | 'monochrome' | 'showcase' | 'festival' | 'artisan' | 'executive' | 'aurora' | 'corner';

export interface StoreTheme {
  store_id: string;
  accent_color: string;
  accent_soft: string;
  accent_text: string;
  font_heading: string;
  font_body: string;
  layout: StoreLayout;
  hero_style: 'gradient' | 'image' | 'solid';
  banner_url: string | null;
  favicon_url: string | null;
  logo_url: string | null;
  subheader_url: string | null;
  background_color: string;
  /** Optional site-wide body text colour (null = theme default). */
  text_color: string | null;
  /** Optional heading text colour (null = same as text). */
  heading_color: string | null;
  /** Optional secondary/muted text colour (null = theme default). */
  muted_color: string | null;
  /** Call-to-action shape across the store site. */
  button_shape: 'pill' | 'rounded' | 'square';
  /** Product-card surface treatment. */
  card_style: 'soft' | 'outline' | 'shadow';
  /** Optional heading/text colour inside product cards (null = inherit site heading/text). */
  listing_color: string | null;
  /** Optional product-card background colour (null = theme surface). */
  listing_bg_color: string | null;
  /** Product-card corners: 'sharp' = square edges, 'rounded' = theme default. null = rounded. */
  card_radius: string | null;
  /** Product-card surface look (plain/gradient/glass/outlined/elevated). */
  listing_style: string | null;
  /** Product-card hover animation (none/lift/tilt/zoom/glow/wiggle). */
  hover_anim: string | null;
  /** Optional site-wide background photo/pattern URL (null = flat colour / gradient). */
  background_image_url: string | null;
  /** How the background photo fills the page: 'cover' (single image) or 'tile' (repeating pattern). */
  background_image_style: string | null;
  /** Darkening overlay over the background photo ('none'/'dim'/'dark') so text stays readable. */
  background_overlay: string | null;
  /** Site-wide background gradient preset key (see BACKGROUND_GRADIENTS; null = none). */
  background_gradient: string | null;
  /** Page container width on the store site ('narrow'/'normal'/'wide'; null = normal). */
  content_width: string | null;
  /** Optional hero band background colour (null = theme default). */
  hero_bg_color: string | null;
  /** Optional background colour behind the product-grid sections (null = page background). */
  grid_bg_color: string | null;
  /** Optional footer background colour (null = theme default). */
  footer_bg_color: string | null;
  /** 1–5 uploaded photos of the shop itself, shown as a gallery on the store site. */
  gallery_urls?: string[] | null;
  updated_at: string;
}

/** A physical branch of a store (multi-location): Store 1, Store 2, … */
export interface StoreLocation {
  id: string;
  store_id: string;
  label: string;
  position: number;
  address: string;
  latitude: number | null;
  longitude: number | null;
  phone: string;
  note: string;
  business_hours: BusinessHours | null;
}

/** Per-day open/close times for a store; null day (or missing) = closed. */
export type BusinessHours = Partial<Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', [string, string] | null>>;

export const BUSINESS_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

export interface Store {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  business_type: BusinessType;
  category: string;
  description: string;
  ai_generated_description: boolean;
  logo_url: string | null;
  address: string;
  latitude: number | null;
  longitude: number | null;
  whatsapp_number: string;
  plan: Plan;
  business_hours: BusinessHours | null;
  announcement: string | null;
  announcement_starts_at: string | null;
  announcement_ends_at: string | null;
  delivery_info: string | null;
  is_dropshipper: boolean;
  dropship_info: string | null;
  verification_status: 'unverified' | 'verified';
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Listing {
  id: string;
  store_id: string;
  type: ListingType;
  title: string;
  description: string;
  ai_generated_description: boolean;
  price_kobo: number;
  compare_at_kobo: number | null;
  stock: number | null;
  is_bookable: boolean;
  image_urls: string[];
  video_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  store_id: string;
  customer_name: string;
  customer_phone: string;
  total_kobo: number;
  discount_code: string | null;
  discount_kobo: number;
  status: OrderStatus;
  payment_reference: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  listing_id: string;
  quantity: number;
  unit_price_kobo: number;
  created_at: string;
}

export interface Booking {
  id: string;
  listing_id: string;
  customer_name: string;
  customer_phone: string;
  slot_start: string;
  slot_end: string;
  status: BookingStatus;
  deposit_paid_kobo: number;
  created_at: string;
  updated_at: string;
}

export interface StoreRating {
  id: string;
  store_id: string;
  customer_phone: string;
  order_id: string | null;
  booking_id: string | null;
  stars: number;
  comment: string;
  created_at: string;
}

export interface StoreRatingStats {
  store_id: string;
  review_count: number;
  avg_stars: number;
  weighted_score: number;
  overall_rank: number | null;
  category_rank: number | null;
  updated_at: string;
}

export interface WhatsAppSettings {
  store_id: string;
  business_number: string;
  greeting_message: string;
  catalog_enabled: boolean;
}

export type ChatSender = 'customer' | 'seller';

export interface ChatMessage {
  id: string;
  store_id: string;
  customer_id: string | null;
  sender: ChatSender;
  body: string;
  created_at: string;
}

/** Social handles a seller can attach to their store site. */
export interface StoreSocialLinks {
  instagram?: string;
  twitter?: string;
  facebook?: string;
  tiktok?: string;
  youtube?: string;
}

export type StoreEventType = 'view' | 'listing_view' | 'share' | 'link_copy' | 'chat_started';

/** One anonymous analytics event from a public store site. */
export interface StoreEvent {
  id: string;
  store_id: string;
  event_type: StoreEventType;
  path: string | null;
  referrer: string | null;
  source: string | null;
  created_at: string;
}

export interface AiStoreDraft {
  name: string;
  description: string;
  category: string;
}

export interface AiListingDraft {
  description: string;
}

export interface AiStyleDraft {
  accent_color: string;
  accent_soft: string;
  accent_text: string;
  font_heading: string;
  font_body: string;
  layout: StoreLayout;
  hero_style: 'gradient' | 'image' | 'solid';
  background_color: string;
  /** Optional per-site text colours — required for dark-background presets. */
  text_color?: string | null;
  heading_color?: string | null;
  muted_color?: string | null;
  note: string;
}

/** Seller-assistant chat reply (feature: assistant_chat). */
export interface AiAssistantDraft {
  reply: string;
}

/** Ready-to-share social caption (feature: social_post). */
export interface AiSocialPostDraft {
  post: string;
}
