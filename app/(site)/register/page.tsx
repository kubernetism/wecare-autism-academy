import type { Metadata } from "next";
import { AuthLayout } from "@/components/site/auth-layout";
import { RegisterForm } from "@/components/site/auth-forms";

export const metadata: Metadata = {
  title: "Create a parent account",
  description: "Create a WeCare parent portal account.",
};

export default function RegisterPage() {
  return (
    <AuthLayout
      title="Create a parent account"
      intro="For parents and guardians of children at the clinic."
      points={[
        "Once the clinic links your child to your account, you will see their therapy plan here",
        "Linking uses your child's tracking ID and your verified phone number or email",
        "Clinic staff do not need a parent account",
      ]}
    >
      <RegisterForm />
    </AuthLayout>
  );
}
