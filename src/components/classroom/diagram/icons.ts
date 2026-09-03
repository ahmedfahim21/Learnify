import {
  Boxes,
  Brain,
  Building2,
  Cloud,
  Cog,
  Database,
  FileText,
  Fingerprint,
  Flame,
  Gauge,
  Globe,
  HardDrive,
  Layers,
  Mail,
  MessageSquare,
  Monitor,
  Network,
  Server,
  Settings,
  Shield,
  ShieldCheck,
  Smartphone,
  Split,
  Timer,
  User,
  Wallet,
  Waypoints,
  Workflow,
  type LucideIcon,
} from "lucide-react";

import type { DiagramIcon } from "@/lib/a2ui/catalog";

/**
 * Closed map from {@link DiagramIcon} to a vetted lucide-react component.
 * Exhaustive by construction (`Record<DiagramIcon, ...>`) — adding an enum
 * value without a mapping here is a compile error, so the enum and the render
 * surface can never drift apart.
 */
export const DIAGRAM_ICON_COMPONENTS: Record<DiagramIcon, LucideIcon> = {
  client: Monitor,
  browser: Globe,
  mobile: Smartphone,
  user: User,

  api: Waypoints,
  gateway: Split,
  "load-balancer": Network,
  proxy: Shield,
  cdn: Cloud,
  dns: Globe,
  firewall: ShieldCheck,

  service: Server,
  worker: Cog,
  function: Flame,
  scheduler: Timer,

  database: Database,
  sql: Database,
  nosql: Layers,
  cache: Gauge,
  "search-index": Boxes,
  "vector-db": Boxes,

  "blob-storage": HardDrive,
  "data-warehouse": HardDrive,
  shard: Layers,
  replica: Layers,

  queue: Workflow,
  stream: Workflow,

  llm: Brain,
  embedding: Fingerprint,
  agent: Brain,

  auth: Fingerprint,
  monitoring: Gauge,
  config: Settings,

  document: FileText,
  web: Globe,
  email: Mail,
  chat: MessageSquare,
  notification: MessageSquare,
  payment: Wallet,

  region: Building2,
  datacenter: Building2,
  internet: Globe,
  generic: Boxes,
};
