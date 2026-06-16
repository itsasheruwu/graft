import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useGraftAiRewriterSettings } from "@/hooks/use-graft-ai-rewriter-settings";
import { AnimatedStatusText } from "@/components/ui/transition-effects";

type Variant = "popup" | "options";

export function GraftAiRewriterSettings({ variant }: { variant: Variant }) {
  const {
    enabled,
    helperPort,
    helperToken,
    status,
    setEnabled,
    saveHelper,
    openOnCurrentPage,
  } = useGraftAiRewriterSettings({ variant });
  const isPopup = variant === "popup";
  const [prompt, setPrompt] = useState("");
  const [portDraft, setPortDraft] = useState("27491");
  const [tokenDraft, setTokenDraft] = useState("");

  useEffect(() => {
    setPortDraft(String(helperPort || 27491));
    setTokenDraft(helperToken || "");
  }, [helperPort, helperToken]);

  return (
    <div className="space-y-4">
      <p
        className={cn(
          "text-muted-foreground",
          isPopup ? "text-xs leading-relaxed" : "text-sm leading-relaxed"
        )}
      >
        Reshape the current domain with a plain-English prompt. Graft previews
        safe layout, style, hide, text, move, and shortcut actions before saving
        your version of the site.
      </p>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <Label
            htmlFor={isPopup ? "graft-ai-enabled" : "options-graft-ai-enabled"}
            className={cn(
              "cursor-pointer",
              isPopup ? "text-sm font-normal leading-snug" : "text-sm font-medium"
            )}
          >
            Enable AI Rewriter
          </Label>
          {!isPopup ? (
            <p className="text-xs text-muted-foreground">
              Applies approved recipes automatically on matching domains
            </p>
          ) : null}
        </div>
        <Switch
          id={isPopup ? "graft-ai-enabled" : "options-graft-ai-enabled"}
          checked={enabled}
          onCheckedChange={setEnabled}
          size={isPopup ? "sm" : "default"}
          className="mt-0.5 shrink-0"
        />
      </div>

      {isPopup ? (
        <div className="space-y-2">
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Make this site calmer, denser, and remove distracting feed items"
            className="min-h-20 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-xs leading-relaxed"
          />
          <Button
            type="button"
            size="sm"
            className="w-full gap-1.5"
            disabled={!enabled}
            onClick={() => openOnCurrentPage(prompt)}
          >
            <Sparkles className="size-3.5" />
            Reshape current site
          </Button>
        </div>
      ) : null}

      <div
        className={cn(
          "rounded-lg border border-border/70 bg-muted/20",
          isPopup ? "space-y-3 p-3" : "space-y-3 p-4"
        )}
      >
        <div>
          <p className="text-sm font-medium text-foreground">Local helper</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Run <code>npm run ai-helper</code>, then paste the printed token here.
          </p>
        </div>
        <div className={cn("grid gap-3", isPopup ? "grid-cols-1" : "sm:grid-cols-[7rem_1fr]")}>
          <div className="space-y-1.5">
            <Label htmlFor={isPopup ? "graft-ai-port" : "options-graft-ai-port"} className="text-xs">
              Port
            </Label>
            <input
              id={isPopup ? "graft-ai-port" : "options-graft-ai-port"}
              type="number"
              min={1024}
              max={65535}
              value={portDraft}
              onChange={(event) => setPortDraft(event.target.value)}
              className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={isPopup ? "graft-ai-token" : "options-graft-ai-token"} className="text-xs">
              Token
            </Label>
            <input
              id={isPopup ? "graft-ai-token" : "options-graft-ai-token"}
              type="password"
              value={tokenDraft}
              placeholder="Paste local token"
              onChange={(event) => setTokenDraft(event.target.value)}
              className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
            />
          </div>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => saveHelper({ port: Number(portDraft), token: tokenDraft })}
        >
          Save helper
        </Button>
      </div>

      <AnimatedStatusText
        message={status?.message}
        isError={status?.isError}
        className={isPopup ? "text-xs" : "text-sm"}
      />
    </div>
  );
}
