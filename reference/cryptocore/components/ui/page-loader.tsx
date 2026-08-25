import { Loader2 } from "lucide-react";

export function PageLoader() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/90 backdrop-blur-sm animate-fade-in">
      <div className="relative flex items-center justify-center">
        <div className="absolute h-16 w-16 rounded-full border border-primary/20" />
        <div className="absolute h-16 w-16 rounded-full border-t-2 border-primary animate-spin" />
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
      <p className="mt-4 text-sm font-medium text-muted-foreground animate-pulse">
        Loading CryptoCore...
      </p>
    </div>
  );
}
