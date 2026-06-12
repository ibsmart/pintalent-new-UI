import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-sqlite3', 'pdf-parse', 'mammoth', 'xlsx', 'nodemailer', 'pdfkit'],
};

export default nextConfig;
