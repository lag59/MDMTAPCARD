import { notFound } from "next/navigation";
import { fetchProfile } from "@/lib/api";
import ProfileCard from "@/components/ProfileCard";

interface Props {
	params: Promise<{ slug: string }>;
}

export default async function PublicTokenRoute({ params }: Props) {
	const { slug } = await params;
	const serverApiBase = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

	const res = await fetch(`${serverApiBase}/api/v1/t/${slug}`, { cache: "no-store" });
	if (!res.ok) {
		return (
			<main className="min-h-screen flex items-center justify-center bg-slate-100 px-6">
				<div className="max-w-md rounded-2xl bg-white p-8 shadow text-center">
					<h1 className="text-xl font-bold text-slate-800">MDM TapCard</h1>
					<p className="mt-3 text-slate-600">This NFC card is no longer active.</p>
				</div>
			</main>
		);
	}

	const data = (await res.json()) as { active?: boolean; slug?: string; message?: string };
	if (!data.active || !data.slug) {
		return (
			<main className="min-h-screen flex items-center justify-center bg-slate-100 px-6">
				<div className="max-w-md rounded-2xl bg-white p-8 shadow text-center">
					<h1 className="text-xl font-bold text-slate-800">MDM TapCard</h1>
					<p className="mt-3 text-slate-600">{data.message || "This NFC card is no longer active."}</p>
				</div>
			</main>
		);
	}

	// Renders the profile directly instead of client-redirecting to /c/[slug],
	// which forced a second full page navigation (and a second cold SSR pass)
	// on every physical NFC tap.
	const profile = await fetchProfile(data.slug);
	if (!profile) notFound();

	return <ProfileCard profile={profile} tagToken={slug} />;
}
