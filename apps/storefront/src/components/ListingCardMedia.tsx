'use client';

// Cover media for a listing card on the store site. Shows the first photo;
// when the seller uploaded a product video it adds a "Video" tag and, where the
// card isn't itself a link (`playable`), a Play button that plays the video in
// place. A listing with a video but no photo shows the video's first frame.

import { useState } from 'react';
import Link from 'next/link';
import { Play as IcPlay } from 'lucide-react';

export function ListingCardMedia({
  href,
  cover,
  videoUrl,
  title,
  fallback,
  playable = false,
}: {
  /** Omit when the whole card is already a link. */
  href?: string;
  cover: string | null;
  videoUrl: string | null | undefined;
  title: string;
  fallback: React.ReactNode;
  playable?: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const video = videoUrl && /^https:\/\//.test(videoUrl) ? videoUrl : null;

  if (playing && video) {
    return (
      <div className="lcm">
        <video
          className="catalogue-cover lcm-video"
          src={video}
          controls
          autoPlay
          playsInline
          preload="metadata"
          aria-label={`${title}: product video`}
        />
      </div>
    );
  }

  const face = cover ? (
    // eslint-disable-next-line @next/next/no-img-element -- seller-supplied remote URL
    <img className="catalogue-cover" src={cover} alt="" loading="lazy" decoding="async" />
  ) : video ? (
    // First frame as the cover (the #t hint makes mobile Safari paint a frame).
    <video className="catalogue-cover lcm-video" src={`${video}#t=0.1`} muted playsInline preload="metadata" aria-hidden tabIndex={-1} />
  ) : (
    fallback
  );

  return (
    <div className="lcm">
      {href ? (
        <Link href={href} aria-label={title} className="lcm-link">
          {face}
        </Link>
      ) : (
        face
      )}
      {video && (
        <span className="lcm-tag" aria-hidden={playable ? true : undefined}>
          <IcPlay size={11} aria-hidden /> Video
        </span>
      )}
      {video && playable && (
        <button type="button" className="lcm-play" onClick={() => setPlaying(true)} aria-label={`Play the video for ${title}`}>
          <IcPlay size={20} aria-hidden />
        </button>
      )}
    </div>
  );
}
