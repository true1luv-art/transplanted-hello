import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, Menu, Plus, Sparkles, X } from "lucide-react";


import { NavSearch } from "@/components/NavSearch";
import { WalletButton } from "@/components/WalletButton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const links = [{ to: "/collections", label: "Collections" }] as const;

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center gap-6 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2.5">
          <img
            src="/assets/hivex-logo.png"
            alt="HiveX NFTs"
            width={36}
            height={36}
            className="size-9 rounded-xl object-contain"
            draggable={false}
          />
          <span className="font-display text-lg font-bold tracking-tight">HiveX NFTs</span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              activeProps={{ className: "text-foreground bg-surface-raised" }}
              inactiveProps={{ className: "text-muted-foreground" }}
              className="rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <NavSearch className="mx-4 hidden w-full flex-1 md:block" />

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="hidden items-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium transition-colors hover:border-border-strong sm:inline-flex">
                Launch NFT
                <ChevronDown className="size-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem asChild>
                <Link to="/creator/collections/new" className="cursor-pointer">
                  <Plus className="size-4" /> Create Collection
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/generate" className="cursor-pointer">
                  <Sparkles className="size-4" /> Generate NFTs
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <WalletButton />
          <button
            className="rounded-lg border border-border p-2 lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle navigation"
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>

      <nav className={cn("border-t border-border lg:hidden", open ? "block" : "hidden")}>
        <div className="mx-auto grid max-w-[1400px] gap-1 px-4 py-3">
          <NavSearch className="mb-2 md:hidden" onNavigate={() => setOpen(false)} />
          {[
            ...links,
            { to: "/creator/collections/new", label: "Create Collection" } as const,
            { to: "/generate", label: "Generate NFTs" } as const,
          ].map((l) => (
            <Link
              key={l.label}

              to={l.to}
              onClick={() => setOpen(false)}
              activeProps={{ className: "bg-surface-raised text-foreground" }}
              className="rounded-lg px-3 py-2 text-sm text-muted-foreground"
            >
              {l.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
