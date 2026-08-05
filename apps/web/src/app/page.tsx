import { redirect } from "next/navigation";

// Root redirects to web sign-in for authenticated admin access
export default function Home() {
  redirect("/login");
}
