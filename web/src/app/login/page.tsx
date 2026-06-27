import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="login-page">
      <div className="login-card">
        <header className="login-card__header">
          <p className="text-overline">小窗</p>
          <h1 className="login-card__title font-display">小窗</h1>
        </header>

        <Suspense fallback={<div className="login-form-skeleton" />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
