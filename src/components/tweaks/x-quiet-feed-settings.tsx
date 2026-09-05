import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AnimatedStatusText } from "@/components/ui/transition-effects";
import { useXQuietFeedSettings } from "@/hooks/use-x-quiet-feed-settings";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

export function XQuietFeedSettings({ variant }: { variant: "popup" | "options" }) {
  const { xQuietFeedEnabled, setMasterEnabled, status } = useXQuietFeedSettings({ variant });
  const isPopup = variant === "popup";
  const id = isPopup ? "x-quiet-feed-enabled" : "options-x-quiet-feed-enabled";

  return (
    <div className="flex flex-col gap-4">
      <p className={cn("text-muted-foreground", isPopup ? "text-xs leading-relaxed" : "text-sm leading-relaxed")}>
        Reduce promotions and recommendation clutter in X&apos;s normal feed.
      </p>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <Label htmlFor={id} className={cn("cursor-pointer", isPopup ? "text-sm font-normal leading-snug" : "text-sm font-medium")}>
            {isPopup ? "Enable X Quiet Feed" : "Enable X Quiet Feed"}
          </Label>
          {!isPopup ? <p className="text-xs text-muted-foreground">Applies only on x.com.</p> : null}
        </div>
        <Switch id={id} checked={xQuietFeedEnabled} onCheckedChange={setMasterEnabled} size={isPopup ? "sm" : "default"} className="mt-0.5 shrink-0" />
      </div>
      <Alert className={isPopup ? "border-border/60 bg-background/70 py-2" : undefined}>
        <Info className="size-3.5 shrink-0 text-muted-foreground" />
        <AlertDescription className={cn(isPopup ? "text-xs leading-snug text-muted-foreground [&_p]:m-0" : "text-sm leading-relaxed [&_p]:m-0")}>
          Hides promoted posts plus follow, trending, and suggestion modules. Posts, replies, search, messages, notifications, settings, and profile controls stay available. It never acts on your account.
        </AlertDescription>
      </Alert>
      <AnimatedStatusText
        message={status?.message}
        isError={status?.isError}
        className={isPopup ? "text-xs" : "text-sm"}
      />
    </div>
  );
}
