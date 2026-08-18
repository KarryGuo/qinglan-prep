"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/admin", label: "仪表盘", icon: "▦" },
  { href: "/admin/teachers", label: "教师认证", icon: "✎" },
  { href: "/admin/knowledge", label: "知识库同步", icon: "❖" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="mt-6 flex flex-wrap gap-2 border-b-2 border-dashed border-chalk-50/25 pb-3">
      {NAV.map((n) => {
        const active = pathname === n.href;
        return (
          <Link
            key={n.href}
            href={n.href}
            className={`rounded-t-lg border-2 border-b-0 px-4 py-1.5 text-sm font-semibold transition ${
              active
                ? "chalk-yellow border-chalk-yellow/70 bg-chalk-yellow/10"
                : "border-chalk-50/20 text-chalk-400 hover:border-chalk-yellow/50 hover:text-chalk-yellow"
            }`}
          >
            {n.icon} {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
