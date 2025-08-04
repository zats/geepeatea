/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  assetPrefix: process.env.NODE_ENV === 'production' ? '/geepeatea' : '',
  basePath: process.env.NODE_ENV === 'production' ? '/geepeatea' : '',
  // Skip API routes during static export
  exportPathMap: async function (
    defaultPathMap,
    { dev, dir, outDir, distDir, buildId }
  ) {
    return {
      '/': { page: '/' },
    }
  },
};

export default nextConfig;
