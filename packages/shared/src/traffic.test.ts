import { describe, expect, it } from 'vitest';
import { classifyTrafficSource, ownHostsFromSiteUrl } from './traffic';

const OWN = ownHostsFromSiteUrl('https://naijacart-roan.vercel.app');

describe('classifyTrafficSource', () => {
  it('never shows localhost or other dev traffic', () => {
    for (const ref of [
      'http://localhost:3000/s/amaka',
      'http://localhost:3002/',
      'http://127.0.0.1:3000/',
      'http://192.168.1.10:3000/',
      'http://10.0.0.5/',
      'http://172.20.3.4/',
      'http://mybox.local/',
      'http://naijavend.test/',
      'file:///C:/Users/mukhtar/index.html',
      'localhost:3000',
    ]) {
      const got = classifyTrafficSource(ref, null, OWN);
      expect(got.ignore, ref).toBe(true);
      expect(got.label, ref).not.toContain('localhost');
    }
  });

  it('labels browsing Naijavend itself as the home page', () => {
    expect(classifyTrafficSource('https://naijacart-roan.vercel.app/', null, OWN)).toMatchObject({ kind: 'home', label: 'Home page' });
    expect(classifyTrafficSource('https://naijacart-roan.vercel.app/s/amaka', null, OWN).label).toBe('Home page');
    // Relative and deploy-URL referrers are still "on our site".
    expect(classifyTrafficSource('/s/amaka', null, OWN).label).toBe('Home page');
    expect(classifyTrafficSource('https://naijacart-hm9qcfv0w-mukhtars-projects-3ebe63be.vercel.app/', null, OWN).label).toBe('Home page');
  });

  it('labels search engines as Search, including country domains', () => {
    expect(classifyTrafficSource('https://www.google.com/', null, OWN).label).toBe('Search');
    expect(classifyTrafficSource('https://google.com.ng/search?q=braids', null, OWN).label).toBe('Search');
    expect(classifyTrafficSource('https://www.bing.com/search?q=x', null, OWN).label).toBe('Search');
    expect(classifyTrafficSource('https://duckduckgo.com/?q=x', null, OWN).label).toBe('Search');
  });

  it('labels other external sites as Link, never echoing the raw host', () => {
    const got = classifyTrafficSource('https://some-random-blog.example.org/post/1', null, OWN);
    expect(got).toMatchObject({ kind: 'link', label: 'Link' });
    expect(got.label).not.toContain('example.org');
  });

  it('keeps recognised social platforms named', () => {
    expect(classifyTrafficSource('https://wa.me/2348012345678', null, OWN).label).toBe('WhatsApp');
    expect(classifyTrafficSource('https://l.instagram.com/', null, OWN).label).toBe('Instagram');
    expect(classifyTrafficSource('https://t.co/abc', null, OWN).label).toBe('X (Twitter)');
  });

  it('uses the share target when the event carries one', () => {
    expect(classifyTrafficSource(null, 'whatsapp', OWN).label).toBe('Shared on WhatsApp');
    expect(classifyTrafficSource(null, 'native', OWN).label).toBe('Shared on the share menu');
  });

  it('treats an empty referrer as direct', () => {
    expect(classifyTrafficSource('', null, OWN)).toMatchObject({ kind: 'direct', label: 'Direct / typed' });
    expect(classifyTrafficSource(null, null, OWN).kind).toBe('direct');
  });

  it('falls back safely for unparseable referrers', () => {
    const got = classifyTrafficSource('not a url', null, OWN);
    expect(got).toMatchObject({ kind: 'link', label: 'Link' });
  });
});

describe('ownHostsFromSiteUrl', () => {
  it('extracts a bare hostname', () => {
    expect(ownHostsFromSiteUrl('https://naijacart-roan.vercel.app/')).toEqual(['naijacart-roan.vercel.app']);
    expect(ownHostsFromSiteUrl('naijacart-roan.vercel.app')).toEqual(['naijacart-roan.vercel.app']);
    expect(ownHostsFromSiteUrl('http://localhost:3000')).toEqual(['localhost']);
  });
});
