"use client";

import { useMemo, useState } from "react";
import { apiBaseUrl } from "@/lib/api";

type DeviceKey = "phone" | "tablet" | "web";

type Device = {
  key: DeviceKey;
  label: string;
  /** CSS pixel dimensions in portrait orientation. */
  width: number;
  height: number;
  /** Whether the frame can be rotated to landscape. */
  rotatable: boolean;
};

const DEVICES: Device[] = [
  { key: "phone", label: "Mobile phone", width: 390, height: 844, rotatable: true },
  { key: "tablet", label: "Tablet", width: 820, height: 1180, rotatable: true },
  { key: "web", label: "Mobile web / desktop", width: 1280, height: 800, rotatable: false },
];

const ROUTES: { path: string; label: string }[] = [
  { path: "/", label: "Home / Signup" },
  { path: "/enterprise", label: "Enterprise" },
  { path: "/login", label: "Login" },
  { path: "/signup", label: "Signup" },
  { path: "/signup/thanks", label: "Signup — Thanks" },
  { path: "/dashboard", label: "Customer Dashboard" },
  { path: "/admin", label: "Admin — Overview" },
  { path: "/admin/cards", label: "Admin — Cards" },
  { path: "/admin/cards/new", label: "Admin — New Card" },
  { path: "/admin/clients", label: "Admin — Clients" },
  { path: "/admin/leads", label: "Admin — Leads" },
  { path: "/admin/orders", label: "Admin — Orders" },
  { path: "/admin/templates", label: "Admin — Templates" },
  { path: "/admin/analytics", label: "Admin — Analytics" },
  { path: "/admin/nfc", label: "Admin — NFC" },
  { path: "/admin/fulfillment", label: "Admin — Fulfillment" },
  { path: "/admin/signup-requests", label: "Admin — Signup Requests" },
  { path: "/admin/users", label: "Admin — Users" },
  { path: "/admin/settings", label: "Admin — Settings" },
];

export default function PreviewPage() {
  const [routePath, setRoutePath] = useState<string>(ROUTES[0].path);
  const [customPath, setCustomPath] = useState<string>("");
  const [activeDevices, setActiveDevices] = useState<Record<DeviceKey, boolean>>({
    phone: true,
    tablet: true,
    web: true,
  });
  const [landscape, setLandscape] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const targetPath = useMemo(() => {
    const raw = customPath.trim() || routePath;
    return raw.startsWith("/") ? raw : `/${raw}`;
  }, [customPath, routePath]);

  const shownDevices = DEVICES.filter((d) => activeDevices[d.key]);

  function toggleDevice(key: DeviceKey) {
    setActiveDevices((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <main className="min-h-screen w-full px-4 py-6 sm:px-6 lg:px-8">
      <header className="mx-auto max-w-7xl">
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Responsive Screen Preview</h1>
        <p className="mt-1 text-sm text-slate-600">
          Inspect any screen across mobile phone, tablet, and mobile web / desktop breakpoints at once.
        </p>
        <p className="mt-1 text-xs text-slate-500">
          API base: <span className="font-mono">{apiBaseUrl}</span>
        </p>
      </header>

      <section className="mx-auto mt-5 flex max-w-7xl flex-col gap-4 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex flex-1 flex-col gap-1 text-sm min-w-[220px]">
          <span className="font-medium text-slate-700">Screen</span>
          <select
            value={routePath}
            onChange={(e) => {
              setRoutePath(e.target.value);
              setCustomPath("");
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
          >
            {ROUTES.map((r) => (
              <option key={r.path} value={r.path}>
                {r.label} — {r.path}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-1 flex-col gap-1 text-sm min-w-[220px]">
          <span className="font-medium text-slate-700">Custom path</span>
          <input
            value={customPath}
            onChange={(e) => setCustomPath(e.target.value)}
            placeholder="/t/demo-slug"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-slate-900"
          />
        </label>

        <div className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">Devices</span>
          <div className="flex flex-wrap gap-2">
            {DEVICES.map((d) => (
              <button
                key={d.key}
                type="button"
                onClick={() => toggleDevice(d.key)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  activeDevices[d.key]
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-slate-300 bg-white text-slate-600 hover:border-slate-400"
                }`}
                aria-pressed={activeDevices[d.key]}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setLandscape((v) => !v)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-slate-400"
          >
            {landscape ? "Portrait" : "Landscape"}
          </button>
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-slate-400"
          >
            Reload
          </button>
        </div>
      </section>

      <section className="mx-auto mt-6 flex max-w-full flex-wrap items-start justify-center gap-8 overflow-x-auto pb-10">
        {shownDevices.length === 0 && (
          <p className="text-sm text-slate-500">Select at least one device above.</p>
        )}
        {shownDevices.map((device) => {
          const rotate = landscape && device.rotatable;
          const w = rotate ? device.height : device.width;
          const h = rotate ? device.width : device.height;
          return (
            <figure key={device.key} className="flex flex-col items-center gap-2">
              <figcaption className="text-sm font-medium text-slate-700">
                {device.label}
                <span className="ml-2 font-mono text-xs text-slate-400">
                  {w}×{h}
                </span>
              </figcaption>
              <div
                className="overflow-hidden rounded-[1.75rem] border-[10px] border-slate-900 bg-slate-900 shadow-xl"
                style={{ width: w, maxWidth: "100%" }}
              >
                <iframe
                  key={`${device.key}-${targetPath}-${reloadKey}-${rotate}`}
                  src={targetPath}
                  title={`${device.label} preview`}
                  className="block bg-white"
                  style={{ width: w, height: h, border: "0" }}
                  loading="lazy"
                />
              </div>
            </figure>
          );
        })}
      </section>
    </main>
  );
}
