"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPatch, apiPost } from "@/lib/api";

type Profile = {
  id: string;
  slug: string;
  display_name: string;
  title: string | null;
  company_name: string;
  card_type: "digital_only" | "nfc_card" | "nfc_button";
  is_active: boolean;
};

type PreparedTag = {
  tag_id: string;
  profile_name: string | null;
  profile_url: string;
  hardware_type: "card" | "button";
};

type Confirmation = {
  tag_id: string;
  status: string;
  success: boolean;
};

export default function DesktopNfcProgrammerPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profileId, setProfileId] = useState("");
  const [hardwareType, setHardwareType] = useState<"nfc_card" | "nfc_button">("nfc_card");
  const [prepared, setPrepared] = useState<PreparedTag | null>(null);
  const [readbackUrl, setReadbackUrl] = useState("");
  const [tagUid, setTagUid] = useState("");
  const [tagType, setTagType] = useState("");
  const [capacityBytes, setCapacityBytes] = useState("");
  const [readerReady, setReaderReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    apiGet<Profile[]>("/api/v1/admin/profiles")
      .then((data) => setProfiles(data.filter((profile) => profile.is_active)))
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load customer profiles."));
  }, []);

  const selectedProfile = useMemo(() => profiles.find((profile) => profile.id === profileId), [profileId, profiles]);

  const prepare = async () => {
    if (!profileId) {
      setError("Select an NFC-ready profile before preparing a tag.");
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    setPrepared(null);
    try {
      const targetHardwareType = selectedProfile?.card_type === "nfc_button" ? "nfc_button" : selectedProfile?.card_type === "nfc_card" ? "nfc_card" : hardwareType;
      if (selectedProfile?.card_type === "digital_only") {
        await apiPatch(`/api/v1/profiles/${selectedProfile.slug}`, { card_type: targetHardwareType });
        setProfiles((current) => current.map((profile) => profile.id === selectedProfile.id ? { ...profile, card_type: targetHardwareType } : profile));
      }
      const result = await apiPost<PreparedTag>(`/api/v1/profiles/${profileId}/nfc/prepare`, {});
      setPrepared(result);
      setReadbackUrl(result.profile_url);
      setTagUid("");
      setTagType("");
      setCapacityBytes("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not prepare the NFC tag.");
    } finally {
      setBusy(false);
    }
  };

  const copyUrl = async () => {
    if (!prepared) return;
    await navigator.clipboard.writeText(prepared.profile_url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const confirm = async () => {
    if (!prepared) return;
    if (!readbackUrl.trim()) {
      setError("Paste the URL read back from the NFC tag before confirming.");
      return;
    }
    const parsedCapacity = capacityBytes.trim() ? Number.parseInt(capacityBytes, 10) : undefined;
    if (parsedCapacity !== undefined && (!Number.isInteger(parsedCapacity) || parsedCapacity < 1)) {
      setError("Capacity must be a positive whole number.");
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await apiPost<Confirmation>(`/api/v1/nfc-tags/${prepared.tag_id}/confirm`, {
        verified_url: readbackUrl.trim(),
        tag_uid: tagUid.trim() || undefined,
        tag_type: tagType.trim() || undefined,
        capacity_bytes: parsedCapacity,
      });
      if (!result.success) {
        setError("The reader returned a different URL. The tag was marked as failed; prepare a new tag before retrying.");
        return;
      }
      setSuccess(`${prepared.hardware_type === "button" ? "TapButton" : "TapCard"} verified and saved to inventory.`);
      setPrepared(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not confirm the NFC write.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-4xl">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-indigo-700">MDM TapCard — NFC Programmer</p>
      <h1 className="mt-2 text-3xl font-bold text-slate-900">Program with your desktop reader</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
        Use your ACS ACR122U or compatible desktop writer for the physical write. TapCard reserves the permanent URL and records the
        read-back verification in inventory.
      </p>

      {error ? <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      {success ? <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}

      <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Customer & device</h2>
        <p className="mt-1 text-sm text-slate-500">Select any active customer profile, choose its physical format when needed, then prepare a secure tag URL.</p>
        <select value={profileId} onChange={(event) => setProfileId(event.target.value)} className="mt-5 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900">
          <option value="">Choose a customer profile…</option>
          {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.display_name} — {profile.company_name} ({profile.card_type === "digital_only" ? "Choose format" : profile.card_type === "nfc_button" ? "TapButton" : "TapCard"})</option>)}
        </select>
        {selectedProfile ? (
          <dl className="mt-5 grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
            <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Customer</dt><dd className="mt-1 font-semibold text-slate-900">{selectedProfile.display_name}</dd></div>
            <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Company</dt><dd className="mt-1 font-semibold text-slate-900">{selectedProfile.company_name}</dd></div>
            <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Product</dt><dd className="mt-1 font-semibold text-slate-900">{selectedProfile.card_type === "digital_only" ? "Choose below" : selectedProfile.card_type === "nfc_button" ? "NFC TapButton" : "NFC TapCard"}</dd></div>
            <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reader</dt><dd className="mt-1 font-semibold text-slate-900">ACS ACR122U or compatible PC/SC reader</dd></div>
          </dl>
        ) : null}
        {selectedProfile?.card_type === "digital_only" ? (
          <fieldset className="mt-5">
            <legend className="text-sm font-semibold text-slate-900">Physical format to program</legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {(["nfc_card", "nfc_button"] as const).map((type) => (
                <label key={type} className={`cursor-pointer rounded-xl border p-4 text-sm ${hardwareType === type ? "border-indigo-500 bg-indigo-50" : "border-slate-200 bg-white"}`}>
                  <input type="radio" name="hardware-type" value={type} checked={hardwareType === type} onChange={() => setHardwareType(type)} className="mr-2" />
                  <span className="font-semibold text-slate-900">{type === "nfc_button" ? "NFC TapButton" : "NFC TapCard"}</span>
                  <span className="mt-1 block text-xs text-slate-500">{type === "nfc_button" ? "Adhesive tag for a phone, counter, or vehicle." : "Physical tap card for sharing contact details."}</span>
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">Preparing this tag will update this profile from digital-only to the selected physical format.</p>
          </fieldset>
        ) : null}
        <label className="mt-5 flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-4 text-sm text-slate-700">
          <input type="checkbox" checked={readerReady} onChange={(event) => setReaderReady(event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-indigo-600" />
          <span><span className="font-semibold text-slate-900">Reader ready</span><span className="block text-xs text-slate-500">Confirm your reader software detects the ACR122U and a writable NFC tag.</span></span>
        </label>
        <button type="button" onClick={prepare} disabled={busy || !profileId || !readerReady} className="mt-5 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50">
          {busy ? "Preparing…" : selectedProfile?.card_type === "nfc_button" ? "Prepare TapButton" : "Prepare TapCard"}
        </button>
      </section>

      {prepared ? (
        <section className="mt-5 rounded-2xl border border-cyan-200 bg-cyan-50 p-6">
          <div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-600 text-sm font-bold text-white">1</span><div><h2 className="font-semibold text-slate-900">Program {prepared.hardware_type === "button" ? "TapButton" : "TapCard"}</h2><p className="text-sm text-slate-600">In your reader software, create one NDEF URI record with this exact secure URL.</p></div></div>
          <div className="mt-5 flex flex-col gap-3 rounded-xl border border-cyan-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <code className="break-all text-sm text-slate-800">{prepared.profile_url}</code>
            <button type="button" onClick={copyUrl} className="shrink-0 rounded-lg border border-cyan-300 bg-cyan-50 px-3 py-2 text-sm font-semibold text-cyan-800 hover:bg-cyan-100">{copied ? "Copied" : "Copy URL"}</button>
          </div>
          <p className="mt-4 text-sm text-slate-700">Place the NFC tag on the reader, write the URI record, then read it back. Do not lock the physical tag until verification succeeds.</p>

          <div className="mt-7 flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-600 text-sm font-bold text-white">2</span><div><h2 className="font-semibold text-slate-900">Verify & register</h2><p className="text-sm text-slate-600">Paste the URL returned by the reader to register the completed write in inventory.</p></div></div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-700 md:col-span-2">Read-back URL *<input required value={readbackUrl} onChange={(event) => setReadbackUrl(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-mono text-xs text-slate-900" /></label>
            <label className="text-sm font-medium text-slate-700">Tag UID (optional)<input value={tagUid} onChange={(event) => setTagUid(event.target.value)} placeholder="Reader UID" className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900" /></label>
            <label className="text-sm font-medium text-slate-700">Tag type (optional)<input value={tagType} onChange={(event) => setTagType(event.target.value)} placeholder="e.g. NTAG213" className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900" /></label>
            <label className="text-sm font-medium text-slate-700">Capacity in bytes (optional)<input inputMode="numeric" value={capacityBytes} onChange={(event) => setCapacityBytes(event.target.value)} placeholder="e.g. 144" className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900" /></label>
          </div>
          <button type="button" onClick={confirm} disabled={busy} className="mt-5 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Verifying…" : "Verify & register tag"}</button>
        </section>
      ) : null}
    </div>
  );
}