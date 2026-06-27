import Image from "next/image";
import { cn } from "@/lib/utils";

export function LogoMark({
  size = 36,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-lg ring-1 ring-white/10",
        className
      )}
      style={{ width: size, height: size }}
    >
      <Image
        src="/logo-mark.png"
        alt="AI-Ops Sentinel"
        fill
        sizes="48px"
        className="object-cover"
        priority
      />
    </div>
  );
}

export function Logo({
  collapsed = false,
  className,
}: {
  collapsed?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark size={34} />
      {!collapsed && (
        <div className="flex flex-col leading-none">
          <span className="text-[15px] font-bold tracking-tight text-foreground">
            AI-Ops <span className="text-gradient">Sentinel</span>
          </span>
          <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Observability
          </span>
        </div>
      )}
    </div>
  );
}
