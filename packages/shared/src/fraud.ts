// Fraud / trust-safety heuristics (blueprint §4 extension).
//
// Deterministic, dependency-free checks that run on EVERY text written through
// the platform before any model is consulted: chat messages, reviews and
// listing titles. They are deliberately conservative — a hit means "route this
// to a human or a model for a second look", never "block this user".
//
// Scam vocabulary is Nigerian-market specific: the frauds that actually reach
// marketplace chat (pay-outside-the-platform, advance fee, OTP/bank credential
// harvesting, urgency pressure). False positives are kept cheap by requiring a
// phrase hit rather than a single ambiguous word where the word is innocent in
// normal trading conversation ("transfer" alone never fires).

export type FraudLabel =
  | 'off_platform_payment' // asked to pay outside Naijavend
  | 'credentials_request' // OTP, PIN, card number, BVN, password
  | 'advance_fee' // fees, "clearance", "activation" paid up-front
  | 'impersonation' // staff, brigade, delivery agent impersonation
  | 'urgency_threat' // account will be closed, arrest, "last warning"
  | 'contact_harvest' // move the deal to an off-platform channel
  | 'external_link'; // shortened / suspicious outbound link

/** Phrase-level rules. Each is [label, pattern]; patterns are applied to a
 * lower-cased, whitespace-collapsed copy of the message. The `m` words inside a
 * group are alternatives. */
