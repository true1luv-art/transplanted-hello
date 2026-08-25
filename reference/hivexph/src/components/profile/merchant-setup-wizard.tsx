import { useEffect, useMemo, useState } from "react";
import {
  Sparkles,
  User,
  Send,
  MessageCircle,
  Share2,
  Wallet,
  FileText,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ExternalLink,
  Plus,
  X,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { contactsSchema, type ContactsValues } from "@/lib/context/schemas";
import { useHiveKeychain } from "@/hooks/useHiveKeychain";
import { fetchPostingJsonMeta } from "@/lib/fetchers/hive-account-helpers";
import { cn } from "@/lib/utils";

interface MerchantSetupWizardProps {
  username: string;
  initialName?: string;
  /** Open programmatically (controlled). If omitted, an internal trigger button is rendered. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Optionally start at a specific step index (0-based). */
  startStep?: number;
  /** Called after a successful final save so the parent can refresh. */
  onComplete?: () => void;
  /** Render no built-in trigger button — caller supplies its own. */
  hideTrigger?: boolean;
}

type StepId = "profile" | "contacts" | "payments" | "post";

const STEPS: { id: StepId; label: string; icon: typeof User }[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "contacts", label: "Contacts", icon: Send },
  { id: "payments", label: "Payments", icon: Wallet },
  { id: "post", label: "Merchant post", icon: FileText },
];

const PAYMENT_PRESETS = ["GCash", "Maya", "Bank Transfer"];

const EMPTY_CONTACTS: ContactsValues = {
  facebook: "",
  telegram: "",
  discord: "",
  merchant_account: "",
};

