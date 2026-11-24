// A row of hashtag chips, hottest first. "On heat" marks a tag whose
// attention mostly arrived in the last 48 hours (see lib/trending.ts).
import Link from 'next/link';
import { Flame, Hash } from 'lucide-react';
import type { TrendingTag } from '@/lib/trending';

export function TrendingTags({ tags, title = 'Trending hashtags', max = 14 }: { tags: TrendingTag[]; title?: string; max?: number }) {
  const shown = tags.slice(0, max);
  if (shown.length === 0) return null;
  return (
    <nav className="kv-trend-tags" aria-label={title}>
      <span className="kv-trend-title">
        <Hash size={15} aria-hidden /> {title}
      </span>
      <ul>
        {shown.map((t) => (
          <li key={t.tag}>
            <Link href={`/tags/${t.tag}`} className={`kv-trend-chip${t.onHeat ? ' is-hot' : ''}`}>
              {t.onHeat && <Flame size={13} aria-hidden />}#{t.tag}
              {t.onHeat && <span className="sr-only"> (on heat)</span>}
            </Link>
          </li>
        ))}
      </ul>
      <Link href="/tags" className="kv-trend-all">
        All hashtags
      </Link>
    </nav>
  );
}
