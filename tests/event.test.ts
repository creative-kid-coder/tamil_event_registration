import { afterEach, describe, expect, it } from 'vitest';
import { publicBaseUrl, ticketUrl } from '@/config/event';

const saved = { base: process.env.PUBLIC_BASE_URL, vercel: process.env.VERCEL_PROJECT_PRODUCTION_URL };

afterEach(() => {
  process.env.PUBLIC_BASE_URL = saved.base ?? '';
  if (saved.vercel === undefined) delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
  else process.env.VERCEL_PROJECT_PRODUCTION_URL = saved.vercel;
});

describe('links in QR emails', () => {
  it('use PUBLIC_BASE_URL when it is set (without a trailing slash)', () => {
    process.env.PUBLIC_BASE_URL = ' https://tamil-event-registration.vercel.app/ ';
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'something-else.vercel.app';
    expect(ticketUrl('K7Q2-M9XD')).toBe('https://tamil-event-registration.vercel.app/t/K7Q2-M9XD');
  });

  it("fall back to the Vercel project's production address", () => {
    process.env.PUBLIC_BASE_URL = '';
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'tamil-event-registration.vercel.app';
    expect(publicBaseUrl()).toBe('https://tamil-event-registration.vercel.app');
  });

  it('are left out on the laptop with no address (QR holds just the ticket ID)', () => {
    process.env.PUBLIC_BASE_URL = '';
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    expect(ticketUrl('K7Q2-M9XD')).toBeNull();
  });
});
