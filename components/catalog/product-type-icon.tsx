import {
  BedDouble,
  Baby,
  Crown,
  Flower2,
  Footprints,
  Gem,
  Gift,
  Glasses,
  Layers,
  Package,
  Shirt,
  ShoppingBag,
  Sparkles,
  Spool,
  Watch,
  type LucideIcon,
} from "lucide-react";

/** The icons a product type can show with (lib/constants/catalog.js PRODUCT_TYPE_ICONS). */
export const PRODUCT_TYPE_ICON_COMPONENTS: Record<string, LucideIcon> = {
  shirt: Shirt,
  sparkles: Sparkles,
  layers: Layers,
  crown: Crown,
  flower: Flower2,
  footprints: Footprints,
  baby: Baby,
  "shopping-bag": ShoppingBag,
  gem: Gem,
  watch: Watch,
  glasses: Glasses,
  "bed-double": BedDouble,
  spool: Spool,
  gift: Gift,
  package: Package,
};

export default function ProductTypeIcon({ icon, size = 18 }: { icon: string; size?: number }) {
  const Icon = PRODUCT_TYPE_ICON_COMPONENTS[icon] ?? Package;
  return <Icon size={size} strokeWidth={1.8} aria-hidden="true" />;
}
