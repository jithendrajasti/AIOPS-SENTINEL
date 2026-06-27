import {
  AlertTriangle,
  AlertCircle,
  ScrollText,
  Activity,
  ShieldCheck,
  Timer,
  CreditCard,
  Network,
  Settings,
  Bell,
  Play,
  FileText,
  Brain,
  Search,
  Download,
  GitBranch,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  "alert-triangle": AlertTriangle,
  "alert-circle": AlertCircle,
  "scroll-text": ScrollText,
  activity: Activity,
  "shield-check": ShieldCheck,
  timer: Timer,
  "credit-card": CreditCard,
  network: Network,
  settings: Settings,
  bell: Bell,
  play: Play,
  "file-text": FileText,
  brain: Brain,
  search: Search,
  download: Download,
  "git-branch": GitBranch,
};

export function DynamicIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Icon = ICONS[name] ?? Activity;
  return <Icon className={className} />;
}
