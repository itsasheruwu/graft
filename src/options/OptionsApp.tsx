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
import { ThemeSyncerSettings } from "@/components/tweaks/theme-syncer-settings";
import { ElementSelectorSettings } from "@/components/tweaks/element-selector-settings";
import { YoutubeAutoTranslateSettings } from "@/components/tweaks/youtube-auto-translate-settings";
import { useTweakStatusBadges } from "@/hooks/use-tweak-status-badges";

export function OptionsApp() {
  const badges = useTweakStatusBadges();

  return (
    <main className="mx-auto max-w-lg space-y-6 px-6 py-10">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Graft
        </h1>
        <p className="text-sm text-muted-foreground">
          Control how Graft tweaks behave across your browser.
        </p>
      </div>

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
            defaultValue={["theme-syncer", "youtube-auto-translate", "element-selector"]}
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
