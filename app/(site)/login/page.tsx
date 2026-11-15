import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthLayout } from "@/components/site/auth-layout";
import { LoginForm } from "@/components/site/auth-forms";

export const metadata: Metadata = {
  title: "Log in",
  description: "Log in to the WeCare parent portal or the clinic app.",
  robots: { index: false },
};

export default function LoginPage() {
  return (
    <AuthLayout
      title="Log in"
      intro="One log in page for parents and clinic staff."
      points={[
        "Parents go to the parent portal",
        "Clinic staff go to the clinic app",
        "Staff accounts are created by the clinic administrator",
      ]}
    >
      <Suspense fallback={<p className="text-ink-soft">Loading the log in form…</p>}>
        <LoginForm />
      </Suspense>
    </AuthLayout>
  );
}
