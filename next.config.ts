import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // data/responses.csv is read at runtime, so ship it with every server function.
  outputFileTracingIncludes: { '/**': ['./data/responses.csv'] },
};

export default nextConfig;
