import { CheckCircle2, AlertTriangle, XCircle, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ServiceStatus, Severity, IncidentStatus } from "@/types";

const SERVICE_MAP: Record<
  ServiceStatus,
  { label: string; variant: "success" | "warning" | "destructive"; icon: React.ElementType }
> = {
  healthy: { label: "Healthy", variant: "success", icon: CheckCircle2 },
  degraded: { label: "Degraded", variant: "warning", icon: AlertTriangle },
  unhealthy: { label: "Unhealthy", variant: "destructive", icon: AlertCircle },
  down: { label: "Down", variant: "destructive", icon: XCircle },
};

export function ServiceStatusBadge({ status }: { status: ServiceStatus }) {
  const { label, variant, icon: Icon } = SERVICE_MAP[status];
  return (
    <Badge variant={variant}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Badge>
  );
}

const SEVERITY_MAP: Record<
  Severity,
  { label: string; variant: "destructive" | "warning" | "default" | "secondary" }
> = {
  critical: { label: "Critical", variant: "destructive" },
  high: { label: "High", variant: "warning" },
  medium: { label: "Medium", variant: "default" },
  low: { label: "Low", variant: "secondary" },
  info: { label: "Info", variant: "secondary" },
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  const { label, variant } = SEVERITY_MAP[severity];
  return (
    <Badge variant={variant}>
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          severity === "critical" && "bg-destructive animate-pulse",
          severity === "high" && "bg-warning",
          severity === "medium" && "bg-primary",
          (severity === "low" || severity === "info") && "bg-muted-foreground"
        )}
      />
      {label}
    </Badge>
  );
}

const INCIDENT_MAP: Record<
  IncidentStatus,
  { label: string; variant: "destructive" | "warning" | "success" | "secondary" }
> = {
  open: { label: "Open", variant: "destructive" },
  investigating: { label: "Investigating", variant: "warning" },
  resolved: { label: "Resolved", variant: "success" },
  dismissed: { label: "Dismissed", variant: "secondary" },
};

export function IncidentStatusBadge({ status }: { status: IncidentStatus }) {
  const { label, variant } = INCIDENT_MAP[status];
  return <Badge variant={variant}>{label}</Badge>;
}
