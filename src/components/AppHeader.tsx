'use client';

import type { Session } from '@/lib/auth';
import { logout } from '@/lib/client';
import { Avatar } from './Avatar';
import { EventName } from './EventName';
import { BrandMark, CalendarIcon, LayoutIcon, LogOutIcon, ScanIcon } from './icons';

type Tab = 'desk' | 'admin' | 'schedule';

interface Props {
  session: Session | null;
  eventName?: string;
  active: Tab;
}

const TABS: { key: Tab; href: string; label: string; Icon: (p: { className?: string }) => React.ReactNode }[] = [
  { key: 'desk', href: '/desk', label: 'Desk', Icon: ScanIcon },
  { key: 'admin', href: '/admin', label: 'Admin', Icon: LayoutIcon },
  { key: 'schedule', href: '/admin/schedule', label: 'Programme', Icon: CalendarIcon },
];

/** Sticky top bar shared by the staff pages (desk, admin, programme). */
export function AppHeader({ session, eventName, active }: Props) {
  const showTabs = session?.role === 'admin';

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

        {showTabs && (
          <nav className="hidden items-center gap-1 rounded-xl bg-surface-2 p-1 sm:flex">
            {TABS.map(({ key, href, label, Icon }) => (
              <a
                key={key}
                href={href}
                aria-current={active === key ? 'page' : undefined}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  active === key ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </a>
            ))}
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

      {/* Phones: three equal tabs, icon above label, so they fit even on the smallest screens. */}
      {showTabs && (
        <nav className="mx-auto max-w-6xl px-4 pb-2 sm:hidden">
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1">
            {TABS.map(({ key, href, label, Icon }) => (
              <a
                key={key}
                href={href}
                aria-current={active === key ? 'page' : undefined}
                className={`flex min-w-0 flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[11px] leading-tight font-medium transition ${
                  active === key ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'
                }`}
              >
                <Icon className="h-[18px] w-[18px]" />
                <span className="max-w-full truncate">{label}</span>
              </a>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
