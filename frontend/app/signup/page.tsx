import type { Metadata } from "next";
import AuthPage from "@/components/AuthPage";

export const metadata: Metadata = {
  title: "Create account | PreLegal",
};

export default function SignUpPage() {
  return <AuthPage mode="signup" />;
}
