import { redirect } from "next/navigation";

// /dashboard is an alias for the admin area.
export default function DashboardIndex() {
  redirect("/admin");
}
