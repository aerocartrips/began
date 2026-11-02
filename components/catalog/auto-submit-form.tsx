"use client";

import { useRouter } from "next/navigation";
import type { FormEvent, ReactNode } from "react";

/**
 * GET form that navigates on every change (filters, sort). Works as a normal
 * form without JavaScript; with it, navigation is a soft client transition.
 */
export default function AutoSubmitForm({ action, className, children, label }: {
  action: string;
  className?: string;
  children: ReactNode;
  label: string;
}) {
  const router = useRouter();

  function navigate(form: HTMLFormElement) {
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(form)) {
      if (typeof value === "string" && value.trim() !== "") params.append(key, value.trim());
    }
    const search = params.toString();
    router.push(search ? `${action}?${search}` : action, { scroll: false });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate(event.currentTarget);
  }

  return (
    <form
      action={action}
      method="get"
      className={className}
      aria-label={label}
      onSubmit={onSubmit}
      onChange={(event) => {
        // Price inputs submit on Enter or the Go button, not on every keystroke.
        if (event.target instanceof HTMLInputElement && event.target.type === "number") return;
        navigate(event.currentTarget);
      }}
    >
      {children}
    </form>
  );
}
