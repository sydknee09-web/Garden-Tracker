const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
  openAnalyzer: false,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/manifest.json",
        headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
      },
      {
        source: "/icons/icon-192.png",
        headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
      },
      {
        source: "/icons/icon-512.png",
        headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ocupjwbksaqmujbpolwp.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  // Reduce chunk loading issues that can cause "originalFactory is undefined" (Next 14)
  experimental: {
    optimizePackageImports: ["@supabase/supabase-js"],
  },
  webpack: (config) => config,
};

module.exports = withBundleAnalyzer(nextConfig);
