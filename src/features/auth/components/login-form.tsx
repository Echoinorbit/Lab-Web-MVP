"use client";

import { signIn } from "next-auth/react";
import { useState, type FormEvent } from "react";

import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

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
    <Card className="w-full max-w-[400px] border-0 bg-transparent shadow-none">
      <CardHeader className="border-0 px-0 pb-7 pt-0">
        <div className="mb-9 flex items-center gap-2.5 text-[15px] font-semibold tracking-[-0.018em]">
          <span className="h-2.5 w-2.5 rounded-full bg-primary" aria-hidden="true" />
          实验室协作
        </div>
        <CardTitle className="text-[36px] leading-tight tracking-[-0.04em]">欢迎回来</CardTitle>
        <p className="mt-2 text-[15px] leading-6 text-muted-foreground">登录后继续管理项目、进度与实验室协作。</p>
      </CardHeader>
      <CardContent className="p-0">
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="username">用户名</Label>
            <Input id="username" name="username" autoComplete="username" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">密码</Label>
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          {error ? <p className="rounded-xl bg-destructive/10 px-3.5 py-3 text-sm text-destructive">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "登录中" : "登录"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
