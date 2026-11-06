import QRCode from 'qrcode';
import { BadgeGrid } from '@/components/BadgeGrid';
import { EventName } from '@/components/EventName';
import { BrandMark, CalendarIcon, CheckCircleIcon } from '@/components/icons';
import { EVENT, ticketUrl } from '@/config/event';
import { findByTicket, getData } from '@/lib/data';
import type { Registration } from '@/lib/registrations';

export const dynamic = 'force-dynamic';

/** Public page the QR code links to. Shows first name and counts only — no contact details. */
export default async function TicketPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params;
  let reg: Registration | undefined;
  let loadError = false;
  try {
    reg = findByTicket(await getData(), ticketId);
  } catch (error) {
    console.error(error);
    loadError = true;
  }

  let qrSvg = '';
  if (reg) {
    qrSvg = await QRCode.toString(ticketUrl(reg.ticketId) ?? reg.ticketId, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' });
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-8">
      <article className="card overflow-hidden">
        {/* Event header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-brand to-brand-strong px-6 pt-6 pb-7 text-on-brand">
          <div aria-hidden="true" className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-white/10" />
          <div className="relative flex items-center gap-2 text-xs font-semibold tracking-[0.12em] uppercase opacity-85">
            <BrandMark className="h-6 w-6 bg-white/20 from-transparent to-transparent shadow-none" />
            Admit · Check-in pass
          </div>
          <h1 className="relative mt-4 text-2xl font-semibold tracking-tight">
            <EventName name={EVENT.name} wrap />
          </h1>
          {(EVENT.date || EVENT.venue) && (
            <p className="relative mt-1 text-sm opacity-85">{[EVENT.date, EVENT.venue].filter(Boolean).join(' · ')}</p>
          )}
        </div>

        {/* Perforation */}
        <div className="relative h-0 border-t-2 border-dashed border-line">
          <span className="absolute -top-3 -left-3 h-6 w-6 rounded-full bg-bg" />
          <span className="absolute -top-3 -right-3 h-6 w-6 rounded-full bg-bg" />
        </div>

        <div className="p-6">
          {loadError ? (
            <p className="py-6 text-center text-muted">We couldn&apos;t load your booking right now. Please try again shortly.</p>
          ) : !reg ? (
            <p className="py-6 text-center text-muted">Ticket not found. Please check the link in your email.</p>
          ) : (
            <>
              <p className="text-center text-lg">
                Hi <b>{reg.firstName}</b>, show this at the check-in desk.
              </p>
              <div className="mx-auto mt-5 w-56 rounded-2xl bg-white p-4 shadow-card ring-1 ring-black/5">
                <div className="[&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />
              </div>
              <div className="mt-3 text-center font-mono text-lg tracking-[0.25em] text-muted">{reg.ticketId}</div>

              <div className="mt-7">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="eyebrow">Your booking</h2>
                  <span className="text-sm text-muted">
                    {reg.totalPeople} {reg.totalPeople === 1 ? 'person' : 'people'}
                  </span>
                </div>
                <BadgeGrid counts={reg.badges} compact />
              </div>

              <p className="mt-6 flex gap-2 rounded-xl bg-surface-2 p-3.5 text-sm text-muted">
                <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                If anything is wrong, reply to your confirmation email before the event so we can fix it.
              </p>
            </>
          )}
        </div>
      </article>

      <a href="/schedule" className="btn btn-secondary mt-4 w-full py-3">
        <CalendarIcon className="h-4 w-4" />
        View the programme
      </a>
    </main>
  );
}
