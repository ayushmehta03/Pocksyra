import { redirect } from "next/navigation";

// Sign-up and sign-in are the same step with Google.
export default function SignupPage() {
  redirect("/login");
}
