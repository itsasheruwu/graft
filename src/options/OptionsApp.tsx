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

export function OptionsApp() {
  const badges = useTweakStatusBadges();

  return (
    <main className="mx-auto max-w-lg space-y-6 px-6 py-10">
      <GraftBrand
        variant="page"
        description="Control how Graft tweaks behave across your browser."
      />

      <Card className="gap-0 overflow-visible border-border/80 shadow-sm">
        <CardHeader className="space-y-1 pb-3">
          <CardTitle className="text-base font-medium">Tweaks</CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            Expand a tweak to change its settings. Green dots show which tweaks are on.
          </CardDescription>
        </CardHeader>
        <Separator />
        <CardContent className="pt-3">
          <TweakSettingsList
            variant="options"
            badges={badges}
            accordionType="multiple"
          />
        </CardContent>
      </Card>
    </main>
  );
}
