/** @type {import('next').NextConfig} */
const nextConfig = {
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
};

module.exports = nextConfig;
