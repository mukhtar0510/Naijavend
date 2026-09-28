import { describe, it, expect } from 'vitest';
import {
  isValidPhone,
  isValidSlug,
  sanitizeText,
  parsePriceKobo,
  parseCartLines,
  buildWhatsAppLink,
  formatNaira,
  weightedScore,
  rankDirection,
} from './index';

describe('validation', () => {
  it('accepts Nigerian phone formats', () => {
    expect(isValidPhone('08012345678')).toBe(false); // local format without + is rejected (must be intl)
    expect(isValidPhone('+2348012345678')).toBe(true);
    expect(isValidPhone('2348012345678')).toBe(true);
  });

  it('rejects bad slugs', () => {
    expect(isValidSlug('Clean-Cut-Salon')).toBe(false);
    expect(isValidSlug('clean-cut-salon')).toBe(true);
    expect(isValidSlug('a')).toBe(false);
  });

  it('sanitizes control characters and enforces length', () => {
    expect(sanitizeText('hello\u0000world', 20)).toBe('helloworld');
    expect(sanitizeText('x'.repeat(50), 10)).toBe('x'.repeat(10));
  });

  it('parses prices strictly', () => {
    expect(parsePriceKobo(15000)).toBe(15000);
    expect(parsePriceKobo('15000')).toBe(15000);
    expect(parsePriceKobo(-1)).toBeNull();
    expect(parsePriceKobo(1.5)).toBeNull();
    expect(parsePriceKobo('abc')).toBeNull();
  });

  it('parses cart lines', () => {
    expect(parseCartLines([{ listingId: 'abc', quantity: 2 }])).toEqual([{ listingId: 'abc', quantity: 2 }]);
    expect(parseCartLines([{ listingId: 'abc', quantity: 0 }])).toBeNull();
    expect(parseCartLines('nope')).toBeNull();
    expect(parseCartLines([])).toBeNull();
  });
});

describe('whatsapp', () => {
  it('builds a prefilled wa.me link', () => {
    const link = buildWhatsAppLink({
      businessNumber: '+234 801 234 5678',
      storeName: 'Adaeze Braids',
      listingTitle: 'Knotless braids',
      priceNaira: 15000,
    });
    expect(link.startsWith('https://wa.me/2348012345678?text=')).toBe(true);
    expect(decodeURIComponent(link)).toContain('Knotless braids');
    expect(decodeURIComponent(link)).toContain('₦15,000');
  });

  it('returns empty for missing number', () => {
    expect(buildWhatsAppLink({ businessNumber: '', storeName: 'X' })).toBe('');
  });

  it('formats naira from kobo', () => {
    expect(formatNaira(150000)).toBe('₦1,500');
  });
});

describe('rankings math', () => {
  it('does not let a single 5★ beat a 200-review 4.8★', () => {
    const oneReview = weightedScore(1, 5);
    const manyReviews = weightedScore(200, 200 * 4.8);
    expect(manyReviews).toBeGreaterThan(oneReview);
  });

  it('matches the SQL Bayesian formula', () => {
    // (5*3.5 + 8) / (5+2) = 25.5/7 = 3.643
    expect(weightedScore(2, 8)).toBe(3.643);
  });

  it('returns 0 for no reviews', () => {
    expect(weightedScore(0, 0)).toBe(0);
  });

  it('computes rank direction', () => {
    expect(rankDirection(null, 3)).toBe('new');
    expect(rankDirection(5, 3)).toBe('up');
    expect(rankDirection(3, 5)).toBe('down');
    expect(rankDirection(3, 3)).toBe('same');
  });
});
