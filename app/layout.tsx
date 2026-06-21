import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SMART Document Intelligence",
  description: "KI-gestützte Dokumentenanalyse für KMU, Bau, Immobilien und Projektorganisationen"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
