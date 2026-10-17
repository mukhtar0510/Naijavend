import { describe, expect, it } from 'vitest';
import {
  assessReview, containment, detectScamPhrases, duplicateSimilarity,
  isDuplicateTitle, normaliseForDuplicate, detectStoreSignals,
} from './fraud';

// The rules must fire on real Nigerian-market scam scripts and stay silent on
// ordinary trading conversation — a false positive here scares honest buyers.

describe('detectScamPhrases', () => {
  it('flags paying outside the platform', () => {
    expect(detectScamPhrases('Please pay outside the platform, it is faster.')).toContain('off_platform_payment');
  });

  it('flags a personal account number handed over in chat', () => {
    expect(detectScamPhrases('Just pay to my opay 8012345678')).toContain('off_platform_payment');
    expect(detectScamPhrases('acct: 1234567890 is fine')).toContain('off_platform_payment');
  });

  it('flags OTP harvesting', () => {
    expect(detectScamPhrases('Kindly send me the OTP so I can confirm you')).toContain('credentials_request');
    expect(detectScamPhrases('what is your bvn?')).toContain('credentials_request');
  });

  it('flags up-front fees and gift-card payment', () => {
    expect(detectScamPhrases('Pay the clearance fee first before delivery')).toContain('advance_fee');
    expect(detectScamPhrases('Pay with a gift card instead')).toContain('advance_fee');
  });

  it('flags impersonation and countdown pressure', () => {
    expect(detectScamPhrases('I am from Naijavend support team, verify now')).toContain('impersonation');
    expect(detectScamPhrases('Your account will be closed within 2 hours otherwise')).toContain('urgency_threat');
  });

  it('flags moving the deal off-platform and shortened links', () => {
    expect(detectScamPhrases('add me on telegram for cheaper price')).toContain('contact_harvest');
    expect(detectScamPhrases('see it here bit.ly/abc123')).toContain('external_link');
  });

  it('stays silent on ordinary trading conversation', () => {
    for (const ok of [
      'How much is the bonnet? I go pay today',
      'Do you deliver to Ibadan? How much for two?',
      'The size 42 is available na, I want it',
      'Good morning, is the rice still in stock?',
      'Please can I get a discount for buying 3?',
      '',
    ]) {
      expect(detectScamPhrases(ok), `expected no flags for: ${ok}`).toEqual([]);
    }
  });
});

describe('assessReview', () => {
  it('flags promotional and link-bearing reviews', () => {
    expect(assessReview('Check my page for cheap wigs 👀', 5).flagged).toBe(true);
    expect(assessReview('Great shop, see www.example.com/buy now', 5).labels).toContain('link');
  });

  it('flags filler-only, off-topic and shouted reviews', () => {
    expect(assessReview('good.', 5).labels).toContain('irrelevant');
    expect(assessReview('THE BEST STORE EVER THE BEST STORE EVER THE BEST', 5).labels).toContain('shouting');
  });

  it('passes a genuine review', () => {
    const v = assessReview('Fast delivery to Yaba and the fabric was exactly as pictured.', 5);
    expect(v.flagged).toBe(false);
    expect(v.labels).toEqual([]);
  });

  it('needs no comment to make a verdict', () => {
    expect(assessReview('', 5).flagged).toBe(false);
  });
});

describe('duplicate listings', () => {
  it('normalises case, punctuation and spacing', () => {
    expect(normaliseForDuplicate('  Silk Bonnet — BLACK!! ')).toBe('silk bonnet black');
  });

  it('scores identical text 1 and unrelated text 0', () => {
    expect(duplicateSimilarity('Ankara two piece set', 'Ankara two piece set')).toBe(1);
    expect(duplicateSimilarity('Ankara two piece set', 'Generator repair service')).toBe(0);
  });

  it('catches a re-worded duplicate but not a genuine variant', () => {
    expect(isDuplicateTitle('Silk Bonnet — Black', ['Silk bonnet black extra large'])).toBe(true);
    expect(
      isDuplicateTitle('Silk Bonnet — Black', ['Ankara two piece set', 'Barbing appointment'])
    ).toBe(false);
  });

  it('ignores titles too short to compare', () => {
    expect(isDuplicateTitle('Rice', ['Rice bag 50kg'])).toBe(false);
  });

  it('flags investment/ROI and fake-official store claims', () => {
    expect(detectStoreSignals('Guaranteed 50% ROI weekly when you invest with us')).toEqual(
      expect.arrayContaining(['guaranteed_returns', 'investment_scam'])
    );
    expect(detectStoreSignals('We are the official Naijavend partner in Kaduna')).toContain('fake_official');
    expect(detectStoreSignals('Double your money in 7 days, forexx trading')).toEqual(
      expect.arrayContaining(['guaranteed_returns'])
    );
  });

  it('passes a normal store description', () => {
    expect(detectStoreSignals('We sew aso ebi for owambe and deliver within Lagos state.')).toEqual([]);
    expect(detectStoreSignals('')).toEqual([]);
  });

  it('containment is symmetric for shared content', () => {
    expect(containment('Ankara two piece', 'Ankara two piece set for owambe')).toBe(1);
    expect(containment('Ankara two piece', 'Ankara two piece set')).toBeCloseTo(1);
  });
});