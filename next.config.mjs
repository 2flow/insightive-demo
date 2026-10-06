/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static HTML export: `npm run build` emits a self-contained ./out folder
  // that can be hosted on any static host (S3/CloudFront, Netlify, nginx,
  // GitHub Pages…). `npm run dev` is unaffected.
  output: 'export',

  // Required when using `output: 'export'`: the default next/image optimizer
  // needs a server, so images must be served unoptimized.
  images: { unoptimized: true },

  // The NGO watch reports in data/reports/ are Markdown; lib/ngoSignals.ts
  // imports them as plain text and parses them in the bundle.
  webpack: config => {
    config.module.rules.push({ test: /\.md$/, type: 'asset/source' })
    return config
  },

  // If you host under a sub-path (e.g. https://host/pelsis/), uncomment and set:
  // basePath: '/pelsis',
  // assetPrefix: '/pelsis/',
  // basePath:
  //   "/api/p/static/f3a12731-1fcc-4b6e-b851-92637671b8ad",

  // assetPrefix:
  //   "/api/p/static/f3a12731-1fcc-4b6e-b851-92637671b8ad",
}
export default nextConfig
