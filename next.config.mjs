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
};

export default nextConfig;
