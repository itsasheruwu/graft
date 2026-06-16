import * as React from "react";
import {
  BellIcon,
  ChevronUpIcon,
  InfoIcon,
  PlusIcon,
  SettingsIcon,
  Trash2Icon,
} from "lucide-react";

import { GraftBrand } from "@/components/brand/graft-brand";
import {
  Badge,
  BottomSheet,
  BottomSheetBody,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetFooter,
  BottomSheetHeader,
  BottomSheetTitle,
  BottomSheetTrigger,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  ExtensionSurface,
  FormRow,
  Input,
  Label,
  ScrollList,
  Skeleton,
  SubOption,
  Switch,
  ToastProvider,
  Toaster,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  useToast,
} from "@/components/primitives";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { id: "buttons", label: "Buttons" },
  { id: "forms", label: "Inputs & forms" },
  { id: "feedback", label: "Feedback" },
  { id: "layout", label: "Layout" },
  { id: "sub-options", label: "Sub-options" },
  { id: "skeletons", label: "Skeletons" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];
type PreviewMode = "options" | "popup" | "sub-options";

function previewScale(preview: PreviewMode) {
  const isSubOptions = preview === "sub-options";
  const isCompact = preview === "popup" || isSubOptions;

  return {
    isSubOptions,
    isCompact,
    sectionGap: isSubOptions ? "space-y-5" : "space-y-8",
    sectionTitle: isSubOptions ? "text-base" : "text-lg",
    buttonSize: isSubOptions ? "xs" : isCompact ? "sm" : "default",
    iconButtonSize: isSubOptions ? "icon-xs" : isCompact ? "icon-sm" : "icon",
    switchSize: isCompact ? "sm" : "default",
    labelClass: isSubOptions
      ? "text-sm font-normal leading-snug"
      : isCompact
        ? "text-sm"
        : undefined,
    helperClass: isSubOptions
      ? "text-[11px] leading-snug"
      : isCompact
        ? "text-xs"
        : "text-sm",
  } as const;
}

function GallerySection({
  id,
  title,
  description,
  compact = false,
  children,
}: {
  id: SectionId;
  title: string;
  description: string;
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 space-y-4">
      <div className="space-y-1">
        <h2
          className={cn(
            "font-semibold tracking-tight",
            compact ? "text-base" : "text-lg"
          )}
        >
          {title}
        </h2>
        <p className={cn("text-muted-foreground", compact ? "text-xs" : "text-sm")}>
          {description}
        </p>
      </div>
      {children}
    </section>
  );
}

function VariantRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

function ToastDemoButtons({ buttonSize = "sm" }: { buttonSize?: "xs" | "sm" | "default" }) {
  const { toast } = useToast();

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="secondary"
        size={buttonSize}
        onClick={() =>
          toast({
            title: "Settings saved",
            description: "Your tweak preferences were updated.",
            variant: "success",
          })
        }
      >
        Success toast
      </Button>
      <Button
        type="button"
        variant="secondary"
        size={buttonSize}
        onClick={() =>
          toast({
            title: "Could not reach host",
            description: "Try reloading the tab and retry.",
            variant: "error",
          })
        }
      >
        Error toast
      </Button>
      <Button
        type="button"
        variant="secondary"
        size={buttonSize}
        onClick={() =>
          toast({
            title: "Heads up",
            description: "Compact surfaces favor short copy.",
          })
        }
      >
        Default toast
      </Button>
    </div>
  );
}

function SkeletonRevealDemo() {
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 1800);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <Card className="max-w-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Reveal pattern</CardTitle>
        <CardDescription className="text-xs">
          Skeleton fades into content after a simulated fetch.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            "t-skel relative min-h-[72px]",
            !loading && "is-revealed"
          )}
        >
          <div className="t-skel-skeleton is-pulsing space-y-2 p-1">
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
          <div className="t-skel-content space-y-1 p-1 text-sm">
            <p className="font-medium">Theme Syncer</p>
            <p className="text-xs text-muted-foreground">
              Matches sites to your system light / dark preference.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="mt-2"
          onClick={() => {
            setLoading(true);
            window.setTimeout(() => setLoading(false), 1800);
          }}
        >
          Replay
        </Button>
      </CardContent>
    </Card>
  );
}

