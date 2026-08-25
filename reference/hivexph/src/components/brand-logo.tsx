import { cn } from "@/lib/utils";
import logoAsset from "@/assets/hivex-logo.png.asset.json";

export function BrandLogo({ className }: { className?: string }) {
  return (
    <img
      src={logoAsset.url}
      alt="HiveX PH"
      width={32}
      height={32}
      className={cn("size-8 object-contain", className)}
      draggable={false}
      loading="lazy"
    />
  );
}
