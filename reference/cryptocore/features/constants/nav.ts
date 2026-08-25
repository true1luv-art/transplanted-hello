import type { LucideIcon } from "lucide-react";
import { Boxes, LayoutDashboard, Backpack, ShoppingBag, Store } from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  description: string;
}

export const NAV_ITEMS: NavItem[] = [
  {
    to: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    description: "Vault, mining, stats and activity",
  },
  { to: "/inventory", label: "Inventory", icon: Backpack, description: "All the gear you own" },
  { to: "/chests", label: "Chests", icon: Boxes, description: "Open chests for random gear" },
  {
    to: "/marketplace",
    label: "Marketplace",
    icon: ShoppingBag,
    description: "Buy and sell rig parts",
  },
  {
    to: "/shop",
    label: "Cosmetics Shop",
    icon: Store,
    description: "Unlock avatars, banners and backgrounds",
  },
];
