import { redirect } from "next/navigation";

export default function Home() {
  // The dashboard decides whether to send you on to /login.
  redirect("/dashboard");
}
