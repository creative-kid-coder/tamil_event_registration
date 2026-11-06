import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Read at runtime, so ship them with every server function (on Vercel too).
  // responses.csv is only there when deployed from the laptop; otherwise the
  // uploaded copy in Vercel Blob is used.
  outputFileTracingIncludes: { '/**': ['./data/responses.csv', './data/schedule.json'] },
};

export default nextConfig;