export function MerchantSetupWizard({
  username,
  initialName = "",
  open: controlledOpen,
  onOpenChange,
  startStep = 0,
  onComplete,
  hideTrigger,
}: MerchantSetupWizardProps) {
  const { updateProfile, publishMerchantPost } = useHiveKeychain();

  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (next: boolean) => {
    onOpenChange?.(next);
    if (controlledOpen === undefined) setInternalOpen(next);
  };

  // wizard state
  const [step, setStep] = useState(startStep);
  const [name, setName] = useState(initialName);
  const [about, setAbout] = useState("");
  const [contacts, setContacts] = useState<ContactsValues>(EMPTY_CONTACTS);
  const [methods, setMethods] = useState<string[]>([]);
  const [methodInput, setMethodInput] = useState("");
  const [postUrl, setPostUrl] = useState("");

  // status
  const [isLoading, setIsLoading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishDone, setPublishDone] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);

  // hydrate from chain when opened
  useEffect(() => {
    if (!open) return;
    setStepError(null);
    setIsLoading(true);
    (async () => {
      try {
        const meta = await fetchPostingJsonMeta(username);
        const profile = (meta.profile ?? {}) as Record<string, string>;
        const contact = (meta.contact ?? {}) as Record<string, string>;
        const pm = (meta.payment_methods ?? []) as string[];

        setName(profile.name ?? initialName);
        setAbout(profile.about ?? "");
        const nextContacts: ContactsValues = {
          facebook: contact.facebook ?? profile.facebook ?? "",
          telegram: contact.telegram ?? profile.telegram ?? "",
          discord: contact.discord ?? profile.discord ?? "",
          merchant_account:
            contact.merchant_account ?? profile.merchant_account ?? "",
        };
        setContacts(nextContacts);
        setMethods(pm);
        setPostUrl(nextContacts.merchant_account ?? "");
        setStep(startStep);
        setPublishDone(false);
      } catch {
        /* keep defaults */
      } finally {
        setIsLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, username]);

  // step-level completion flags (for header progress dots)
  const profileComplete = name.trim().length > 0;
  const contactsComplete = useMemo(
    () =>
      Boolean(
        (contacts.telegram && contacts.telegram.trim()) ||
          (contacts.discord && contacts.discord.trim()) ||
          (contacts.facebook && contacts.facebook.trim()),
      ),
    [contacts],
  );
  const paymentsComplete = methods.length > 0;
  const postComplete = postUrl.trim().length > 0;

  const stepStatus: Record<StepId, boolean> = {
    profile: profileComplete,
    contacts: contactsComplete,
    payments: paymentsComplete,
    post: postComplete,
  };

  const allComplete =
    profileComplete && contactsComplete && paymentsComplete && postComplete;

  // helpers
  function addMethod(method: string) {
    const trimmed = method.trim();
    if (!trimmed || methods.includes(trimmed)) return;
    setMethods((prev) => [...prev, trimmed]);
    setMethodInput("");
  }
  function removeMethod(method: string) {
    setMethods((prev) => prev.filter((m) => m !== method));
  }

  function validateCurrentStep(): string | null {
    if (step === 0) {
      if (!name.trim()) return "Please enter your display name.";
      if (name.length > 50) return "Name must be 50 characters or fewer.";
      return null;
    }
    if (step === 1) {
      const parsed = contactsSchema.safeParse(contacts);
      if (!parsed.success) {
        return parsed.error.errors[0]?.message ?? "Check your contacts.";
      }
      if (!contactsComplete)
        return "Add at least one contact method so traders can reach you.";
      return null;
    }
    if (step === 2) {
      if (!paymentsComplete) return "Add at least one payment method.";
      return null;
    }
    if (step === 3) {
      if (!postUrl.trim()) return "Paste the URL of your merchant post.";
      try {
        new URL(postUrl);
      } catch {
        return "That doesn't look like a valid URL.";
      }
      return null;
    }
    return null;
  }

  function goNext() {
    const err = validateCurrentStep();
    if (err) return setStepError(err);
    setStepError(null);
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }
  function goBack() {
    setStepError(null);
    setStep((s) => Math.max(0, s - 1));
  }

  async function handlePublish() {
    setStepError(null);
    setIsPublishing(true);
    try {
      await publishMerchantPost(username, name || initialName, methods);
      setPublishDone(true);
    } catch (err) {
      setStepError(
        err instanceof Error ? err.message : "Failed to publish post.",
      );
    } finally {
      setIsPublishing(false);
    }
  }

  async function handleFinish() {
    const err = validateCurrentStep();
    if (err) return setStepError(err);
    setStepError(null);
    setIsSaving(true);
    try {
      await updateProfile(username, {
        name: name.trim(),
        about: about.trim() || undefined,
        facebook: contacts.facebook ?? "",
        telegram: contacts.telegram ?? "",
        discord: contacts.discord ?? "",
        merchant_account: postUrl.trim(),
        payment_methods: methods,
      });
      onComplete?.();
      setOpen(false);
    } catch (err) {
      setStepError(
        err instanceof Error ? err.message : "Failed to save your profile.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      {!hideTrigger && (
        <Button
          onClick={() => setOpen(true)}
          size="sm"
          className="gap-1.5 rounded-full"
        >
          <Sparkles className="size-3.5" />
          Become a merchant
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-hidden p-0">
          {/* Header with progress */}
          <div className="border-b border-border/60 bg-muted/30 px-6 pb-5 pt-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-bold">
                <Sparkles className="size-4 text-primary" />
                Become a merchant
              </DialogTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Complete these {STEPS.length} steps to unlock offer creation.
              </p>
            </DialogHeader>

            {/* Step dots */}
            <ol className="mt-5 flex items-center gap-2">
              {STEPS.map((s, i) => {
                const Icon = s.icon;
                const isActive = i === step;
                const isDone = stepStatus[s.id] && i < step;
                return (
                  <li key={s.id} className="flex flex-1 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setStepError(null);
                        setStep(i);
                      }}
                      className={cn(
                        "group flex flex-1 items-center gap-2 rounded-xl border px-3 py-2 text-left transition-all",
                        isActive &&
                          "border-primary bg-primary/10 text-foreground shadow-sm",
                        !isActive && isDone &&
                          "border-emerald-500/30 bg-emerald-500/5 text-emerald-300",
                        !isActive && !isDone &&
                          "border-border/60 bg-muted/20 text-muted-foreground hover:border-border",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold",
                          isActive && "border-primary bg-primary text-primary-foreground",
                          !isActive && isDone &&
                            "border-emerald-500 bg-emerald-500 text-background",
                          !isActive && !isDone &&
                            "border-border bg-background",
                        )}
                      >
                        {isDone && !isActive ? <Check className="size-3" /> : i + 1}
                      </span>
                      <span className="hidden text-xs font-semibold sm:inline">
                        {s.label}
                      </span>
                      <Icon className="size-3.5 sm:hidden" />
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* Step body */}
          <div className="max-h-[55vh] overflow-y-auto px-6 py-5">
            {isLoading ? (
              <div className="flex h-40 items-center justify-center text-muted-foreground">
                <Loader2 className="mr-2 size-4 animate-spin" />
                Loading your profile…
              </div>
            ) : step === 0 ? (
              <ProfileStep
                name={name}
                setName={setName}
                about={about}
                setAbout={setAbout}
              />
            ) : step === 1 ? (
              <ContactsStep
                contacts={contacts}
                setContacts={setContacts}
              />
            ) : step === 2 ? (
              <PaymentsStep
                methods={methods}
                methodInput={methodInput}
                setMethodInput={setMethodInput}
                addMethod={addMethod}
                removeMethod={removeMethod}
              />
            ) : (
              <PostStep
                postUrl={postUrl}
                setPostUrl={setPostUrl}
                isPublishing={isPublishing}
                publishDone={publishDone}
                onPublish={handlePublish}
              />
            )}

            {stepError && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
                <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                <p className="text-xs text-destructive">{stepError}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 border-t border-border/60 bg-muted/20 px-6 py-4">
            <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Step {step + 1} of {STEPS.length}
            </div>
            <div className="flex items-center gap-2">
              {step > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goBack}
                  disabled={isSaving || isPublishing}
                  className="gap-1.5"
                >
                  <ChevronLeft className="size-3.5" />
                  Back
                </Button>
              )}
              {step < STEPS.length - 1 ? (
                <Button
                  size="sm"
                  onClick={goNext}
                  disabled={isLoading}
                  className="gap-1.5"
                >
                  Continue
                  <ChevronRight className="size-3.5" />
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handleFinish}
                  disabled={isSaving || isPublishing || !allComplete}
                  className="gap-1.5"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <Check className="size-3.5" />
                      Finish &amp; save
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Step bodies ───────────────────────────────────────────────────────────

function ProfileStep({
  name,
  setName,
  about,
  setAbout,
}: {
  name: string;
  setName: (s: string) => void;
  about: string;
  setAbout: (s: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-bold text-foreground">Tell us who you are</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          This is how traders will see you across the marketplace.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="wiz-name">Display name</Label>
        <Input
          id="wiz-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your display name"
          maxLength={50}
        />
        <p className="text-[10px] text-muted-foreground">{name.length}/50</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="wiz-about">About (optional)</Label>
        <Textarea
          id="wiz-about"
          value={about}
          onChange={(e) => setAbout(e.target.value)}
          placeholder="A short bio shown on your profile."
          maxLength={160}
          rows={3}
        />
        <p className="text-[10px] text-muted-foreground">{about.length}/160</p>
      </div>
    </div>
  );
}

function ContactsStep({
  contacts,
  setContacts,
}: {
  contacts: ContactsValues;
  setContacts: (next: ContactsValues) => void;
}) {
  const fields = [
    {
      key: "telegram" as const,
      label: "Telegram",
      icon: Send,
      placeholder: "@your_handle",
      accent: "text-cyan-400 bg-cyan-500/10",
    },
    {
      key: "discord" as const,
      label: "Discord",
      icon: MessageCircle,
      placeholder: "username#0000",
      accent: "text-indigo-400 bg-indigo-500/10",
    },
    {
      key: "facebook" as const,
      label: "Facebook",
      icon: Share2,
      placeholder: "https://facebook.com/yourprofile",
      accent: "text-blue-400 bg-blue-500/10",
    },
  ];
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-bold text-foreground">
          How can traders reach you?
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Add at least one. Contacts are only shared during active trades.
        </p>
      </div>
      <div className="space-y-3">
        {fields.map((f) => {
          const Icon = f.icon;
          const value = contacts[f.key] ?? "";
          return (
            <div key={f.key} className="flex items-start gap-3 rounded-2xl border border-border/60 bg-card p-3">
              <div
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-xl",
                  f.accent,
                )}
              >
                <Icon className="size-4" />
              </div>
              <div className="flex-1 space-y-1">
                <Label htmlFor={`wiz-${f.key}`} className="text-xs font-semibold">
                  {f.label}
                </Label>
                <Input
                  id={`wiz-${f.key}`}
                  value={value}
                  onChange={(e) =>
                    setContacts({ ...contacts, [f.key]: e.target.value })
                  }
                  placeholder={f.placeholder}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PaymentsStep({
  methods,
  methodInput,
  setMethodInput,
  addMethod,
  removeMethod,
}: {
  methods: string[];
  methodInput: string;
  setMethodInput: (s: string) => void;
  addMethod: (m: string) => void;
  removeMethod: (m: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-bold text-foreground">Pick how you get paid</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Tap presets, or add your own. These appear on every offer you publish.
        </p>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold">Presets</Label>
        <div className="flex flex-wrap gap-1.5">
          {PAYMENT_PRESETS.map((preset) => {
            const active = methods.includes(preset);
            return (
              <button
                key={preset}
                type="button"
                onClick={() => (active ? removeMethod(preset) : addMethod(preset))}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground",
                )}
              >
                {preset}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="wiz-pm" className="text-xs font-semibold">
          Custom method
        </Label>
        <div className="flex gap-2">
          <Input
            id="wiz-pm"
            value={methodInput}
            onChange={(e) => setMethodInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addMethod(methodInput);
              }
            }}
            placeholder="e.g. Wise, Revolut…"
            className="h-9 text-sm"
            maxLength={50}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="shrink-0"
            disabled={!methodInput.trim()}
            onClick={() => addMethod(methodInput)}
          >
            <Plus className="size-3.5" />
          </Button>
        </div>
      </div>

      {methods.length > 0 && (
        <div className="space-y-2 rounded-2xl border border-border/60 bg-muted/20 p-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Selected ({methods.length})
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
    </div>
  );
}

function PostStep({
  postUrl,
  setPostUrl,
  isPublishing,
  publishDone,
  onPublish,
}: {
  postUrl: string;
  setPostUrl: (s: string) => void;
  isPublishing: boolean;
  publishDone: boolean;
  onPublish: () => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-bold text-foreground">
          Publish your merchant post
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Your merchant post is a public Hive blog post that traders use to leave
          reviews as comments. Publish it once with Keychain, then paste the URL
          below to unlock offer creation.
        </p>
      </div>

      <div className="space-y-2 rounded-2xl border border-border/60 bg-card p-4">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
            1
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Publish the post
          </span>
        </div>
        <Button
          type="button"
          size="sm"
          variant={publishDone ? "outline" : "default"}
          className="w-full gap-2"
          disabled={isPublishing}
          onClick={onPublish}
        >
          {isPublishing ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Waiting for Keychain…
            </>
          ) : publishDone ? (
            <>
              <Check className="size-3.5 text-emerald-400" />
              Published — now copy the URL
            </>
          ) : (
            <>
              <FileText className="size-3.5" />
              Publish merchant post via Keychain
            </>
          )}
        </Button>
        {publishDone && (
          <p className="text-[11px] text-muted-foreground">
            Open your Hive blog, find the "Merchant Application" post, copy its
            URL, then paste it below.
          </p>
        )}
      </div>

      <div className="space-y-2 rounded-2xl border border-border/60 bg-card p-4">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
            2
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Paste the post URL
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={postUrl}
            onChange={(e) => setPostUrl(e.target.value)}
            placeholder="https://peakd.com/@you/merchant-application"
            className="h-9 text-xs"
            maxLength={255}
          />
          {postUrl && (
            <a
              href={postUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-muted-foreground hover:text-foreground"
              aria-label="Open post"
            >
              <ExternalLink className="size-4" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}