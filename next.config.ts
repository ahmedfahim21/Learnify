import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The 2023 hackathon app lives under legacy/ and is not part of the build.

  // Source ingestion (#45) pulls in Node-native libraries with dynamic requires
  // (jsdom) and lazily-loaded worker assets (unpdf/pdf.js). Keep them external
  // to the server bundle so Next doesn't try to trace/bundle them.
  serverExternalPackages: ["jsdom", "unpdf"],
};

export default nextConfig;
