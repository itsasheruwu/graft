import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormRow } from "@/components/ui/form-row";
import { Label } from "@/components/ui/label";
import { SubOption } from "@/components/ui/sub-option";
import { Switch } from "@/components/ui/switch";
import { AnimatedStatusText } from "@/components/ui/transition-effects";
import { useRobloxPlayerWatcherSettings } from "@/hooks/use-roblox-player-watcher-settings";
import { robloxWatcherNotificationPermissionMessage } from "@/lib/roblox-player-watcher";
import { cn } from "@/lib/utils";
import { Info, X } from "lucide-react";

type Variant = "popup" | "options";

export function RobloxPlayerWatcherSettings({ variant }: { variant: Variant }) {
  const {
    robloxPlayerWatcherEnabled,
    robloxPlayerWatcherNotifyOnline,
    robloxPlayerWatcherNotifyOffline,
    robloxPlayerWatcherNotifyJoinGame,
    robloxPlayerWatcherShowExactGame,
    robloxPlayerWatcherAntiSpamEnabled,
    robloxPlayerWatcherWhitelist,
    whitelistInput,
    setWhitelistInput,
    status,
    notificationPermissionReady,
    notificationPermissionReason,
    sendingTestNotification,
    addingWhitelistEntry,
    setMasterEnabled,
    setNotifyOnlineEnabled,
    setNotifyOfflineEnabled,
    setNotifyJoinGameEnabled,
    setShowExactGameEnabled,
    setAntiSpamEnabled,
    addWhitelistEntry,
    removeWhitelistEntry,
    requestNotificationPermission,
    testNotification,
  } = useRobloxPlayerWatcherSettings({ variant });
  const isPopup = variant === "popup";
  const childDisabled = !robloxPlayerWatcherEnabled;
  const masterId = isPopup
    ? "roblox-player-watcher-enabled"
    : "options-roblox-player-watcher-enabled";
  const showPermissionAlert =
    !notificationPermissionReady && notificationPermissionReason != null;

  return (
    <div className={cn("flex flex-col", isPopup ? "gap-3" : "gap-4")}>
      {!isPopup ? (
        <p className="text-sm leading-relaxed text-muted-foreground">
          Watch a whitelist of Roblox players and notify when they come online,
          go offline, or join a game.
        </p>
      ) : null}

      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <Label
            htmlFor={masterId}
            className={cn(
              "cursor-pointer",
              isPopup ? "text-sm font-normal leading-snug" : "text-sm font-medium"
            )}
          >
            Enable Roblox Player Watcher
          </Label>
          {!isPopup ? (
            <p className="text-xs text-muted-foreground">
              Uses Graft for Mac when available, with Chrome as the fallback
            </p>
          ) : null}
        </div>
        <Switch
          id={masterId}
          checked={robloxPlayerWatcherEnabled}
          onCheckedChange={(value) => {
            void setMasterEnabled(value);
          }}
          size={isPopup ? "sm" : "default"}
          className="mt-0.5 shrink-0"
        />
      </div>

      <Alert className={isPopup ? "border-border/60 bg-background/70 py-2" : undefined}>
        <Info className="size-3.5 shrink-0 text-muted-foreground" />
        <AlertDescription
          className={cn(
            isPopup
              ? "text-xs leading-snug text-muted-foreground [&_p]:m-0"
              : "text-sm leading-relaxed [&_p]:m-0"
          )}
        >
          {isPopup
            ? "No Roblox tab needed. Graft for Mac watches first; Chrome takes over when needed."
            : "No Roblox tab is required. A connected Graft Mac app watches while running; otherwise Chrome watches in the background."}
        </AlertDescription>
      </Alert>

      {showPermissionAlert ? (
        <Alert
          variant="destructive"
          className={isPopup ? "border-border/60 bg-background/70 py-2" : undefined}
        >
          <Info className="size-3.5 shrink-0" />
          <AlertDescription
            className={cn(
              "flex flex-col gap-2",
              isPopup
                ? "text-xs leading-snug [&_p]:m-0"
                : "text-sm leading-relaxed [&_p]:m-0"
            )}
          >
            <span>
              {robloxWatcherNotificationPermissionMessage(
                notificationPermissionReason,
                variant
              )}
            </span>
            {notificationPermissionReason !== "unsupported" ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="self-start"
                onClick={() => {
                  void requestNotificationPermission();
                }}
              >
                Allow notifications
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      <SubOption
        title="Notifications"
        eyebrow="Sub-option"
        disabled={childDisabled}
        variant={isPopup ? "popup" : "options"}
      >
        <div className="flex flex-col gap-3">
          <FormRow
            label="Came online"
            description="Notify when a watched player leaves offline status."
            htmlFor={
              isPopup
                ? "roblox-player-watcher-notify-online"
                : "options-roblox-player-watcher-notify-online"
            }
          >
            <Switch
              id={
                isPopup
                  ? "roblox-player-watcher-notify-online"
                  : "options-roblox-player-watcher-notify-online"
              }
              checked={
                robloxPlayerWatcherEnabled && robloxPlayerWatcherNotifyOnline
              }
              disabled={childDisabled}
              onCheckedChange={setNotifyOnlineEnabled}
              size={isPopup ? "sm" : "default"}
            />
          </FormRow>
          <FormRow
            label="Went offline"
            description="Notify when a watched player goes offline."
            htmlFor={
              isPopup
                ? "roblox-player-watcher-notify-offline"
                : "options-roblox-player-watcher-notify-offline"
            }
          >
            <Switch
              id={
                isPopup
                  ? "roblox-player-watcher-notify-offline"
                  : "options-roblox-player-watcher-notify-offline"
              }
              checked={
                robloxPlayerWatcherEnabled && robloxPlayerWatcherNotifyOffline
              }
              disabled={childDisabled}
              onCheckedChange={setNotifyOfflineEnabled}
              size={isPopup ? "sm" : "default"}
            />
          </FormRow>
          <FormRow
            label="Joined a game"
            description="Notify when they enter or switch Roblox experiences."
            htmlFor={
              isPopup
                ? "roblox-player-watcher-notify-join-game"
                : "options-roblox-player-watcher-notify-join-game"
            }
          >
            <Switch
              id={
                isPopup
                  ? "roblox-player-watcher-notify-join-game"
                  : "options-roblox-player-watcher-notify-join-game"
              }
              checked={
                robloxPlayerWatcherEnabled && robloxPlayerWatcherNotifyJoinGame
              }
              disabled={childDisabled}
              onCheckedChange={setNotifyJoinGameEnabled}
              size={isPopup ? "sm" : "default"}
            />
          </FormRow>
          <FormRow
            label="Reduce notification spam"
            description="Skip extra join-game alerts when a player hops experiences."
            htmlFor={
              isPopup
                ? "roblox-player-watcher-anti-spam"
                : "options-roblox-player-watcher-anti-spam"
            }
          >
            <Switch
              id={
                isPopup
                  ? "roblox-player-watcher-anti-spam"
                  : "options-roblox-player-watcher-anti-spam"
              }
              checked={
                robloxPlayerWatcherEnabled && robloxPlayerWatcherAntiSpamEnabled
              }
              disabled={childDisabled}
              onCheckedChange={setAntiSpamEnabled}
              size={isPopup ? "sm" : "default"}
            />
          </FormRow>
          <FormRow
            label="Show exact game"
            description="Look up and show the experience's current Roblox name."
            htmlFor={
              isPopup
                ? "roblox-player-watcher-show-exact-game"
                : "options-roblox-player-watcher-show-exact-game"
            }
          >
            <Switch
              id={
                isPopup
                  ? "roblox-player-watcher-show-exact-game"
                  : "options-roblox-player-watcher-show-exact-game"
              }
              checked={
                robloxPlayerWatcherEnabled && robloxPlayerWatcherShowExactGame
              }
              disabled={childDisabled}
              onCheckedChange={setShowExactGameEnabled}
              size={isPopup ? "sm" : "default"}
            />
          </FormRow>
          <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-3">
            <p className="text-xs leading-relaxed text-muted-foreground">
              Verify Chrome and macOS can show Graft alerts.
            </p>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={sendingTestNotification}
              onClick={() => {
                void testNotification();
              }}
            >
              {sendingTestNotification ? "Sending…" : "Send test"}
            </Button>
          </div>
        </div>
      </SubOption>

      <div
        className={cn(
          "space-y-3 rounded-lg border border-border/70 bg-muted/20",
          childDisabled && "opacity-60",
          isPopup ? "p-3" : "p-4"
        )}
      >
        <div>
          <p className={cn(isPopup ? "text-xs font-medium" : "text-sm font-medium")}>
            Watched players
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Add usernames, user IDs, or profile URLs. Max 50.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="username or user id"
            value={whitelistInput}
            disabled={childDisabled}
            onChange={(event) => setWhitelistInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void addWhitelistEntry();
              }
            }}
            className={cn(
              "flex h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm",
              "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "disabled:cursor-not-allowed disabled:opacity-60"
            )}
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={childDisabled || addingWhitelistEntry}
            onClick={() => { void addWhitelistEntry(); }}
          >
            {addingWhitelistEntry ? "Adding…" : "Add"}
          </Button>
        </div>
        {robloxPlayerWatcherWhitelist.length > 0 ? (
          <ul className="t-stagger is-shown flex flex-wrap gap-2">
            {robloxPlayerWatcherWhitelist.map((entry, index) => (
              <li
                key={entry}
                className="t-stagger-line inline-flex items-center gap-1 rounded-md border border-border/80 bg-background px-2 py-1 text-xs"
                style={{
                  transitionDelay: `calc(var(--stagger-stagger) * ${index})`,
                }}
              >
                {entry}
                <button
                  type="button"
                  className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-50"
                  aria-label={`Remove ${entry}`}
                  disabled={childDisabled}
                  onClick={() => removeWhitelistEntry(entry)}
                >
                  <X className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">No watched players yet.</p>
        )}
      </div>

      <AnimatedStatusText
        message={status?.message}
        isError={status?.isError}
        className={isPopup ? "text-xs" : "text-sm"}
      />

    </div>
  );
}
