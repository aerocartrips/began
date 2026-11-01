import {
  LayoutDashboard,
  MapPin,
  MessageSquare,
  Package,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  UserRound,
} from "lucide-react";

export const ACCOUNT_NAV_ITEMS = [
  { href: "/account", label: "Overview", icon: LayoutDashboard },
  { href: "/account/profile", label: "Personal information", icon: UserRound },
  { href: "/account/addresses", label: "My addresses", icon: MapPin },
  { href: "/account/orders", label: "My orders", icon: Package },
  { href: "/account/reviews", label: "Reviews", icon: Star },
  { href: "/account/support", label: "Support", icon: MessageSquare },
  { href: "/account/security", label: "Security", icon: ShieldCheck },
  { href: "/account/preferences", label: "Preferences", icon: SlidersHorizontal },
  { href: "/account/settings", label: "Account settings", icon: Settings },
] as const;
