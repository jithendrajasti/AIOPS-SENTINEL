/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Produces a self-contained build in .next/standalone for Docker deployment.
  // The standalone server includes only the files needed at runtime — no node_modules.
  output: "standalone",
};

export default nextConfig;
