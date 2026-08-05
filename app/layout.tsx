import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "710 Coffee Bar - Cierre de turno",
  description: "Prototipo para registrar cierres de turno con Google Sheets.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
