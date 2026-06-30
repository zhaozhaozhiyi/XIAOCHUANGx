import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";
import { LoginVideo } from "@/components/auth/LoginVideo";

export default function LoginPage() {
  return (
    <div className="login-page">
      <div className="login-bg-logo" aria-hidden>
        <svg viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="1024" height="1024" rx="230" fill="var(--accent)" />
          <circle
            cx="512"
            cy="512"
            r="288"
            stroke="var(--bg)"
            strokeWidth="128"
          />
        </svg>
      </div>

      <div className="login-bg-circle" aria-hidden>
        <svg viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="512" cy="512" r="288" stroke="#e6e1d3" strokeWidth="120" />
        </svg>
      </div>

      <div className="login-split">
        <div className="login-split__form">
          <div className="login-card">
            <header className="login-card__header">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="login-card__logo" src="/icon.svg" alt="小窗" width={48} height={48} />
              <h1 className="login-card__title font-display">小窗</h1>
            </header>

            <Suspense fallback={<div className="login-form-skeleton" />}>
              <LoginForm />
            </Suspense>
          </div>
        </div>

        <div className="login-split__media" aria-hidden>
          <LoginVideo src="/login-video.mp4" />
        </div>
      </div>
    </div>
  );
}
