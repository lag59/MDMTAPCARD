import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { fetchProfile } from "@/lib/api";
import ProfileCard from "@/components/ProfileCard";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tag?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const profile = await fetchProfile(slug);
  if (!profile) return { title: "Card not found" };
  return {
    title: profile.display_name,
    description: profile.biography ?? `Digital business card for ${profile.display_name}`,
    openGraph: {
      images: profile.photo_url ? [profile.photo_url] : [],
    },
  };
}

export default async function ProfilePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { tag } = await searchParams;
  const profile = await fetchProfile(slug);
  if (!profile) notFound();

  return <ProfileCard profile={profile} tagToken={tag} />;
}
