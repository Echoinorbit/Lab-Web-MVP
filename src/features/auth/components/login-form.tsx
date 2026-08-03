"use client";

import { signIn } from "next-auth/react";
import { useState, type FormEvent } from "react";

import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { StatusNotice } from "@/shared/components/ui/status-notice";

export function LoginForm({ initialNotice = null }: { initialNotice?: string | null }) {
  const [error, setError] = useState<string | null>(initialNotice);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    const result = await signIn("credentials", {
      username: String(form.get("username") ?? ""),
      password: String(form.get("password") ?? ""),
      redirect: false,
      callbackUrl: "/",
    });
    setPending(false);
    if (result?.error) {
      setError(result.error === "CredentialsSignin" ? "用户名或密码错误" : "登录服务暂时不可用，请检查数据库连接。");
      return;
    }
    window.location.href = result?.url ?? "/";
  };

  return (
    <div>
      <form className="space-y-5" onSubmit={handleSubmit} aria-busy={pending}>
        <div className="space-y-2">
          <Label htmlFor="username">用户名</Label>
          <Input id="username" name="username" autoComplete="username" required autoFocus />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">密码</Label>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        {error ? <StatusNotice variant="error">{error}</StatusNotice> : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "正在登录…" : "登录"}
        </Button>
      </form>
    </div>
  );
}
