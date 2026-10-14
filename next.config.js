/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["imapflow", "mailparser"],
  },
};

module.exports = nextConfig;
