
import { useMemo, useState } from "react";
import {
  Settings,
  Share2,
  Send,
  MessageCircle,
  Plus,
  X,
  ExternalLink,
  FileText,
  Loader2,
  User,
  Wallet,
  CheckCircle2,
  CircleDashed,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { accountSettingsSchema, type ContactsValues } from "@/lib/context/schemas";
import { useHiveKeychain } from "@/hooks/useHiveKeychain";
import { fetchPostingJsonMeta } from '@/lib/fetchers/hive-account-helpers';

interface AccountSettingsModalProps {
  username: string;
  initialName?: string;
}

const contactFields = [
  {
    key: "facebook" as const,
    label: "Facebook",
    icon: Share2,
    placeholder: "https://facebook.com/yourprofile",
  },
  {
    key: "telegram" as const,
    label: "Telegram",
    icon: Send,
    placeholder: "@your_handle",
  },
  {
    key: "discord" as const,
    label: "Discord",
    icon: MessageCircle,
    placeholder: "username#0000",
  },
];

type ContactKey = keyof ContactsValues;

const EMPTY_CONTACTS: ContactsValues = {
  facebook:         "",
  telegram:         "",
  discord:          "",
  merchant_account: "",
};

const PAYMENT_PRESETS = ["GCash", "Maya", "Bank Transfer"];

export function AccountSettingsModal({
  username,
  initialName = "",
}: AccountSettingsModalProps) {
  const { updateProfile, publishMerchantPost } = useHiveKeychain();

  const [open, setOpen]                 = useState(false);
  const [tab, setTab]                   = useState<"profile" | "contacts" | "payments" | "merchant">("profile");
  const [name, setName]                 = useState(initialName);
  const [contacts, setContacts]         = useState<ContactsValues>(EMPTY_CONTACTS);
  const [methods, setMethods]           = useState<string[]>([]);
  const [methodInput, setMethodInput]   = useState("");
  const [errors, setErrors]             = useState<Partial<Record<string, string>>>({});
  const [isSaving, setIsSaving]         = useState(false);
  const [isLoading, setIsLoading]       = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishDone, setPublishDone]   = useState(false);

  async function handleOpen(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) return;

    setTab("profile");
    setPublishDone(false);
    setErrors({});
    setIsLoading(true);
    try {
      const meta    = await fetchPostingJsonMeta(username);
      const profile = (meta.profile         ?? {}) as Record<string, string>;
      const contact = (meta.contact          ?? {}) as Record<string, string>;
      const pm      = (meta.payment_methods  ?? []) as string[];

      setName(profile.name ?? initialName);
      setContacts({
        facebook:         contact.facebook         ?? profile.facebook         ?? "",
        telegram:         contact.telegram         ?? profile.telegram         ?? "",
        discord:          contact.discord          ?? profile.discord          ?? "",
        merchant_account: contact.merchant_account ?? profile.merchant_account ?? "",
      });
      setMethods(pm);
    } catch {
      // silently fall back to props
    } finally {
      setIsLoading(false);
    }
  }

  const hasContact = Boolean(contacts.facebook || contacts.telegram || contacts.discord);
  const hasMerchantPost = Boolean(contacts.merchant_account);
  const hasPayments = methods.length > 0;

  const completion = useMemo(() => {
    const checks = [Boolean(name?.trim()), hasContact, hasPayments, hasMerchantPost];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [name, hasContact, hasPayments, hasMerchantPost]);

  function handleContactChange(key: ContactKey, value: string) {
    setContacts((prev) => ({ ...prev, [key]: value }));
  }

  function addMethod(method: string) {
    const trimmed = method.trim();
    if (!trimmed || methods.includes(trimmed)) return;
    setMethods((prev) => [...prev, trimmed]);
    setMethodInput("");
  }

  function removeMethod(method: string) {
    setMethods((prev) => prev.filter((m) => m !== method));
  }

  async function handlePublish() {
    setIsPublishing(true);
    setErrors((prev) => ({ ...prev, publish: undefined }));
    try {
      await publishMerchantPost(username, name || initialName, methods);
      setPublishDone(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Broadcast failed.";
      setErrors((prev) => ({ ...prev, publish: msg }));
    } finally {
      setIsPublishing(false);
    }
  }

  async function handleSave() {
    const result = accountSettingsSchema.safeParse({ name, contacts });
    if (!result.success) {
      const flat = result.error.flatten();
      setErrors(
        Object.fromEntries(
          Object.entries(flat.fieldErrors).map(([k, msgs]) => [k, msgs?.[0]]),
        ),
      );
      return;
    }
    setErrors({});
    setIsSaving(true);
    try {
      await updateProfile(username, {
        name:             result.data.name,
        facebook:         result.data.contacts.facebook,
        telegram:         result.data.contacts.telegram,
        discord:          result.data.contacts.discord,
        merchant_account: result.data.contacts.merchant_account,
        payment_methods:  methods,
      });
      setOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setErrors({ root: msg });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 rounded-full text-xs"
        onClick={() => handleOpen(true)}
      >
        <Settings className="size-3" />
        Account settings
      </Button>

      <Dialog open={open} onOpenChange={handleOpen}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-hidden p-0 gap-0">
          {/* Header */}
          <DialogHeader className="border-b border-border/60 bg-gradient-to-br from-card via-card to-muted/30 px-6 pt-6 pb-5">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <DialogTitle className="text-xl tracking-tight">Account settings</DialogTitle>
                <DialogDescription className="text-xs">
                  Edit your merchant profile, payment methods, and public application post.
                </DialogDescription>
              </div>
              <div className="shrink-0 rounded-full border border-border/60 bg-background/60 px-3 py-1 text-[11px] font-medium text-muted-foreground">
                @{username}
              </div>
            </div>

            {/* Completion bar */}
            <div className="mt-4 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-muted-foreground">
                <span>Profile completeness</span>
                <span className="text-foreground">{completion}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 transition-[width] duration-500"
                  style={{ width: `${completion}%` }}
                />
              </div>
            </div>
          </DialogHeader>

          {/* Tabs */}
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="flex flex-col">
            <TabsList className="mx-6 mt-4 grid grid-cols-4 rounded-xl bg-muted/40 p-1">
              <TabsTrigger value="profile" className="gap-1.5 text-xs">
                <User className="size-3.5" /> Profile
              </TabsTrigger>
              <TabsTrigger value="contacts" className="gap-1.5 text-xs">
                <Share2 className="size-3.5" />
                Contacts
                {hasContact && <CheckCircle2 className="size-3 text-emerald-400" />}
              </TabsTrigger>
              <TabsTrigger value="payments" className="gap-1.5 text-xs">
                <Wallet className="size-3.5" />
                Payments
                {hasPayments && <CheckCircle2 className="size-3 text-emerald-400" />}
              </TabsTrigger>
              <TabsTrigger value="merchant" className="gap-1.5 text-xs">
                <FileText className="size-3.5" />
                Post
                {hasMerchantPost && <CheckCircle2 className="size-3 text-emerald-400" />}
              </TabsTrigger>
            </TabsList>

            <div className="max-h-[55vh] overflow-y-auto px-6 py-5">
              {/* ── Profile ────────────────────────────────────────────────── */}
              <TabsContent value="profile" className="mt-0 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="account-name">Display name</Label>
                  <Input
                    id="account-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your display name"
                    disabled={isLoading}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Shown on your profile and offers. Your Hive handle stays @{username}.
                  </p>
                  {errors.name && (
                    <p className="text-xs text-destructive">{errors.name}</p>
                  )}
                </div>
              </TabsContent>

              {/* ── Contacts ───────────────────────────────────────────────── */}
              <TabsContent value="contacts" className="mt-0 space-y-4">
                <p className="text-xs text-muted-foreground">
                  Add at least one way for counterparties to reach you off-chain.
                </p>
                {contactFields.map(({ key, label, icon: Icon, placeholder }) => {
                  const filled = Boolean(contacts[key]);
                  return (
                    <div
                      key={key}
                      className="space-y-2 rounded-xl border border-border/60 bg-card/40 p-3"
                    >
                      <div className="flex items-center justify-between">
                        <Label htmlFor={`contact-${key}`} className="flex items-center gap-2 text-sm">
                          <Icon className="size-3.5 text-muted-foreground" />
                          {label}
                        </Label>
                        <span
                          className={`flex items-center gap-1 text-[10px] uppercase tracking-wide ${
                            filled ? "text-emerald-400" : "text-muted-foreground"
                          }`}
                        >
                          {filled ? <CheckCircle2 className="size-3" /> : <CircleDashed className="size-3" />}
                          {filled ? "Set" : "Empty"}
                        </span>
                      </div>
                      <Input
                        id={`contact-${key}`}
                        value={contacts[key] ?? ""}
                        onChange={(e) => handleContactChange(key, e.target.value)}
                        placeholder={placeholder}
                        disabled={isLoading}
                        className="h-9 text-sm"
                      />
                      {errors[key] && (
                        <p className="text-xs text-destructive">{errors[key]}</p>
                      )}
                    </div>
                  );
                })}
              </TabsContent>

              {/* ── Payments ───────────────────────────────────────────────── */}
              <TabsContent value="payments" className="mt-0 space-y-4">
                <p className="text-xs text-muted-foreground">
                  Choose presets or add custom methods buyers and sellers can use.
                </p>

                <div className="flex flex-wrap gap-1.5">
                  {PAYMENT_PRESETS.map((preset) => {
                    const active = methods.includes(preset);
                    return (
                      <button
                        key={preset}
                        type="button"
                        disabled={isLoading}
                        onClick={() => active ? removeMethod(preset) : addMethod(preset)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                          active
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                        }`}
                      >
                        {active && <CheckCircle2 className="mr-1 inline size-3" />}
                        {preset}
                      </button>
                    );
                  })}
                </div>

                <div className="flex gap-2">
                  <Input
                    value={methodInput}
                    onChange={(e) => setMethodInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addMethod(methodInput);
                      }
                    }}
                    placeholder="Add custom method&hellip;"
                    disabled={isLoading}
                    className="h-9 text-sm"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-9 shrink-0 gap-1"
                    disabled={isLoading || !methodInput.trim()}
                    onClick={() => addMethod(methodInput)}
                  >
                    <Plus className="size-3.5" /> Add
                  </Button>
                </div>

                {methods.length > 0 && (
                  <div className="rounded-xl border border-border/60 bg-card/40 p-3">
                    <p className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                      Active methods ({methods.length})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {methods.map((m) => (
                        <Badge key={m} variant="secondary" className="gap-1 pr-1 text-[11px]">
                          {m}
                          <button
                            type="button"
                            onClick={() => removeMethod(m)}
                            className="ml-0.5 rounded-full hover:text-destructive"
                            aria-label={`Remove ${m}`}
                          >
                            <X className="size-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* ── Merchant post ──────────────────────────────────────────── */}
              <TabsContent value="merchant" className="mt-0 space-y-4">
                <div className="rounded-xl border border-border/60 bg-gradient-to-br from-primary/5 via-card to-card p-4">
                  <p className="text-sm font-medium text-foreground">Merchant application post</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    A public Hive blog post that serves as your merchant page. Traders leave
                    reviews there as comments. Publish once with Keychain, then paste the URL.
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Step 1 — Publish
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-9 w-full justify-start gap-2"
                    disabled={isLoading || isPublishing || isSaving}
                    onClick={handlePublish}
                  >
                    {isPublishing ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        Waiting for Keychain&hellip;
                      </>
                    ) : publishDone ? (
                      <>
                        <CheckCircle2 className="size-3.5 text-emerald-400" />
                        Post published — copy the URL from your blog
                      </>
                    ) : (
                      <>
                        <FileText className="size-3.5" />
                        Publish merchant post via Keychain
                      </>
                    )}
                  </Button>
                  {errors.publish && (
                    <p className="text-[11px] text-destructive">{errors.publish}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Step 2 — Paste post URL
                  </p>
                  <div className="flex items-center gap-2">
                    <Input
                      id="contact-merchant_account"
                      value={contacts.merchant_account ?? ""}
                      onChange={(e) => handleContactChange("merchant_account", e.target.value)}
                      placeholder="https://peakd.com/@you/merchant-application"
                      disabled={isLoading}
                      className="h-9 text-sm"
                    />
                    {contacts.merchant_account && (
                      <a
                        href={contacts.merchant_account}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 rounded-md border border-border/60 p-2 text-muted-foreground hover:text-foreground"
                        aria-label="Open post"
                      >
                        <ExternalLink className="size-3.5" />
                      </a>
                    )}
                  </div>
                  {errors.merchant_account && (
                    <p className="text-[11px] text-destructive">{errors.merchant_account}</p>
                  )}
                </div>
              </TabsContent>
            </div>
          </Tabs>

          {/* Footer */}
          <div className="flex items-center justify-between gap-2 border-t border-border/60 bg-muted/20 px-6 py-3">
            <div className="text-[11px] text-muted-foreground">
              {errors.root ? (
                <span className="text-destructive">{errors.root}</span>
              ) : (
                <span>Changes are saved to Hive via Keychain.</span>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleOpen(false)}
                disabled={isSaving || isLoading}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving || isLoading} className="gap-1.5">
                {isSaving && <Loader2 className="size-3.5 animate-spin" />}
                {isLoading
                  ? "Loading\u2026"
                  : isSaving
                  ? "Waiting for Keychain\u2026"
                  : "Save changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
