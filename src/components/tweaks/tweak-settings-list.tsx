import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { TweakStatusDot } from "@/components/ui/tweak-status-dot";
import {
  groupTweaksByCategory,
  type TweakUiVariant,
} from "@/lib/tweak-catalog";
import type { TweakBadgeState } from "@/hooks/use-tweak-status-badges";
import { cn } from "@/lib/utils";

type TweakSettingsListProps = {
  variant: TweakUiVariant;
  badges: TweakBadgeState;
  accordionType: "single" | "multiple";
  demo?: boolean;
};

export function TweakSettingsList({
  variant,
  badges,
  accordionType,
  demo = false,
}: TweakSettingsListProps) {
  const groups = groupTweaksByCategory();

  return (
    <Accordion
      type="multiple"
      defaultValue={[]}
      className="w-full space-y-1"
    >
      {groups.map((group) => (
        <AccordionItem
          key={group.id}
          value={group.id}
          className="border-border/60"
        >
          <AccordionTrigger
            iconVariant="category"
            className={cn(
              "gap-2 py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase",
              "hover:no-underline"
            )}
          >
            <span className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left">
              <span>{group.label}</span>
              <span className="text-[10px] font-normal normal-case text-muted-foreground/80">
                {group.tweaks.length} tweak{group.tweaks.length === 1 ? "" : "s"}
              </span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-1" watchNestedResize>
            <Accordion
              type={accordionType}
              {...(accordionType === "single"
                ? { collapsible: true }
                : { defaultValue: group.tweaks.map((tweak) => tweak.id) })}
              className="w-full"
            >
              {group.tweaks.map((tweak) => {
                const Settings = tweak.Settings;

                return (
                  <AccordionItem
                    key={tweak.id}
                    value={tweak.id}
                    className="border-border/60"
                  >
                    <AccordionTrigger
                      iconVariant="tweak"
                      className="gap-2.5 py-2.5 hover:no-underline"
                    >
                      <TweakStatusDot active={badges[tweak.badgeKey]} />
                      <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left normal-case">
                        <span className="text-sm font-medium leading-tight text-foreground">
                          {tweak.name}
                        </span>
                        <span className="text-xs font-normal leading-snug text-muted-foreground">
                          {tweak.taglines[variant]}
                        </span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      {demo ? (
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          Settings panel for {tweak.name}. In popup and options,
                          this area renders the tweak&apos;s live controls.
                        </p>
                      ) : (
                        <Settings variant={variant} />
                      )}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
