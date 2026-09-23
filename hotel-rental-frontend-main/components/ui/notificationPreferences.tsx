"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Settings2, BellRing, Loader2 } from "lucide-react";
import { NotificationPrefs } from "@/app/types/notification.type";
import { toast } from "sonner";

const TYPE_LABELS: Record<string, string> = {
  account: "Staff Accounts",
  reservation: "Reservations",
  maintenance: "Maintenance",
  housekeeping: "Housekeeping",
  chat: "Chat",
  payment: "Payments",
  inquiry: "Inquiries",
  system: "System",
};

const SEVERITY_LABELS: Record<string, string> = {
  info: "Info",
  success: "Success",
  warning: "Warning",
  danger: "Danger",
};

const EMPTY_PREFS: NotificationPrefs = {
  mutedTypes: [],
  mutedSeverities: [],
};

export function NotificationPreferences({
  endpoint,
  onSaved,
}: {
  endpoint: string;
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const queryKey = [endpoint, "notification-prefs"];

  const { data: prefs, isFetching } = useQuery<NotificationPrefs>({
    queryKey,
    queryFn: async () => {
      const res = await axiosInstance.get<{ notificationPrefs: NotificationPrefs }>(
        endpoint,
      );
      return res.data?.notificationPrefs || EMPTY_PREFS;
    },
    enabled: open,
    staleTime: Infinity,
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setOpen(true)}
          className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary cursor-pointer"
          title="Notification preferences"
          aria-label="Notification preferences"
        >
          <Settings2 className="size-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <NotificationPreferencesPanel
          endpoint={endpoint}
          queryKey={queryKey}
          prefs={prefs}
          isFetching={isFetching}
          onClose={() => setOpen(false)}
          onSaved={() => {
            queryClient.invalidateQueries();
            onSaved();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function NotificationPreferencesPanel({
  endpoint,
  queryKey,
  prefs,
  isFetching,
  onClose,
  onSaved,
}: {
  endpoint: string;
  queryKey: readonly string[];
  prefs?: NotificationPrefs;
  isFetching: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();

  const { mutate: savePrefs, isPending: saving } = useMutation({
    mutationFn: (next: NotificationPrefs) => axiosInstance.put(endpoint, next),
    onMutate: (next) => {
      queryClient.setQueryData<NotificationPrefs>(queryKey, next);
    },
    onError: () => {
      toast.error("Could not save notification preferences.");
      queryClient.invalidateQueries({ queryKey });
    },
    onSuccess: () => onSaved(),
  });

  const current: NotificationPrefs = prefs || EMPTY_PREFS;

  const toggleType = (type: string, enabled: boolean) => {
    const mutedTypes = enabled
      ? current.mutedTypes.filter((t) => t !== type)
      : Array.from(new Set([...current.mutedTypes, type]));
    savePrefs({ ...current, mutedTypes });
  };

  const toggleSeverity = (severity: string, enabled: boolean) => {
    const mutedSeverities = enabled
      ? current.mutedSeverities.filter((s) => s !== severity)
      : Array.from(new Set([...current.mutedSeverities, severity]));
    savePrefs({ ...current, mutedSeverities });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <BellRing className="size-4 text-primary" />
          Notification Preferences
        </DialogTitle>
        <DialogDescription>
          Mute entire categories or urgency levels. Muted alerts are hidden
          from your feed until re-enabled.
        </DialogDescription>
      </DialogHeader>

      {isFetching ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-5 max-h-[50vh] overflow-y-auto pr-1">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Categories
            </p>
            {Object.entries(TYPE_LABELS).map(([key, label]) => {
              const enabled = !current.mutedTypes.includes(key);
              return (
                <div
                  key={key}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                >
                  <span className="text-sm font-medium">{label}</span>
                  <Switch
                    checked={enabled}
                    onCheckedChange={(checked) =>
                      toggleType(key, Boolean(checked))
                    }
                    size="sm"
                    disabled={saving}
                  />
                </div>
              );
            })}
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Urgency Levels
            </p>
            {Object.entries(SEVERITY_LABELS).map(([key, label]) => {
              const enabled = !current.mutedSeverities.includes(key);
              return (
                <div
                  key={key}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                >
                  <span className="text-sm font-medium">{label}</span>
                  <Switch
                    checked={enabled}
                    onCheckedChange={(checked) =>
                      toggleSeverity(key, Boolean(checked))
                    }
                    size="sm"
                    disabled={saving}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <DialogFooter>
        <Button
          variant="outline"
          size="sm"
          onClick={onClose}
          className="cursor-pointer"
          disabled={saving}
        >
          Close
        </Button>
      </DialogFooter>
    </>
  );
}