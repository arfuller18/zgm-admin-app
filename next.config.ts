import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit and exceljs load font/data files relative to their own package
  // directory at runtime (pdfkit's AFM font metrics in particular) — kept
  // external so the server build doesn't bundle those lookups away.
  serverExternalPackages: ["pdfkit", "exceljs"],
};

export default nextConfig;
