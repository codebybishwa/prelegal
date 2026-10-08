import type { Metadata } from "next";
import LoginForm from "@/components/LoginForm";

export const metadata: Metadata = {
  title: "Sign in | PreLegal",
};

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-lg border-t-4 border-brand-accent bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-brand-navy">PreLegal</h1>
        <p className="mt-1 mb-6 text-sm text-brand-gray">Sign in to draft your legal agreements.</p>
        <LoginForm />
      </div>
    </main>
  );
}
