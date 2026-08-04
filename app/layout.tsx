import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "710 Coffee Bar - Control de caja",
  description: "Prototipo para apertura, movimientos y cierre de caja.",
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
