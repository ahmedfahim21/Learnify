import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The 2023 hackathon app lives under legacy/ and is not part of the build.

  async redirects() {
    // The top-level unit was renamed course -> concept. Anything already
    // linked or bookmarked under /courses keeps working.
    return [
      { source: "/courses", destination: "/concepts", permanent: true },
      { source: "/courses/:path*", destination: "/concepts/:path*", permanent: true },
    ];
  },
};

export default nextConfig;
