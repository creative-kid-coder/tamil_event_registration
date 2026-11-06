import { BrandMark } from '@/components/icons';
import { EVENT } from '@/config/event';
import { LoginForm } from './LoginForm';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden p-4">
      <div aria-hidden="true" className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-brand/20 blur-3xl" />

      <div className="relative w-full max-w-sm">
        <div className="mb-8 text-center">
          <BrandMark className="h-14 w-14" />
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">{EVENT.name}</h1>
          <p className="mt-1 text-sm text-muted">{[EVENT.date, 'Check-in'].filter(Boolean).join(' · ')}</p>
        </div>

        <div className="card p-6 sm:p-7">
          <LoginForm />
        </div>

        <p className="mt-6 text-center text-xs text-muted">Ask the organiser for the PIN.</p>
      </div>
    </main>
  );
}
