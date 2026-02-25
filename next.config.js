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
  webpack: (config, { isServer }) => {
    // Isolate zone10b_schedule into async-only chunk to fix "Cannot access 'em' before initialization"
    // when vault loads. The schedule/zone10b has init-order issues when co-bundled.
    config.optimization.splitChunks = {
      ...config.optimization.splitChunks,
      cacheGroups: {
        ...config.optimization.splitChunks?.cacheGroups,
        zone10b: {
          test: /zone10b_schedule|scheduleUtils|plantingWindow\.ts/,
          name: "zone10b",
          chunks: "all",
          enforce: true,
        },
      },
    };
    return config;
  },
};

module.exports = nextConfig;
