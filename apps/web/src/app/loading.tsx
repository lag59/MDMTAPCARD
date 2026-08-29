export default function GlobalLoading() {
  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="rounded-xl bg-white shadow px-6 py-5 flex items-center gap-3">
        <span className="h-3 w-3 rounded-full bg-blue-600 animate-pulse" />
        <p className="text-sm text-slate-700">Loading MDM TapCard...</p>
      </div>
    </main>
  );
}
