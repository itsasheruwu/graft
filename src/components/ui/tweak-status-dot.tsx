import { cn } from "@/lib/utils";

export function TweakStatusDot({
  active,
  className,
}: {
  active: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative size-2 shrink-0 rounded-full bg-muted-foreground/35",
        className
      )}
      aria-hidden
      title={active ? "On" : "Off"}
    >
      <span
        className="t-badge"
        data-open={active ? "true" : "false"}
        style={{ top: 0, right: 0 }}
      >
        <span className="t-badge-dot size-2 rounded-full bg-graft-green" />
      </span>
    </span>
  );
}
