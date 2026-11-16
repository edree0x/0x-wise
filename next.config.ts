import type { NextConfig } from 'next'

const config: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['jsdom', 'sanitize-html', 'rss-parser', 'pdfjs-dist'],
  experimental: {
    serverActions: { bodySizeLimit: '25mb' },
  },
}

export default config