function GalleryContent({ preview }: { preview: PreviewMode }) {
  const scale = previewScale(preview);
  const [switchOn, setSwitchOn] = React.useState(true);
  const [checkboxOn, setCheckboxOn] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("youtube.com");

  const listItems = [
    "Theme Syncer",
    "Element Selector",
    "YouTube Auto Translation",
    "Asset Finder",
    "Graft AI Rewriter",
    "Hidden elements",
    "More tweaks coming soon",
  ];

  return (
    <div className={scale.sectionGap}>
      <GallerySection
        id="buttons"
        title="Buttons"
        description="Primary, secondary, danger, and icon-only variants with hover and press feedback."
        compact={scale.isSubOptions}
      >
        <Card>
          <CardContent className={cn("space-y-4", scale.isSubOptions ? "pt-3" : "pt-4")}>
            <VariantRow label="Primary">
              <Button type="button" size={scale.buttonSize}>
                Save changes
              </Button>
              <Button type="button" size={scale.buttonSize} disabled>
                Disabled
              </Button>
            </VariantRow>
            <VariantRow label="Secondary">
              <Button type="button" variant="secondary" size={scale.buttonSize}>
                Cancel
              </Button>
              <Button type="button" variant="outline" size={scale.buttonSize}>
                Outline
              </Button>
              <Button type="button" variant="ghost" size={scale.buttonSize}>
                Ghost
              </Button>
            </VariantRow>
            <VariantRow label="Danger">
              <Button
                type="button"
                variant="destructive"
                size={scale.buttonSize}
              >
                Remove rule
              </Button>
            </VariantRow>
            <VariantRow label="Icon only">
              <Button
                type="button"
                size={scale.iconButtonSize}
                aria-label="Add tweak"
              >
                <PlusIcon />
              </Button>
              <Button
                type="button"
                size={scale.iconButtonSize}
                variant="secondary"
                aria-label="Settings"
              >
                <SettingsIcon />
              </Button>
              <Button
                type="button"
                size={scale.iconButtonSize}
                variant="destructive"
                aria-label="Delete"
              >
                <Trash2Icon />
              </Button>
              <Button
                type="button"
                size={scale.iconButtonSize}
                variant="outline"
                aria-label="Notifications"
              >
                <BellIcon />
              </Button>
            </VariantRow>
            {!scale.isSubOptions ? (
              <VariantRow label="Sizes">
                <Button type="button" size="xs">
                  Extra small
                </Button>
                <Button type="button" size="sm">
                  Small
                </Button>
                <Button type="button">Default</Button>
                <Button type="button" size="lg">
                  Large
                </Button>
              </VariantRow>
            ) : null}
          </CardContent>
        </Card>
      </GallerySection>

      <GallerySection
        id="forms"
        title="Inputs & forms"
        description="Text fields, switches, and checkboxes for compact extension settings."
        compact={scale.isSubOptions}
      >
        <Card>
          <CardContent className={cn("space-y-4", scale.isSubOptions ? "pt-3" : "pt-4")}>
            <div className={cn("grid gap-3", !scale.isSubOptions && "max-w-md")}>
              <div className="space-y-1.5">
                <Label htmlFor="gallery-host" className={scale.labelClass}>
                  Allowed host
                </Label>
                <Input
                  id="gallery-host"
                  value={inputValue}
                  onChange={(event) => setInputValue(event.target.value)}
                  placeholder="example.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gallery-disabled" className={scale.labelClass}>
                  Disabled input
                </Label>
                <Input
                  id="gallery-disabled"
                  disabled
                  defaultValue="Read only value"
                />
              </div>
            </div>

            <Separator />

            <div className={cn("grid gap-2", !scale.isSubOptions && "max-w-md")}>
              <FormRow
                label="Enable on this site"
                description="Toggle without leaving the popup."
                htmlFor="gallery-switch"
              >
                <Switch
                  id="gallery-switch"
                  checked={switchOn}
                  onCheckedChange={setSwitchOn}
                  size={scale.switchSize}
                />
              </FormRow>
              <FormRow
                label="Debug logging"
                description="Verbose console output for translators."
                htmlFor="gallery-switch-sm"
              >
                <Switch id="gallery-switch-sm" size="sm" />
              </FormRow>
            </div>

            <Separator />

            <div className="flex flex-col gap-3">
              <label
                className={cn(
                  "flex items-center gap-2",
                  scale.isSubOptions ? "text-xs" : "text-sm"
                )}
              >
                <Checkbox
                  checked={checkboxOn}
                  onCheckedChange={(value) => setCheckboxOn(value === true)}
                />
                Remember my choice
              </label>
              <label
                className={cn(
                  "flex items-center gap-2 opacity-60",
                  scale.isSubOptions ? "text-xs" : "text-sm"
                )}
              >
                <Checkbox disabled />
                Disabled checkbox
              </label>
            </div>
          </CardContent>
        </Card>
      </GallerySection>

      <GallerySection
        id="feedback"
        title="Feedback"
        description="Tooltips, badges, and branded toasts for tight extension surfaces."
        compact={scale.isSubOptions}
      >
        <Card>
          <CardContent className={cn("space-y-4", scale.isSubOptions ? "pt-3" : "pt-4")}>
            <VariantRow label="Tooltips">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size={scale.buttonSize}
                  >
                    Hover me
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Short helper copy fits popup width.
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size={scale.iconButtonSize}
                    variant="ghost"
                  >
                    <InfoIcon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Icon buttons pair well with tooltips.
                </TooltipContent>
              </Tooltip>
            </VariantRow>

            <VariantRow label="Badges">
              <Badge>Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="outline">Outline</Badge>
              <Badge variant="muted">Muted</Badge>
              <Badge variant="success">Active</Badge>
              <Badge variant="destructive">Error</Badge>
            </VariantRow>

            <VariantRow label="Toasts">
              <ToastDemoButtons buttonSize={scale.buttonSize} />
            </VariantRow>
          </CardContent>
        </Card>
      </GallerySection>

      <GallerySection
        id="layout"
        title="Layout & containers"
        description="Cards, scrollable lists, and bottom sheets for popup-scale layouts."
        compact={scale.isSubOptions}
      >
        <div
          className={cn(
            "grid gap-4",
            !scale.isSubOptions && "lg:grid-cols-2"
          )}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Card</CardTitle>
              <CardDescription className="text-xs">
                Default container for tweak groups and settings blocks.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Ring border, rounded corners, and footer slots match popup/options
              pages.
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Scroll list</CardTitle>
              <CardDescription className="text-xs">
                Fixed height with native-feeling scrollbar.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollList
                className={cn(
                  "rounded-lg border border-border/70",
                  scale.isSubOptions ? "h-28" : "h-36"
                )}
              >
                <ul className="divide-y divide-border/70">
                  {listItems.map((item) => (
                    <li
                      key={item}
                      className={cn(
                        "px-3 py-2 hover:bg-muted/50",
                        scale.isSubOptions ? "text-xs" : "text-sm"
                      )}
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </ScrollList>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 pt-4">
            <BottomSheet>
              <BottomSheetTrigger asChild>
                <Button type="button" variant="secondary" size={scale.buttonSize}>
                  Open bottom sheet
                </Button>
              </BottomSheetTrigger>
              <BottomSheetContent className="max-w-none sm:max-w-[var(--graft-popup-width)] sm:mx-auto">
                <BottomSheetHeader>
                  <BottomSheetTitle>Quick actions</BottomSheetTitle>
                  <BottomSheetDescription>
                    Slide-out panel pattern for compact extension UIs.
                  </BottomSheetDescription>
                </BottomSheetHeader>
                <BottomSheetBody className="space-y-2">
                  {listItems.slice(0, 4).map((item) => (
                    <button
                      key={item}
                      type="button"
                      className="flex w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-muted/60"
                    >
                      {item}
                    </button>
                  ))}
                </BottomSheetBody>
                <BottomSheetFooter>
                  <Button type="button" variant="ghost" size="sm">
                    Cancel
                  </Button>
                  <Button type="button" size="sm">
                    Apply
                  </Button>
                </BottomSheetFooter>
              </BottomSheetContent>
            </BottomSheet>
            <p className={cn("text-muted-foreground", scale.helperClass)}>
              Preview mode: <span className="font-medium">{preview}</span>
              {preview === "sub-options"
                ? " — nested inside popup accordion (~244px)."
                : " — sheets respect popup width on larger viewports."}
            </p>
          </CardContent>
        </Card>
      </GallerySection>

      <GallerySection
        id="sub-options"
        title="Sub-options"
        description="Nested panels inside accordion content — the tightest surface in popup/options (≈244px)."
        compact={scale.isSubOptions}
      >
        <div className={cn("grid gap-4", !scale.isSubOptions && "max-w-md")}>
          <SubOption
            title="YouTube scope"
            variant={scale.isSubOptions ? "sub-options" : "popup"}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <Label
                  htmlFor="gallery-sub-option-enabled"
                  className="cursor-pointer text-sm font-normal leading-snug"
                >
                  Include YouTube, Music, and mobile pages
                </Label>
                <p className="text-[11px] leading-snug text-muted-foreground">
                  Active nested control with compact switch and helper copy.
                </p>
              </div>
              <Switch
                id="gallery-sub-option-enabled"
                defaultChecked
                size="sm"
                className="mt-0.5 shrink-0"
              />
            </div>
          </SubOption>

          <SubOption
            title="Blocked until parent is on"
            variant={scale.isSubOptions ? "sub-options" : "popup"}
            disabled
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <Label
                  htmlFor="gallery-sub-option-disabled"
                  className="cursor-not-allowed text-sm font-normal leading-snug text-muted-foreground"
                >
                  Sync with system light / dark
                </Label>
                <p className="text-[11px] leading-snug text-muted-foreground">
                  Turn on Theme Syncer above to change this.
                </p>
              </div>
              <Switch
                id="gallery-sub-option-disabled"
                disabled
                size="sm"
                className="mt-0.5 shrink-0"
              />
            </div>
          </SubOption>
        </div>

        {!scale.isSubOptions ? (
          <p className="text-xs text-muted-foreground">
            Switch preview to <span className="font-medium">Sub-options</span>{" "}
            above to see these panels inside a mock popup accordion.
          </p>
        ) : null}
      </GallerySection>

      <GallerySection
        id="skeletons"
        title="Skeleton loaders"
        description="Standardized loading placeholders and reveal transitions."
        compact={scale.isSubOptions}
      >
        <div
          className={cn(
            "grid gap-4",
            !scale.isSubOptions && "md:grid-cols-2"
          )}
        >
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Static blocks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <div className="flex gap-2 pt-1">
                <Skeleton className="size-8 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            </CardContent>
          </Card>

          <SkeletonRevealDemo />
        </div>
      </GallerySection>
    </div>
  );
}

export function GalleryApp() {
  const [preview, setPreview] = React.useState<PreviewMode>("options");
  const [activeSection, setActiveSection] = React.useState<SectionId>("buttons");

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) {
          setActiveSection(visible.target.id as SectionId);
        }
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: [0.1, 0.35, 0.6] }
    );

    for (const section of SECTIONS) {
      const element = document.getElementById(section.id);
      if (element) {
        observer.observe(element);
      }
    }

    return () => observer.disconnect();
  }, []);

  return (
    <ToastProvider>
      <TooltipProvider>
        <div className="min-h-screen bg-background">
          <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur-sm">
            <ExtensionSurface
              variant="options"
              className="flex flex-col gap-4 px-4 py-4 sm:px-6"
            >
              <GraftBrand
                title="Primitive Gallery"
                description="Preview and test Graft UI primitives before wiring them into popup or options screens."
              />
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  Surface preview
                </p>
                <div
                  role="group"
                  aria-label="Surface preview"
                  className="inline-flex w-full max-w-sm items-center gap-1 rounded-lg border border-border/80 bg-muted/30 p-0.5 sm:w-auto"
                >
                  <Button
                    type="button"
                    size="xs"
                    className="flex-1 sm:flex-none"
                    variant={preview === "options" ? "secondary" : "ghost"}
                    onClick={() => setPreview("options")}
                  >
                    Options
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    className="flex-1 sm:flex-none"
                    variant={preview === "popup" ? "secondary" : "ghost"}
                    onClick={() => setPreview("popup")}
                  >
                    Popup
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    className="flex-1 sm:flex-none"
                    variant={preview === "sub-options" ? "secondary" : "ghost"}
                    onClick={() => setPreview("sub-options")}
                  >
                    Sub-options
                  </Button>
                </div>
              </div>
              <nav className="flex flex-wrap gap-1.5">
                {SECTIONS.map((section) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                      activeSection === section.id
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {section.label}
                  </a>
                ))}
              </nav>
            </ExtensionSurface>
          </header>

          <main className="px-4 py-6 sm:px-6">
            {preview === "sub-options" ? (
              <ExtensionSurface
                variant="popup"
                className="rounded-xl border border-border/80 p-3 shadow-sm transition-[width,max-width] duration-300"
              >
                <div className="mb-2 flex items-start justify-between gap-2 border-b border-border/50 pb-2.5">
                  <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left">
                    <span className="text-sm font-medium leading-tight">
                      Theme Syncer
                    </span>
                    <span className="text-xs font-normal leading-snug text-muted-foreground">
                      Match sites to system light / dark
                    </span>
                  </span>
                  <ChevronUpIcon
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                </div>
                <SubOption title="Nested settings preview" variant="sub-options">
                  <GalleryContent preview="sub-options" />
                </SubOption>
              </ExtensionSurface>
            ) : (
              <ExtensionSurface
                variant={preview === "popup" ? "popup" : "options"}
                className={cn(
                  "transition-[width,max-width] duration-300",
                  preview === "popup" &&
                    "rounded-xl border border-border/80 p-3 shadow-sm"
                )}
              >
                <GalleryContent preview={preview} />
              </ExtensionSurface>
            )}
          </main>
        </div>
        <Toaster />
      </TooltipProvider>
    </ToastProvider>
  );
}
