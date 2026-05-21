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
        "size-2 shrink-0 rounded-full",
        active ? "bg-emerald-500" : "bg-muted-foreground/35",
        className
      )}
      aria-hidden
      title={active ? "On" : "Off"}
    />
  );
}
