"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { IconHome, IconMore, IconReceipt, IconSwap } from "./components";

const DESTINATIONS = [
  { href: "/dashboard", label: "Resumen", Icon: IconHome },
  { href: "/dashboard/cierres", label: "Cierres", Icon: IconReceipt },
  { href: "/dashboard/movimientos", label: "Movimientos", Icon: IconSwap },
  { href: "/dashboard/reportes", label: "Más", Icon: IconMore },
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="dash-nav" aria-label="Secciones del dashboard">
      {DESTINATIONS.map(({ href, label, Icon }) => {
        const isCurrent =
          href === "/dashboard" ? pathname === href : pathname.startsWith(href);

        return (
          <Link key={href} href={href} aria-current={isCurrent ? "page" : undefined}>
            <Icon />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
