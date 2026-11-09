import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Read at runtime, so ship them with every server function (on Vercel too).
  // responses.csv is only there when deployed from the laptop; otherwise the
  // uploaded copy in Vercel Blob is used. The sponsor ticker lists the logo folders.
  outputFileTracingIncludes: {
    '/**': ['./data/responses.csv', './data/schedule.json', './data/sponsors.json', './public/sponsors/**/*'],
  },
  // There used to be a sponsors page; the sponsors now roll along the bottom of every page.
  async redirects() {
    return [{ source: '/sponsors', destination: '/', permanent: false }];
  },
};

export default nextConfig;
