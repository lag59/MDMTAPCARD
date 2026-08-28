"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getAdminSystemStatus } from "@/lib/api";

type SystemStatus = {
  api_version: string;
  db_ok: boolean;
  alembic_revision?: string | null;
  server_time: string;
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<SystemStatus | null>(null);

  useEffect(() => {
    const token = window.localStorage.getItem("access_token");
    if (!token) {
      router.replace(`/login?next=${encodeURIComponent(pathname || "/admin")}`);
      return;
    }

    getAdminSystemStatus<SystemStatus>()
      .then((data) => setStatus(data))
      .catch(() => setStatus(null));
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
        <div className="mb-4 px-2">
          <div className="text-lg font-bold">MDM TapCard</div>
          <div className="mt-2 flex flex-col gap-1">
            <span className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${status?.db_ok ? "bg-emerald-500/20 text-emerald-200" : "bg-amber-500/20 text-amber-200"}`}>
              {status?.db_ok ? "Backend Connected" : "Backend Unreachable"}
            </span>
            {status?.alembic_revision ? (
              <span className="text-[10px] text-slate-300">DB: {status.alembic_revision}</span>
            ) : (
              <span className="text-[10px] text-slate-400">DB: unknown</span>
            )}
          </div>
        </div>
        {[
          ["Dashboard", "/admin"],
          ["Users", "/admin/users"],
          ["Clients", "/admin/clients"],
          ["Digital Cards", "/admin/cards"],
          ["Leads", "/admin/leads"],
          ["Templates", "/admin/templates"],
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
