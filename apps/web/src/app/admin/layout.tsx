"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getAdminSystemStatus, getApiHealth } from "@/lib/api";

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
  const [apiConnected, setApiConnected] = useState<boolean | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const token = window.localStorage.getItem("access_token");
    const role = window.localStorage.getItem("user_role");
    setUserRole(role);
    if (!token) {
      router.replace(`/login?next=${encodeURIComponent(pathname || "/admin")}`);
      return;
    }

    getApiHealth().then(setApiConnected);
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
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-indigo-50/50 flex">
      {/* Sidebar */}
      <aside className="w-60 bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950 text-white flex flex-col py-6 px-4 gap-1 shrink-0 shadow-2xl">
        <div className="mb-4 px-2">
          <div className="text-lg font-bold tracking-tight">MDM TapCard</div>
          <div className="mt-2 flex flex-col gap-1">
            <span className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${apiConnected ? "bg-emerald-500/20 text-emerald-200" : apiConnected === false ? "bg-rose-500/20 text-rose-200" : "bg-amber-500/20 text-amber-200"}`}>
              {apiConnected ? "Backend Connected" : apiConnected === false ? "Backend Unreachable" : "Checking Backend…"}
            </span>
            {status?.alembic_revision ? (
              <span className="text-[10px] text-slate-300">DB: {status.alembic_revision}</span>
            ) : (
              <span className="text-[10px] text-slate-400">DB: status unavailable</span>
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
          ...(["super_admin", "business_owner"].includes(userRole ?? "")
            ? [["Desktop Programmer", "/admin/nfc/desktop"] as const]
            : []),
          ["Orders", "/admin/orders"],
          ["Analytics", "/admin/analytics"],
          ["Settings", "/admin/settings"],
          ...(userRole === "super_admin" ? [["Signup Requests", "/admin/signup-requests"] as const] : []),
          ...(userRole === "super_admin" ? [["Fulfillment Queue", "/admin/fulfillment"] as const] : []),
        ].map(([label, href]) => (
          <Link
            key={href}
            href={href}
            className="px-3 py-2 rounded-xl text-sm text-slate-100/95 hover:bg-white/12 transition"
          >
            {label}
          </Link>
        ))}
        <button
          onClick={handleLogout}
          className="mt-auto px-3 py-2 rounded-xl text-sm text-left text-slate-100/95 hover:bg-white/12 transition"
        >
          Log out
        </button>
      </aside>

      {/* Content */}
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  );
}
