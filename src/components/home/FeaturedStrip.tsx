import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Sparkles, Star } from "lucide-react";

import { IpfsImage } from "@/components/IpfsImage";
import { hive } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Collection } from "@/features/types/domain/collections";

export function FeaturedStrip({ collections }: { collections: Collection[] }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const drag = useRef({ active: false, startX: 0, startScroll: 0, moved: false });
  const [dragging, setDragging] = useState(false);

  const sync = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    sync();
    const el = scroller.current;
    if (!el) return;
    const onResize = () => sync();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [sync, collections.length]);

  const scrollBy = (dir: 1 | -1) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(280, el.clientWidth * 0.8), behavior: "smooth" });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const el = scroller.current;
    if (!el || e.pointerType === "touch") return;
    drag.current = { active: true, startX: e.clientX, startScroll: el.scrollLeft, moved: false };
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const el = scroller.current;
    if (!el || !drag.current.active) return;
    const dx = e.clientX - drag.current.startX;
    if (Math.abs(dx) > 4) drag.current.moved = true;
    el.scrollLeft = drag.current.startScroll - dx;
  };

  const endDrag = () => {
    drag.current.active = false;
    setDragging(false);
  };

  const blockClickAfterDrag = (e: React.MouseEvent) => {
    if (drag.current.moved) {
      e.preventDefault();
      e.stopPropagation();
      drag.current.moved = false;
    }
  };

  return (
    <div className="relative">
      <div
        ref={scroller}
        onScroll={sync}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={blockClickAfterDrag}
        className={cn(
          "flex touch-pan-y gap-3 overflow-x-auto overscroll-x-contain scroll-smooth pb-2 select-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          dragging ? "cursor-grabbing" : "cursor-grab",
        )}
      >
        <div className="surface-card hero-bg relative w-[260px] shrink-0 overflow-hidden p-5 sm:w-[300px]">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-2.5 py-1 text-[11px] font-medium backdrop-blur-sm">
            <Sparkles className="size-3 text-primary" /> What&apos;s new
          </span>
          <h2 className="mt-6 font-display text-2xl leading-tight font-bold">
            Launch on <span className="text-gradient">Hive</span> in minutes
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Generate art, mint with HIVE, trade instantly.
          </p>
          <Link
            to="/creator/collections/new"
            draggable={false}
            className="mt-5 inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Create collection
          </Link>
        </div>

        {collections.map((c) => (
          <Link
            key={c.id}
            to="/collections/$id"
            params={{ id: c.id }}
            draggable={false}
            className="group surface-card relative w-[260px] shrink-0 overflow-hidden sm:w-[300px]"
          >
            <IpfsImage
              src={c.image}
              alt={`${c.name} cover artwork`}
              className="h-[240px] w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-background/70 px-2.5 py-1 text-[11px] font-medium backdrop-blur-sm">
              <Star className="size-3 text-primary" /> Featured
            </span>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/80 to-transparent p-4 pt-10">
              <h3 className="truncate font-display text-base font-semibold group-hover:text-primary">
                {c.name}
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Floor <span className="font-medium text-foreground">{hive(c.floorPrice)}</span>
              </p>
            </div>
          </Link>
        ))}
      </div>

      <button
        type="button"
        aria-label="Previous featured collections"
        onClick={() => scrollBy(-1)}
        className={cn(
          "absolute top-1/2 left-2 z-10 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full border border-border-strong bg-background/80 backdrop-blur-sm transition-opacity hover:bg-surface sm:flex",
          canPrev ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <ChevronLeft className="size-4" />
      </button>
      <button
        type="button"
        aria-label="Next featured collections"
        onClick={() => scrollBy(1)}
        className={cn(
          "absolute top-1/2 right-2 z-10 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full border border-border-strong bg-background/80 backdrop-blur-sm transition-opacity hover:bg-surface sm:flex",
          canNext ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
