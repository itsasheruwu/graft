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

export function OptionsApp() {
  const badges = useTweakStatusBadges();

  return (
    <main className="mx-auto max-w-lg space-y-6 px-6 py-10">
      <GraftBrand
        variant="page"
        description="Control how Graft tweaks behave across your browser."
      />

      <Card className="gap-0 border-border/80 shadow-sm">
        <CardHeader className="space-y-1 pb-3">
          <CardTitle className="text-base font-medium">Tweaks</CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            Expand a tweak to change its settings. Green dots show which tweaks are on.
          </CardDescription>
        </CardHeader>
        <Separator />
        <CardContent className="pt-3">
          <Accordion
            type="multiple"
            defaultValue={[
              "theme-syncer",
              "force-dark-mode",
              "sound-booster",
              "graft-ai-rewriter",
              "asset-finder",
              "youtube-auto-translate",
              "element-selector",
            ]}
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
                    Match page themes to your device appearance
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <ThemeSyncerSettings variant="options" />
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
                    Apply balanced dark styling to unsupported sites
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <ForceDarkModeSettings variant="options" />
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
                    Boost regular HTML5 audio and video volume
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <SoundBoosterSettings variant="options" />
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
                    Reflow, restyle, and save site-specific versions
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <GraftAiRewriterSettings variant="options" />
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
                    YouTube Auto Translation
                  </span>
                  <span className="text-xs font-normal leading-snug text-muted-foreground">
                    Translate titles and descriptions into your browser language
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <YoutubeAutoTranslateSettings variant="options" />
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
                    Browse visible media assets on the current page
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <AssetFinderSettings variant="options" />
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
                    Hide and inspect page elements with hover actions
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <ElementSelectorSettings variant="options" />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </main>
  );
}
