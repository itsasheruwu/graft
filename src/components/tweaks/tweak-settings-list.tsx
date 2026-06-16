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

type TweakSettingsListProps = {
  variant: TweakUiVariant;
  badges: TweakBadgeState;
  accordionType: "single" | "multiple";
};

export function TweakSettingsList({
  variant,
  badges,
  accordionType,
}: TweakSettingsListProps) {
  const groups = groupTweaksByCategory();

  return (
    <div className="space-y-4">
      {groups.map((group, groupIndex) => (
        <section key={group.id} className="space-y-1.5">
          <h3 className="px-0.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {group.label}
          </h3>
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
                  <AccordionTrigger className="gap-2.5 py-2.5 hover:no-underline">
                    <TweakStatusDot active={badges[tweak.badgeKey]} />
                    <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left">
                      <span className="text-sm font-medium leading-tight">
                        {tweak.name}
                      </span>
                      <span className="text-xs font-normal leading-snug text-muted-foreground">
                        {tweak.taglines[variant]}
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <Settings variant={variant} />
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
          {groupIndex < groups.length - 1 ? (
            <div className="h-px bg-border/40" aria-hidden="true" />
          ) : null}
        </section>
      ))}
    </div>
  );
}
