import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ path?: string[] }>;
}

// Alias any /dashboard/* path to the matching /admin/* route (e.g. /dashboard/cards -> /admin/cards).
export default async function DashboardCatchAll({ params }: Props) {
  const { path = [] } = await params;
  redirect(`/admin/${path.join("/")}`);
}
