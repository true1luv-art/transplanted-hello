import { useEffect, useState } from "react";

import { resolveIpfsUrl } from "@/features/lib/storage/ipfs-uri";
import { cn } from "@/lib/utils";

interface IpfsImageProps {
  /** `ipfs://CID[/path]`, a gateway URL, a blob/data URL or a local path. */
  src: string | null | undefined;
  alt: string;
  className?: string;
  fallbackClassName?: string;
}

/**
 * Renders IPFS-hosted artwork through a PUBLIC gateway. An unresolvable or
 * broken reference degrades to a placeholder instead of breaking the grid.
 */
export function IpfsImage({ src, alt, className, fallbackClassName }: IpfsImageProps) {
  const url = resolveIpfsUrl(src);
  const [broken, setBroken] = useState(false);

  useEffect(() => setBroken(false), [url]);

  if (!url || broken) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={cn(
          "flex size-full items-center justify-center bg-muted text-[10px] text-muted-foreground",
          fallbackClassName ?? className,
        )}
      >
        No preview
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      onError={() => setBroken(true)}
      className={className}
    />
  );
}
