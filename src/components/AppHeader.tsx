'use client';

import type { Session } from '@/lib/auth';
import { logout } from '@/lib/client';
import { Avatar } from './Avatar';
import { EventName } from './EventName';
import { BrandMark, CalendarIcon, LayoutIcon, LogOutIcon, ScanIcon } from './icons';

interface Props {
  session: Session | null;
  eventName?: string;
  active: 'desk' | 'admin' | 'schedule';
}

/** Sticky top bar shared by the desk, admin and programme pages. */
export function AppHeader({ session, eventName, active }: Props) {
  const tab = (href: string, key: Props['active'], label: string, icon: React.ReactNode) => (
    <a
      href={href}
      aria-current={active === key ? 'page' : undefined}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
        active === key ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'
      }`}
    >
      {icon}
      {label}
    </a>
  );

  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <BrandMark className="h-9 w-9 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold leading-tight">
            <EventName name={eventName || 'Event check-in'} />
          </div>
          <div className="text-xs text-muted">Check-in</div>
        </div>

        {session?.role === 'admin' && (
          <nav className="hidden items-center gap-1 rounded-xl bg-surface-2 p-1 sm:flex">
            {tab('/desk', 'desk', 'Desk', <ScanIcon className="h-4 w-4" />)}
            {tab('/admin', 'admin', 'Admin', <LayoutIcon className="h-4 w-4" />)}
            {tab('/admin/schedule', 'schedule', 'Programme', <CalendarIcon className="h-4 w-4" />)}
          </nav>
        )}

        {session && (
          <div className="flex items-center gap-1">
            <div className="hidden items-center gap-2 rounded-full py-1 pr-3 pl-1 md:flex">
              <Avatar name={session.name} size="sm" />
              <span className="max-w-40 truncate text-sm font-medium">{session.name}</span>
            </div>
            <button onClick={logout} className="btn btn-ghost px-2.5" title="Sign out" aria-label="Sign out">
              <LogOutIcon className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>

      {session?.role === 'admin' && (
        <nav className="mx-auto flex max-w-6xl gap-1 px-4 pb-2 sm:hidden">
          <div className="flex gap-1 rounded-xl bg-surface-2 p-1">
            {tab('/desk', 'desk', 'Desk', <ScanIcon className="h-4 w-4" />)}
            {tab('/admin', 'admin', 'Admin', <LayoutIcon className="h-4 w-4" />)}
            {tab('/admin/schedule', 'schedule', 'Programme', <CalendarIcon className="h-4 w-4" />)}
          </div>
        </nav>
      )}
    </header>
  );
}
