import type { NextConfig } from 'next';
import path from 'node:path';

const development = process.env.NODE_ENV === 'development';
const config: NextConfig = {
  output: development ? undefined : 'export',
  trailingSlash: true,
  skipTrailingSlashRedirect: true,
  poweredByHeader: false,
  turbopack: { root: path.resolve(__dirname, '../..') },
  sassOptions: { includePaths: [path.resolve(__dirname, 'node_modules')] },
  ...(development ? {
    async rewrites() {
      return [{ source: '/api/:path*', destination: 'http://127.0.0.1:3001/api/:path*' }];
    },
  } : {}),
};

export default config;
