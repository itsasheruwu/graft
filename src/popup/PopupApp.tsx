import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { TweakStatusDot } from "@/components/ui/tweak-status-dot";
import { GraftBrand } from "@/components/brand/graft-brand";
import { ThemeSyncerSettings } from "@/components/tweaks/theme-syncer-settings";
import { ForceDarkModeSettings } from "@/components/tweaks/force-dark-mode-settings";
import { SoundBoosterSettings } from "@/components/tweaks/sound-booster-settings";
import { ElementSelectorSettings } from "@/components/tweaks/element-selector-settings";
import { YoutubeAutoTranslateSettings } from "@/components/tweaks/youtube-auto-translate-settings";
import { GraftAiRewriterSettings } from "@/components/tweaks/graft-ai-rewriter-settings";
import { AssetFinderSettings } from "@/components/tweaks/asset-finder-settings";
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

      <Card className="gap-0 border-border/80 shadow-sm">
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
          <Accordion
            type="single"
            collapsible
            className="w-full"
          >
            <AccordionItem value="theme-syncer" className="border-border/60">
              <AccordionTrigger className="gap-2.5 py-2.5 hover:no-underline">
                <TweakStatusDot active={badges.themeSyncer} />
                <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left">
                  <span className="text-sm font-medium leading-tight">
                    Theme Syncer
                  </span>
                  <span className="text-xs font-normal leading-snug text-muted-foreground">
                    Match sites to system light / dark
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <ThemeSyncerSettings variant="popup" />
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="force-dark-mode" className="border-border/60">
              <AccordionTrigger className="gap-2.5 py-2.5 hover:no-underline">
                <TweakStatusDot active={badges.forceDarkMode} />
                <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left">
                  <span className="text-sm font-medium leading-tight">
                    Force Dark Mode
                  </span>
                  <span className="text-xs font-normal leading-snug text-muted-foreground">
                    Darken sites without native themes
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <ForceDarkModeSettings variant="popup" />
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="sound-booster" className="border-border/60">
              <AccordionTrigger className="gap-2.5 py-2.5 hover:no-underline">
                <TweakStatusDot active={badges.soundBooster} />
                <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left">
                  <span className="text-sm font-medium leading-tight">
                    Sound Booster
                  </span>
                  <span className="text-xs font-normal leading-snug text-muted-foreground">
                    Raise HTML5 media volume
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <SoundBoosterSettings variant="popup" />
              </AccordionContent>
            </AccordionItem>
            <AccordionItem
              value="graft-ai-rewriter"
              className="border-border/60"
            >
              <AccordionTrigger className="gap-2.5 py-2.5 hover:no-underline">
                <TweakStatusDot active={badges.graftAiRewriter} />
                <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left">
                  <span className="text-sm font-medium leading-tight">
                    AI Rewriter
                  </span>
                  <span className="text-xs font-normal leading-snug text-muted-foreground">
                    Reshape the current site
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <GraftAiRewriterSettings variant="popup" />
              </AccordionContent>
            </AccordionItem>
            <AccordionItem
              value="youtube-auto-translate"
              className="border-border/60"
            >
              <AccordionTrigger className="gap-2.5 py-2.5 hover:no-underline">
                <TweakStatusDot active={badges.youtubeAutoTranslate} />
                <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left">
                  <span className="text-sm font-medium leading-tight">
                    YouTube Translation
                  </span>
                  <span className="text-xs font-normal leading-snug text-muted-foreground">
                    Translate video metadata
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <YoutubeAutoTranslateSettings variant="popup" />
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="asset-finder" className="border-border/60">
              <AccordionTrigger className="gap-2.5 py-2.5 hover:no-underline">
                <TweakStatusDot active={badges.assetFinder} />
                <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left">
                  <span className="text-sm font-medium leading-tight">
                    Asset Finder
                  </span>
                  <span className="text-xs font-normal leading-snug text-muted-foreground">
                    Browse images, media, and page assets
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <AssetFinderSettings variant="popup" />
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="element-selector" className="border-border/60">
              <AccordionTrigger className="gap-2.5 py-2.5 hover:no-underline">
                <TweakStatusDot active={badges.elementSelector} />
                <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left">
                  <span className="text-sm font-medium leading-tight">
                    Element Selector
                  </span>
                  <span className="text-xs font-normal leading-snug text-muted-foreground">
                    Hide/inspect elements with an in-page selector
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <ElementSelectorSettings variant="popup" />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
