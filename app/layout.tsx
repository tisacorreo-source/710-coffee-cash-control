import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "710 Coffee Bar - Caja de turno",
  description: "Prototipo para registrar cierres y dinero retirado con Google Sheets.",
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
