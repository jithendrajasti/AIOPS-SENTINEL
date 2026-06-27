import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <LogoMark size={64} />
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-sky-400">404</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Signal lost</h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          The page you&apos;re looking for has been resolved, dismissed, or never
          existed in the AI-Ops Sentinel pipeline.
        </p>
      </div>
      <Link
        href="/dashboard"
        className="rounded-lg bg-gradient-to-r from-sky-500 to-indigo-500 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-500/20 transition-opacity hover:opacity-90"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}
