import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Signed body-photo URLs are served from the Supabase Storage API.
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/**" },
    ],
  },
};

export default nextConfig;
