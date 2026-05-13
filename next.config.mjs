/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@mediapipe/hands",
    "@mediapipe/camera_utils",
    "three",
    "@react-three/fiber",
    "@react-three/drei",
  ],
};

export default nextConfig;
