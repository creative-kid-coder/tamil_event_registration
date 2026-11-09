import type { Metadata } from 'next';
import { Diya, plainEventName } from '@/components/EventName';
import { CalendarIcon, ChevronRightIcon, MapPinIcon } from '@/components/icons';
import { EVENT } from '@/config/event';
import { HomeNow } from './HomeNow';

export const metadata: Metadata = { title: { absolute: EVENT.name } };

/**
 * The guest home page: the event, what's on now and the programme (the
 * sponsors roll along the bottom, as on every page). Signed-in volunteers and
 * organisers are sent to the desk instead (middleware), so their phones keep
 * opening straight into check-in.
 */
export default function Home() {
  return (
    <main className="relative mx-auto max-w-lg px-4 pt-[env(safe-area-inset-top)] pb-[calc(2.5rem+env(safe-area-inset-bottom))]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-32 h-[26rem] bg-[radial-gradient(closest-side,rgb(251_191_36/0.3),transparent)]"
      />

      <section className="relative pt-12 pb-7 text-center">
        <Diya className="mx-auto h-24 w-24 drop-shadow-[0_10px_24px_rgba(245,158,11,0.45)]" />
        <h1 className="mt-4 text-[32px] leading-tight font-semibold tracking-tight">{plainEventName(EVENT.name)}</h1>
        {(EVENT.date || EVENT.venue) && (
          <p className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-[15px] text-muted">
            {EVENT.date && (
              <span className="inline-flex items-center gap-1.5">
                <CalendarIcon className="h-4 w-4 shrink-0" />
                {EVENT.date}
              </span>
            )}
            {EVENT.venue && (
              <span className="inline-flex items-center gap-1.5">
                <MapPinIcon className="h-4 w-4 shrink-0" />
                {EVENT.venue}
              </span>
            )}
          </p>
        )}
      </section>

      <div className="relative space-y-3">
        <HomeNow />

        <HomeLink
          href="/schedule"
          title="Programme"
          text="What’s on now and next, updated live"
          icon={<CalendarIcon className="h-6 w-6" />}
          tileClass="bg-gradient-to-br from-brand to-brand-strong text-on-brand"
        />
      </div>

      <footer className="relative mt-12 border-t border-line pt-5 text-center text-sm text-muted">
        Volunteer or organiser?{' '}
        <a href="/desk" className="font-semibold text-brand">
          Staff sign-in
        </a>
      </footer>
    </main>
  );
}

function HomeLink({
  href,
  title,
  text,
  icon,
  tileClass = '',
}: {
  href: string;
  title: string;
  text: string;
  icon: React.ReactNode;
  tileClass?: string;
}) {
  return (
    <a href={href} className="card group flex items-center gap-4 p-4 transition hover:-translate-y-0.5 hover:shadow-lg">
      <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-sm ${tileClass}`}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-semibold">{title}</span>
        <span className="block text-sm leading-snug text-muted">{text}</span>
      </span>
      <ChevronRightIcon className="h-5 w-5 shrink-0 text-muted transition group-hover:translate-x-0.5" />
    </a>
  );
}
