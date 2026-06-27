"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Registration failed" }));
        throw new Error((body as any).error ?? "Registration failed");
      }

      const result = await signIn("credentials", {
        email: form.email,
        password: form.password,
        redirect: false,
      });
      if (result?.error) throw new Error("Registration succeeded but sign-in failed. Please log in manually.");
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="space-y-1 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600">
          <Sparkles className="h-6 w-6 text-white" />
        </div>
        <CardTitle className="text-xl">Create account</CardTitle>
        <p className="text-sm text-muted-foreground">Join AI-Ops Sentinel</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Full name</label>
            <Input placeholder="Arjun Dev" value={form.name} onChange={set("name")} required />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Email</label>
            <Input type="email" placeholder="you@company.com" value={form.email} onChange={set("email")} required />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Password</label>
            <Input type="password" placeholder="••••••••" value={form.password} onChange={set("password")} required minLength={8} />
          </div>
          {error && <p className="text-center text-sm text-rose-400">{error}</p>}
          <Button type="submit" className="w-full" variant="gradient" disabled={loading}>
            {loading ? "Creating account…" : "Create account"}
          </Button>
        </form>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Have an account?{" "}
          <a href="/login" className="text-sky-400 hover:underline">Sign in</a>
        </p>
      </CardContent>
    </Card>
  );
}
