import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSellerClient } from '@/lib/auth';

export default async function HomePage() {
  const sb = await getSellerClient();

  // If a seller is already signed in, redirect them to dashboard
  if (sb) {
    return redirect('/dashboard');
  }

  // Otherwise, show the about/landing page for unauthenticated visitors
  return (
    <main>
      <section className="brand-hero">
        <div className="relative mx-auto w-full max-w-6xl px-6 py-12 sm:px-10 text-center">
          <h1 className="mb-4 font-heading text-[clamp(34px,5.4vw,60px)] font-extrabold leading-[0.98] tracking-[-0.045em] text-foreground">
            Every Nigerian business deserves a storefront as good as its{' '}
            <span className="brand-grad">hustle.</span>
          </h1>
          <p className="mb-8 max-w-[54ch] mx-auto text-[16.5px] leading-relaxed text-muted-foreground">
            Naijavend turns a WhatsApp catalogue into a real website — orders, bookings, a free POS, staff,
            branches and a live map — then puts it in front of buyers who are already looking. One link. No
            commission.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/discover" className="btn btn-primary btn-lg">
              Browse the marketplace <span className="arrow-right">→</span>
            </Link>
            <Link href="/account/signin" className="btn btn-outline btn-lg">
              Open your store — free <span className="arrow-right">→</span>
            </Link>
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-surface py-6">
        <div className="container max-w-2xl mx-auto px-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <strong>No commission on your sales</strong>
            </div>
            <div>
              <strong>No card to start</strong>
            </div>
            <div>
              <strong>Blue tick has a public rule</strong>
            </div>
            <div>
              <strong>Location stays in your browser</strong>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mt-4">
            <div>
              <strong>POS, staff & branches included</strong>
            </div>
            <div>
              <strong>Reviews tied to real orders</strong>
            </div>
            <div>
              <strong>WhatsApp-first checkout</strong>
            </div>
            <div>
              <strong>Made in Nigeria</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12">
        <div className="container max-w-3xl mx-auto px-4">
          <h2 className="mb-6 font-heading text-[clamp(24px,3.4vw,34px)] font-extrabold leading-[1.08] tracking-[-0.035em] text-foreground">
            It started with a price list pasted into fifty DMs.
          </h2>
          <p className="mb-4 text-[15px] leading-relaxed text-muted-foreground">
            Nigerian sellers were already running serious businesses — just split across a WhatsApp catalogue,
            an Instagram grid and a notebook of orders. Every new customer meant the same five questions, the
            same screenshots, the same "send your address".
          </p>
          <p className="mb-4 text-[15px] leading-relaxed text-muted-foreground">
            Naijavend exists to give that work a place to live. A store page holds the facts once: what you
            sell, what it costs, when you're open, where you are. Buyers get answers without asking, and
            sellers get a link they can hand to anyone.
          </p>
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            Then we kept going — bookings, a counter POS, staff logins, branches, a live map, honest rankings
            and the blue tick — because a storefront that only sells is a brochure, not a business.
          </p>
        </div>
      </section>

      <section className="py-12 bg-[var(--elevated)]">
        <div className="container max-w-2xl mx-auto px-4">
          <h2 className="mb-4 font-heading text-[clamp(24px,3.4vw,34px)] font-extrabold leading-[1.08] tracking-[-0.035em] text-foreground">
            Five layers deep, one storefront.
          </h2>
          <p className="mb-4 text-[15px] leading-relaxed text-muted-foreground">
            Nigerian commerce already works on trust, speed and WhatsApp. It doesn't need a heavier version of
            that — it needs a shopfront that keeps up, and a marketplace where the work is visible.
          </p>
          <div className="grid grid-cols-2 gap-4 mt-6">
            <span className="badge badge-blue">Reviews from real orders</span>
            <span className="badge badge-blue">Server-verified prices</span>
            <span className="badge badge-blue">WhatsApp-first</span>
            <span className="badge badge-blue">Data-light</span>
          </div>
        </div>
      </section>

      <section className="py-12">
        <div className="container max-w-3xl mx-auto px-4">
          <h2 className="mb-4 font-heading text-[clamp(24px,3.4vw,34px)] font-extrabold leading-[1.08] tracking-[-0.035em] text-foreground">
            Built for the way Nigeria sells.
          </h2>
          <p className="mb-4 text-[15px] leading-relaxed text-muted-foreground">
            If it can be listed, booked or delivered, it can live on a Naijavend storefront.
          </p>
          <div className="grid grid-colors-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <strong>Cake & food studios</strong><br />
              Pre-orders, delivery windows, weekend slots.
            </div>
            <div>
              <strong>Beauty & braids</strong><br />
              Bookings that don't double-up, price lists that stay current.
            </div>
            <div>
              <strong>Phones & gadgets</strong><br />
              Stock counts, variants and a catalogue buyers can trust.
            </div>
            <div>
              <strong>Fashion & thrift</strong><br />
              Lookbooks, sizes, drops and DM-free ordering.
            </div>
            <div>
              <strong>Tutors & lessons</strong><br />
              Recurring slots, packages and student reviews.
            </div>
            <div>
              <strong>Home services</strong><br />
              Coverage areas, call-outs and service pricing.
            </div>
            <div>
              <strong>Dropshippers</strong><br />
              Honest shipping windows on every listing.
            </div>
            <div>
              <strong>Markets & pop-ups</strong><br />
              Free POS for the stall, storefront for the rest of the week.
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 border-t border-border bg-[var(--elevated)]">
        <div className="container px-6 py-10 sm:px-10 text-center">
          <h2 className="mb-4 font-heading text-[clamp(24px,4vw,38px)] font-extrabold leading-[1.05] tracking-[-0.04em] text-foreground">
            Your customers are already online.
          </h2>
          <p className="mb-6 max-w-[46ch] mx-auto text-[15px] leading-relaxed text-muted-foreground">
            Open a store free in minutes. Keep your WhatsApp — add a storefront that answers before you do.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/discover" className="btn btn-primary btn-lg">
              Browse stores <span className="arrow-right">→</span>
            </Link>
            <Link href="/account/signin" className="btn btn-outline btn-lg">
              Start selling <span className="arrow-right">→</span>
            </Link>
          </div>
          <p className="mt-4 text-[12px] text-muted-foreground">
            Made in Nigeria 🇳🇬 · free to start · no commission
          </p>
        </div>
      </section>
    </main>
  );
}