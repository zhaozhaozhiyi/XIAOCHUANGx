"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  OTP_RESEND_SECONDS,
  validateMainlandPhone,
  writeAuthProfile,
  type AuthProfile,
} from "@/lib/auth";

type FieldError = {
  phone?: string;
  code?: string;
  agreed?: string;
  form?: string;
};

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/chat";

  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState<FieldError>({});
  const [countdown, setCountdown] = useState(0);
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = window.setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [countdown]);

  const sendCode = useCallback(async () => {
    setErrors((e) => ({ ...e, phone: undefined, form: undefined }));
    if (!validateMainlandPhone(phone)) {
      setErrors((e) => ({ ...e, phone: "请输入正确的 11 位手机号" }));
      return;
    }
    if (countdown > 0) return;

    setSending(true);
    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErrors((e) => ({ ...e, form: data.error ?? "发送失败，请稍后重试" }));
        return;
      }
      setCountdown(OTP_RESEND_SECONDS);
    } catch {
      setErrors((e) => ({ ...e, form: "网络异常，请稍后重试" }));
    } finally {
      setSending(false);
    }
  }, [phone, countdown]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: FieldError = {};
    if (!validateMainlandPhone(phone)) {
      next.phone = "请输入正确的 11 位手机号";
    }
    if (!/^\d{6}$/.test(code.trim())) {
      next.code = "请输入 6 位验证码";
    }
    if (!agreed) {
      next.agreed = "请先阅读并同意相关协议";
    }
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }

    setSubmitting(true);
    setErrors({});
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code, agreed }),
      });
      const data = (await res.json()) as {
        error?: string;
        profile?: AuthProfile;
      };
      if (!res.ok) {
        setErrors({ form: data.error ?? "登录失败，请重试" });
        return;
      }
      if (data.profile) {
        writeAuthProfile(data.profile);
      }
      const target =
        redirect.startsWith("/") && !redirect.startsWith("//")
          ? redirect
          : "/chat";
      router.replace(target);
      router.refresh();
    } catch {
      setErrors({ form: "网络异常，请稍后重试" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="login-form" onSubmit={onSubmit} noValidate>
      <div>
        <label htmlFor="login-phone" className="login-label">
          手机号
        </label>
        <input
          id="login-phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          maxLength={11}
          placeholder="11 位手机号"
          className="login-input"
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value.replace(/\D/g, "").slice(0, 11));
            setErrors((err) => ({ ...err, phone: undefined }));
          }}
        />
        {errors.phone && <p className="login-error">{errors.phone}</p>}
      </div>

      <div>
        <label htmlFor="login-code" className="login-label">
          验证码
        </label>
        <div className="login-code-row">
          <input
            id="login-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="验证码"
            className="login-input min-w-0 flex-1"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
              setErrors((err) => ({ ...err, code: undefined }));
            }}
          />
          <button
            type="button"
            className="btn btn-sidebar-new login-code-btn shrink-0"
            disabled={sending || countdown > 0}
            onClick={sendCode}
          >
            {countdown > 0 ? `${countdown}s 后重发` : sending ? "发送中…" : "获取验证码"}
          </button>
        </div>
        {errors.code && <p className="login-error">{errors.code}</p>}
      </div>

      <label className="login-agree">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => {
            setAgreed(e.target.checked);
            setErrors((err) => ({ ...err, agreed: undefined }));
          }}
          className="login-checkbox"
        />
        <span>
          同意
          <button
            type="button"
            className="login-link"
            onClick={() => window.alert("原型：《用户协议》占位")}
          >
            《用户协议》
          </button>
          <button
            type="button"
            className="login-link"
            onClick={() => window.alert("原型：《隐私政策》占位")}
          >
            《隐私政策》
          </button>
        </span>
      </label>
      {errors.agreed && <p className="login-error -mt-2">{errors.agreed}</p>}

      {errors.form && <p className="login-error login-error--block">{errors.form}</p>}

      <button
        type="submit"
        className="btn btn-primary login-submit w-full"
        disabled={submitting}
      >
        {submitting ? "登录中…" : "登录"}
      </button>
    </form>
  );
}
