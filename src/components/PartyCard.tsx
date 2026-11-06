'use client';

import { BADGES } from '@/config/badges';
import { fullName, timeOf, type Party } from '@/lib/registrations';
import { Avatar } from './Avatar';
import { BadgeGrid } from './BadgeGrid';
import { AlertIcon, ArrowLeftIcon, CheckIcon, MailIcon, PhoneIcon, UndoIcon, UsersIcon } from './icons';

interface Props {
  party: Party;
  busy: boolean;
  onCheckIn: () => void;
  onUndo: () => void;
  onClose: () => void;
}

const isMeaningful = (v: string) => v && !/^(no|none|n\/a|-)$/i.test(v);

export function PartyCard({ party, busy, onCheckIn, onUndo, onClose }: Props) {
  const { checkIn } = party;
  const given = checkIn
    ? BADGES.filter((b) => checkIn.badges[b.key] > 0).map((b) => `${checkIn.badges[b.key]} × ${b.label}`).join(' · ')
    : '';

  return (
    <article className="card animate-rise overflow-hidden">
      <div className="flex items-start gap-4 p-5 sm:p-6">
        <Avatar name={fullName(party)} size="lg" />
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{fullName(party)}</h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
            <span className="inline-flex items-center gap-1.5">
              <PhoneIcon className="h-4 w-4" />
              {party.mobile || '—'}
            </span>
            {party.email && (
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <MailIcon className="h-4 w-4 shrink-0" />
                <span className="truncate">{party.email}</span>
              </span>
            )}
          </div>
          <span className="mt-2 inline-block rounded-md bg-surface-2 px-2 py-0.5 font-mono text-xs tracking-wider text-muted">
            {party.ticketId}
          </span>
        </div>
        <button onClick={onClose} className="btn btn-ghost -mt-1 -mr-2 shrink-0 px-2.5" aria-label="Back to search">
          <ArrowLeftIcon className="h-5 w-5" />
          <span className="hidden sm:inline">Back</span>
        </button>
      </div>

      {checkIn && (
        <div className="mx-5 mb-5 flex gap-3 rounded-2xl border-2 border-warning-line bg-warning-soft p-4 text-warning sm:mx-6">
          <AlertIcon className="mt-0.5 h-6 w-6 shrink-0" />
          <div>
            <div className="text-lg font-bold leading-snug">
              Already checked in at {timeOf(checkIn.at)} by {checkIn.by}
            </div>
            <div className="font-medium">Do not give badges again.</div>
            {given && <div className="mt-1 text-sm opacity-90">Given: {given}</div>}
          </div>
        </div>
      )}

      {party.warnings.length > 0 && (
        <ul className="mx-5 mb-5 space-y-1 rounded-2xl bg-warning-soft/70 p-3.5 text-sm text-warning sm:mx-6">
          {party.warnings.map((w) => (
            <li key={w} className="flex gap-2">
              <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{w}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-line bg-surface-2/50 p-5 sm:p-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="eyebrow">{checkIn ? 'Booked badges' : 'Hand over these badges'}</h3>
          <span className="pill bg-surface text-ink ring-1 ring-line">
            <UsersIcon className="h-3.5 w-3.5" />
            {party.totalPeople} {party.totalPeople === 1 ? 'person' : 'people'}
          </span>
        </div>
        <BadgeGrid counts={party.badges} />

        {(isMeaningful(party.volunteering) || isMeaningful(party.culturalProgram)) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {isMeaningful(party.volunteering) && (
              <span className="pill bg-brand-soft text-brand">Volunteering · {party.volunteering}</span>
            )}
            {isMeaningful(party.culturalProgram) && (
              <span className="pill bg-brand-soft text-brand">Cultural · {party.culturalProgram}</span>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-line p-4 sm:p-5">
        {checkIn ? (
          <button onClick={onUndo} disabled={busy} className="btn btn-secondary">
            <UndoIcon className="h-4 w-4" />
            Undo check-in
          </button>
        ) : (
          <button onClick={onCheckIn} disabled={busy} className="btn btn-success h-16 w-full rounded-2xl text-lg">
            <CheckIcon className="h-6 w-6" />
            {busy ? 'Saving…' : 'Badges handed over — Check in'}
          </button>
        )}
      </div>
    </article>
  );
}
