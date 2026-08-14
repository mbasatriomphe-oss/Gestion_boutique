/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Proxy all /api/* requests to the Laravel backend.
  // This eliminates CORS preflight (OPTIONS) requests entirely,
  // cutting every API round-trip from 2 HTTP calls down to 1.
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/api\/?$/, "") ?? "http://localhost:8000"
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: "/storage/:path*",
        destination: `${backendUrl}/storage/:path*`,
      },
    ]
  },
}

export default nextConfig
