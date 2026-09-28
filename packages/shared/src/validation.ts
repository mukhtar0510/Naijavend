// Input validation — used at every server boundary (backend skill #26).
import type { BusinessType, ListingType } from './types';

export function isValidPhone(phone: string): boolean {
  // International format only: optional '+', 7-15 digits, no leading zero
  // (rejects local formats like 08012345678 — must be +2348012345678).
  return /^\+?[1-9][0-9]{6,14}$/.test(phone);
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length >= 2 && slug.length <= 80;
}

export function sanitizeText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, maxLength);
}

export function parsePriceKobo(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n > 1_000_000_000) {
    return null;
  }
  return n;
}

export function isBusinessType(v: unknown): v is BusinessType {
  return v === 'product' || v === 'service' || v === 'hybrid';
}

export function isListingType(v: unknown): v is ListingType {
  return v === 'product' || v === 'service';
}

export function isStars(v: unknown): v is 1 | 2 | 3 | 4 | 5 {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 5;
}

export interface CartLineInput {
  listingId: string;
  quantity: number;
}

export function parseCartLines(value: unknown): CartLineInput[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 50) return null;
  const lines: CartLineInput[] = [];
  for (const item of value) {
    if (
      typeof item !== 'object' || item === null ||
      typeof (item as Record<string, unknown>).listingId !== 'string' ||
      typeof (item as Record<string, unknown>).quantity !== 'number' ||
      !Number.isInteger((item as Record<string, unknown>).quantity) ||
      ((item as Record<string, unknown>).quantity as number) < 1 ||
      ((item as Record<string, unknown>).quantity as number) > 999
    ) {
      return null;
    }
    lines.push({
      listingId: (item as Record<string, unknown>).listingId as string,
      quantity: (item as Record<string, unknown>).quantity as number,
    });
  }
  return lines;
}
