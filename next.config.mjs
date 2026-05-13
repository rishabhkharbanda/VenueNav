/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@mediapipe/hands", "@mediapipe/camera_utils"],
};

export default nextConfig;
