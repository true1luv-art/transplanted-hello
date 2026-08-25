"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/features/stores/authStore";

interface EditProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditProfileModal({ open, onOpenChange }: EditProfileModalProps) {
  const currentUsername = useAuthStore((state) => state.username) ?? "";
  const setUsername = useAuthStore((state) => state.setUsername);

  const [value, setValue] = useState(currentUsername);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep input in sync if the modal is reopened after a username change elsewhere
  useEffect(() => {
    if (open) {
      setValue(currentUsername);
      setError(null);
    }
  }, [open, currentUsername]);

  async function handleSave() {
    const trimmed = value.trim();
    if (!trimmed) {
      setError("Username cannot be empty.");
      return;
    }
    if (trimmed.length < 3) {
      setError("Username must be at least 3 characters.");
      return;
    }
    if (trimmed.length > 20) {
      setError("Username cannot exceed 20 characters.");
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
      setError("Only letters, numbers, underscores and hyphens are allowed.");
      return;
    }
    if (trimmed === currentUsername) {
      onOpenChange(false);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await setUsername(trimmed);
      onOpenChange(false);
    } catch {
      setError("Failed to update username. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      void handleSave();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Edit profile</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Update your display name. Changes are saved to the server.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="username-input" className="text-xs font-medium">
              Username
            </Label>
            <Input
              id="username-input"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setError(null);
              }}
              onKeyDown={handleKeyDown}
              placeholder="e.g. CryptoMiner_01"
              maxLength={20}
              autoComplete="off"
              autoFocus
            />
            {error ? (
              <p className="text-[11px] text-destructive">{error}</p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                3–20 characters. Letters, numbers, _ and - only.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={() => void handleSave()} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
