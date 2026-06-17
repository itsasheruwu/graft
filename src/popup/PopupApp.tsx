import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { GraftBrand } from "@/components/brand/graft-brand";
import { TweakSettingsList } from "@/components/tweaks/tweak-settings-list";
import { useTweakStatusBadges } from "@/hooks/use-tweak-status-badges";

export function PopupApp() {
  const badges = useTweakStatusBadges();

  return (
    <div className="space-y-3">
      <GraftBrand
        variant="popup"
        description="Quick tweak toggles"
        actions={
          <Button
            type="button"
            variant="link"
            size="xs"
            className="h-auto px-0 text-muted-foreground hover:text-foreground"
            onClick={() => {
              chrome.runtime.openOptionsPage();
            }}
          >
            All settings
          </Button>
        }
      />

      <Card className="gap-0 overflow-visible border-border/80 shadow-sm">
        <CardHeader className="space-y-1 pb-3">
          <CardTitle className="text-sm font-semibold tracking-tight">
            Tweaks
          </CardTitle>
          <CardDescription className="text-xs leading-relaxed">
            Expand a tweak to configure it. Green dots mean a tweak is on.
          </CardDescription>
        </CardHeader>
        <Separator />
        <CardContent className="pt-3">
          <TweakSettingsList
            variant="popup"
            badges={badges}
            accordionType="single"
          />
        </CardContent>
      </Card>
    </div>
  );
}