const SCAM_RULES: ReadonlyArray<readonly [FraudLabel, RegExp]> = [
  ['off_platform_payment', /\b(pay|payment|send|paying|paid|send am|wire)\b[^.!?\n]{0,40}\b(outside|off)\s+(the\s+)?(platform|site|app|system)\b/i],
  ['off_platform_payment', /\b(pay|payment|send|transfer)\b[^.!?\n]{0,40}\b(directly\s+to\s+(my|our)|to\s+my\s+(personal|personal\s+acct?|opay|kuda|palmpay|moniepoint|sterling|gtb|zenith|access|uba|first\s+bank))\b/i],
  ['off_platform_payment', /\b(don'?t|do\s+not|no\s+need\s+to|avoid)\b[^.!?\n]{0,40}\b(pay|paying|use)\b[^.!?\n]{0,30}\b(on|through|via|inside)\b[^.!?\n]{0,20}\b(naijavend|the\s+site|the\s+platform|the\s+app)\b/i],
  ['advance_fee', /\b(pay|send)\b[^.!?\n]{0,30}\b(fee|fees|charge|charges|levy|clearance|activation|verification fee|upgrade fee|deposit)\b[^.!?\n]{0,40}\b(first|before|beforehand|upfront|up-front)\b/i],
  ['advance_fee', /\b(send|pay)\b[^.!?\n]{0,30}\b(gift\s+card|airtime\s+top[- ]?up|crypto|bitcoin|usdt|trc20|western\s+union|ria|money\s+gram)\b/i],
  ['credentials_request', /\b(otp|one[- ]?time\s+password|pin\s+code|bvn|nin|card\s+number|cvv|expiry\s+date|account\s+password|bank\s+details)\b/i],
  ['credentials_request', /\b(kindly|please|abeg|please\s+share)\b[^.!?\n]{0,30}\b(confirm|send|enter|give)\b[^.!?\n]{0,30}\b(otp|code|password|pin|token)\b/i],
  ['impersonation', /\b(i\s+am|i'?m)\b[^.!?\n]{0,40}\b(from|of)\b[^.!?\n]{0,30}\b(naijavend\s+(staff|support|team|admin)|customer\s+care|efcc|fccpc|police|army|military)\b/i],
  ['impersonation', /\b(this\s+is|here\s+is)\b[^.!?\n]{0,30}\b(your\s+)?(delivery\s+rider|dispatch|rider)\b[^.!?\n]{0,40}\b(pay|send)\b/i],
  ['urgency_threat', /\b(your\s+(account|store|listing|page))\b[^.!?\n]{0,40}\b(will\s+be\s+(closed|banned|suspended|deleted)|is\s+going\s+to\s+be\s+(closed|banned))\b/i],
  ['urgency_threat', /\b(within|in)\b\s+(\d{1,3}\s+)?(minutes|mins|hours)\b[^.!?\n]{0,40}\b(otherwise|or\s+else|if\s+not)\b/i],
  ['contact_harvest', /\b(add|send|hit)\s+me\s+(up\s+)?on\b[^.!?\n]{0,40}\b(whatsapp|telegram|instagram|dm|gmail|yahoo)\b/i],
  ['contact_harvest', /\bmy\s+(personal\s+)?whatsapp\s+(number|line|no\.?)\b[^.!?\n]{0,30}\b(is|=|\+?\d{7,})\b/i],
  ['external_link', /\b(https?:\/\/)?(bit\.ly|tinyurl\.com|t\.me|wa\.me\/\d{10,}|chat\.whatsapp\.com\/[A-Za-z0-9]{10,})\b/i],
];

/** Human-facing explanations, keyed by label — shown to sellers/staff so a
 * flag is never a bare red dot. */
export const FRAUD_LABEL_TEXT: Record<FraudLabel, string> = {
  off_platform_payment: 'Asks to pay outside Naijavend',
  credentials_request: 'Asks for an OTP, PIN or bank details',
  advance_fee: 'Up-front fee or gift-card request',
  impersonation: 'Claims to be staff, police or a delivery agent',
  urgency_threat: 'Uses threats or a countdown to pressure you',
  contact_harvest: 'Tries to move the chat off the platform',
  external_link: 'Sends an external or shortened link',
};

/**
 * Scan one message body for scam vocabulary. Returns the stable labels that
 * matched, de-duplicated, in rule order. An empty array is the expected result
 * for ordinary trading conversation.
 */
export function detectScamPhrases(text: unknown): FraudLabel[] {
  if (typeof text !== 'string' || text.length === 0) return [];
  const normalised = text.replace(/\s+/g, ' ').trim();
  // Per-category normalization rules that a raw pattern can't express.
  const lowered = normalised.toLowerCase();
  const out: FraudLabel[] = [];
  for (const [label, pattern] of SCAM_RULES) {
    if (pattern.test(normalised) || pattern.test(lowered)) {
      if (!out.includes(label)) out.push(label);
    }
  }
  // Payment handles pasted as bare text (0123456789 opay / acct: 1234567890).
  if (/\b(opay|kuda|palmpay|moniepoint|grey\b|barter\b)\b[^.!?\n]{0,20}\b\d{6,12}\b/i.test(normalised)) {
    if (!out.includes('off_platform_payment')) out.push('off_platform_payment');
  }
  if (/\b(acct?|a\/c|account\s*(no|number)?)\s*[:#]?\s*\d{6,12}\b/i.test(normalised)) {
    if (!out.includes('off_platform_payment')) out.push('off_platform_payment');
  }
  return out;
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

export interface ReviewVerdict {
  flagged: boolean;
  labels: string[];
  note: string;
}

const REVIEW_RULES: ReadonlyArray<readonly [string, RegExp]> = [
  ['promotion', /\b(follow\s+me|check\s+my\s+(page|store|status)|visit\s+my|free\s+giveaway|win\s+\d)/i],
  ['link', /\b(https?:\/\/|www\.|bit\.ly|\.com\/)\S*/i],
  ['contact_offplatform', /\b(whatsapp\s+(me|us)|dm\s+me|call\s+me\s+on|add\s+me\s+on)\b/i],
  ['irrelevant', /\b(nice|good|ok|okay|cool|fine)\s*[.!]?\s*$/i], // a bare "good." adds nothing
  ['repetition', /(.)\1{9,}/], // "aaaaaaa…" or "lovelylovely…"
];

/**
 * Does this review look fake, spammy or useless? Guarded by two facts the
 * submit-rating route already establishes — verified purchase and one review
 * per phone per store — so this only catches content-shaped problems, and the
 * comment must exist to be judged at all.
 */
export function assessReview(comment: unknown, stars: unknown): ReviewVerdict {
  const text = typeof comment === 'string' ? comment.trim() : '';
  const labels: string[] = [];

  // A 5-star (or 1-star) comment of only filler carries no signal — the
  // rankings weight it, so it is worth a second look rather than a block.
  const fillerOnly = text.length > 0 && text.length <= 12 && REVIEW_RULES[3][1].test(text);
  if (fillerOnly) labels.push('irrelevant');

  // Promotion / links / off-platform harvesting are clearly not a review.
  for (const [label, pattern] of REVIEW_RULES) {
    if (label === 'irrelevant') continue;
    if (pattern.test(text)) labels.push(label);
  }

  // ALL-CAPS walls ("BEST STORE EVER!!!") are a classic review-bomb signal.
  const letters = text.match(/[A-Za-z]/g) ?? [];
  if (letters.length >= 20) {
    const upper = letters.filter((c) => c === c.toUpperCase()).length;
    if (upper / letters.length > 0.85) labels.push('shouting');
  }

  const unique = [...new Set(labels)];
  return {
    flagged: unique.length > 0,
    labels: unique,
    note: unique.length === 0 ? '' : 'Review matches one or more suspicious-content patterns.',
  };
}

// ---------------------------------------------------------------------------
// Stores
// ---------------------------------------------------------------------------

/** Signals that a NEW store is more likely than not a scam page:
 * investment/ROI promises and claims of official Naijavend status — the two
 * claims that reported fake stores on Nigerian marketplaces actually make. */
const STORE_SIGNALS: ReadonlyArray<readonly [string, RegExp]> = [
  ['guaranteed_returns', /\bguarante(?:ed|e|d)?\b[^.!?\n]{0,60}\b(profit|return|returns|interest|earnings?|income)\b/i],
  ['guaranteed_returns', /\b(double|triple)\s+your\s+(money|capital|investment|profits?)\b/i],
  ['guaranteed_returns', /\b\d{1,3}\s*%\s*(roi|profit|return|weekly|daily|monthly|interest)\b/i],
  ['investment_scam', /\b(forex|forexx|bitcoin|btc|usdt|trc20|trading)\b[^.!?\n]{0,60}\b(invest|investors?|profit|returns?|earn)\b/i],
  ['investment_scam', /\binvest\s+(and|to|to\s+start)\s+(earn|make|get|receive)\b/i],
  // "Guaranteed 50% ROI weekly when you invest with us" — the return figure
  // precedes the verb in the copy every one of these scams actually uses.
  ['investment_scam', /\b(roi|returns?|profits?|passive\s+income)\b[^.!?\n]{0,60}\b(invest(?:ment|ors?)?|earn|staking)\b/i],
  ['fake_official', /\b(official|verified|approved|accredited)\b[^.!?\n]{0,30}\b(partner|dealer|representative)?\s*of\s+naijavend\b/i],
  ['fake_official', /\b(official|authorized|authorised)\s+naijavend\b/i],
  ['fake_official', /\bnaijavend\s+(staff|admin|team|management)\b/i],
];

/** Human-readable notes for each store signal (kept next to the rules so a
 * reader of moderation_flags always has a sentence to show staff). */
export const STORE_SIGNAL_TEXT: Record<string, string> = {
  guaranteed_returns: 'Promises guaranteed returns or a fixed percentage of profit',
  investment_scam: 'Investment/crypto earnings claim',
  fake_official: 'Claims official Naijavend status',
};

/** Scan a store's name/description/announcement for fake-store signals. */
export function detectStoreSignals(text: unknown): string[] {
  if (typeof text !== 'string' || text.length === 0) return [];
  const out: string[] = [];
  for (const [label, pattern] of STORE_SIGNALS) {
    if (pattern.test(text) && !out.includes(label)) out.push(label);
  }
  return out;
}

/**
 * Near-duplicate detection across a store's texts (same word, same review, a
 * listing title the seller already has). Normalises case, punctuation and
 * spacing, then scores Jaccard similarity over word sets so re-ordered or
 * lightly-edited copies still collide.
 */
export function normaliseForDuplicate(text: unknown): string {
  if (typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function duplicateSimilarity(a: string, b: string): number {
  const wa = new Set(normaliseForDuplicate(a).split(' ').filter((w) => w.length > 1));
  const wb = new Set(normaliseForDuplicate(b).split(' ').filter((w) => w.length > 1));
  if (wa.size === 0 || wb.size === 0) return 0;
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared += 1;
  return shared / (wa.size + wb.size - shared);
}

export function containment(a: string, b: string): number {
  const wa = new Set(normaliseForDuplicate(a).split(' ').filter((w) => w.length > 1));
  const wb = new Set(normaliseForDuplicate(b).split(' ').filter((w) => w.length > 1));
  if (wa.size === 0 || wb.size === 0) return 0;
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared += 1;
  return shared / Math.min(wa.size, wb.size);
}

/**
 * True when `candidate` duplicates an existing listing title.
 *
 * Jaccard alone is too strict here: "Silk Bonnet — Black" vs "Silk Bonnet
 * Black (Extra Large)" scores 0.60 simply because one side has two more words,
 * yet any human would call that the same listing. So a title also duplicates
 * when every content word of one appears in the other (containment ≥ 0.8).
 */
export function isDuplicateTitle(candidate: string, existing: readonly string[]): boolean {
  const normalised = normaliseForDuplicate(candidate);
  if (normalised.length < 8) return false;
  return existing.some(
    (t) => duplicateSimilarity(candidate, t) >= 0.7 || containment(candidate, t) >= 0.8,
  );
}