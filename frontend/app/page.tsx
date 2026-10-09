import type { Metadata } from "next";
import AuthPage from "@/components/AuthPage";

export const metadata: Metadata = {
  title: "Sign in | PreLegal",
};

export default function SignInPage() {
  return <AuthPage mode="signin" />;
}
