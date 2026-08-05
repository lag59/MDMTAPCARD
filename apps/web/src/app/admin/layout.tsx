"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const token = window.localStorage.getItem("access_token");
    if (!token) {
      router.replace(`/login?next=${encodeURIComponent(pathname || "/admin")}`);
    }
  }, [pathname, router]);

  const handleLogout = () => {
    window.localStorage.removeItem("access_token");
    window.localStorage.removeItem("user_role");
    router.replace("/login");
  };

  return (
    <div className="min-h-screen bg-slate-100 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-slate-900 text-white flex flex-col py-6 px-4 gap-1 shrink-0">
        <div className="text-lg font-bold mb-6 px-2">MDM TapCard</div>
        {[
          ["Dashboard", "/admin"],
          ["Clients", "/admin/clients"],
          ["Digital Cards", "/admin/cards"],
          ["NFC Inventory", "/admin/nfc"],
          ["Orders", "/admin/orders"],
          ["Analytics", "/admin/analytics"],
          ["Settings", "/admin/settings"],
        ].map(([label, href]) => (
          <Link
            key={href}
            href={href}
            className="px-3 py-2 rounded-lg text-sm hover:bg-white/10 transition"
          >
            {label}
          </Link>
        ))}
        <button
          onClick={handleLogout}
          className="mt-auto px-3 py-2 rounded-lg text-sm text-left hover:bg-white/10 transition"
        >
          Log out
        </button>
      </aside>

      {/* Content */}
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  );
}
