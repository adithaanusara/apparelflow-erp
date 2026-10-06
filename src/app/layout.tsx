import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ApparelFlow ERP — Cutting Gatekeeper Terminal",
  description:
    "Cutting Operations & Gatekeeper Verification Terminal for ApparelFlow ERP.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
