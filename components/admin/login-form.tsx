"use client";

import { useActionState } from "react";
import LoadingButton from "@/components/ui/buttons/LoadingButton";
import { loginAdmin } from "@/lib/admin/actions";
import { initialAdminLoginState } from "@/features/auth/types/admin-login";

export default function AdminLoginForm() {
  const [state, action, pending] = useActionState(loginAdmin, initialAdminLoginState);

  return (
    <form className="admin-login-form" action={action}>
      <label>
        Administrator email
        <input
          name="email"
          type="email"
          autoComplete="username"
          maxLength={254}
          required
        />
      </label>
      <label>
        Password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          maxLength={1024}
          required
        />
      </label>
      {state.error && <p className="admin-form-error" role="alert">{state.error}</p>}
      <LoadingButton type="submit" loading={pending} loadingText="Signing in..." className="admin-submit-button">
        Sign in
      </LoadingButton>
    </form>
  );
}