import { describe, it, expect } from 'vitest';
import { isValidHexColor } from './colors';

describe('isValidHexColor', () => {
  it('accepts valid 6-digit hex colours', () => {
    expect(isValidHexColor('#1D4ED8')).toBe(true);
    expect(isValidHexColor('#ffffff')).toBe(true);
    expect(isValidHexColor('#0B0C0E')).toBe(true);
  });

  it('rejects malformed colours', () => {
    expect(isValidHexColor('1D4ED8')).toBe(false);
    expect(isValidHexColor('#12345')).toBe(false);
    expect(isValidHexColor('#1234567')).toBe(false);
    expect(isValidHexColor('')).toBe(false);
    expect(isValidHexColor('#gggggg')).toBe(false);
  });

  it('accepts readable text/background pairs', () => {
    expect(isValidHexColor('#1D4ED8', '#FFFFFF')).toBe(true); // white on blue
    expect(isValidHexColor('#FFFFFF', '#0B0C0E')).toBe(true); // black on white
    expect(isValidHexColor('#BE1E6B', '#FFFFFF')).toBe(true); // white on deep rose
  });

  it('rejects unreadable text/background pairs', () => {
    expect(isValidHexColor('#FFFFFF', '#FFFFFF')).toBe(false); // white on white
    expect(isValidHexColor('#F6C344', '#FFFFFF')).toBe(false); // white on light amber
    expect(isValidHexColor('nope', '#FFFFFF')).toBe(false);
  });
});
