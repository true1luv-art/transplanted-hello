import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Megaphone } from "lucide-react";

const ANNOUNCEMENTS: {
  id: string;
  title: string;
  body: string;
  when: string;
  tag: string;
}[] = [];

export const Route = createFileRoute("/_app/announcements")({
  head: () => ({
    meta: [
      { title: "Announcements — HiveX PH" },
      {
        name: "description",
        content:
          "Product updates, new features, and platform news from the HiveX PH team.",
      },
    ],
  }),
  component: AnnouncementsPage,
  errorComponent: ({ error }) => (
    <p className="py-12 text-center text-destructive">{error.message}</p>
  ),
  notFoundComponent: () => (
    <p className="py-12 text-center text-muted-foreground">Page not found</p>
  ),
});

function AnnouncementsPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Platform"
        title="Announcements"
        description="Product updates, new features, and platform news from the HiveX PH team."
      />
      {ANNOUNCEMENTS.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <Megaphone className="size-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-[14px] font-medium text-foreground">
              No announcements yet
            </p>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              Check back soon for platform updates and new features.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {ANNOUNCEMENTS.map((item) => (
            <Card key={item.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 flex-1 gap-3">
                    <div className="mt-0.5 flex size-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Megaphone className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-foreground">
                        {item.title}
                      </p>
                      <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                        {item.body}
                      </p>
                      <p className="mt-2 text-[12px] text-muted-foreground">
                        {item.when}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="secondary"
                    className="flex-shrink-0 text-[11px]"
                  >
                    {item.tag}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
