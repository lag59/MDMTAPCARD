import { redirect } from "next/navigation";
import { apiBaseUrl } from "@/lib/api";

interface Props {
	params: Promise<{ slug: string }>;
}

export default async function PublicTokenRoute({ params }: Props) {
	const { slug } = await params;

	const res = await fetch(`${apiBaseUrl}/api/v1/t/${slug}`, { cache: "no-store" });
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

	const data = (await res.json()) as { active?: boolean; slug?: string; redirect_url?: string; message?: string };
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

	if (data.redirect_url) {
		redirect(data.redirect_url);
	}

	redirect(`/c/${data.slug}`);
}
