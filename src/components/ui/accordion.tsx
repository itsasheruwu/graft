import * as React from "react"
import { Accordion as AccordionPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import {
  ChevronDownIcon,
  ChevronUpIcon,
  MinusIcon,
  PlusIcon,
} from "lucide-react"

type AccordionIconVariant = "category" | "tweak"

function Accordion({
  className,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Root>) {
  return (
    <AccordionPrimitive.Root
      data-slot="accordion"
      className={cn("flex w-full flex-col", className)}
      {...props}
    />
  )
}

function AccordionItem({
  className,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Item>) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn("not-last:border-b", className)}
      {...props}
    />
  )
}

function AccordionTrigger({
  className,
  children,
  iconVariant = "tweak",
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Trigger> & {
  iconVariant?: AccordionIconVariant
}) {
  const ClosedIcon = iconVariant === "category" ? PlusIcon : ChevronDownIcon
  const OpenIcon = iconVariant === "category" ? MinusIcon : ChevronUpIcon

  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        data-icon-variant={iconVariant}
        className={cn(
          "group/accordion-trigger relative flex flex-1 items-start justify-between rounded-lg border border-transparent py-2.5 text-left text-sm font-medium transition-colors outline-none hover:underline focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:after:border-ring disabled:pointer-events-none disabled:opacity-50 **:data-[slot=accordion-trigger-icon]:ml-auto **:data-[slot=accordion-trigger-icon]:text-muted-foreground",
          className
        )}
        {...props}
      >
        {children}
        <span
          className={cn(
            "t-icon-swap pointer-events-none inline-grid shrink-0 place-items-center self-center overflow-visible",
            iconVariant === "category" ? "size-4" : "size-5"
          )}
          data-slot="accordion-trigger-icon"
          data-state="a"
        >
          <ClosedIcon
            className={cn(
              "t-icon",
              iconVariant === "category" ? "size-3.5" : "size-4"
            )}
            data-icon="a"
            strokeWidth={2}
          />
          <OpenIcon
            className={cn(
              "t-icon",
              iconVariant === "category" ? "size-3.5" : "size-4"
            )}
            data-icon="b"
            strokeWidth={2}
          />
        </span>
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  )
}

function AccordionContent({
  className,
  children,
  watchNestedResize = false,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Content> & {
  watchNestedResize?: boolean
}) {
  const innerRef = React.useRef<HTMLDivElement>(null)

  React.useLayoutEffect(() => {
    if (!watchNestedResize) {
      return
    }

    const inner = innerRef.current
    if (!inner) {
      return
    }

    const content = inner.closest(
      '[data-slot="accordion-content"]'
    ) as HTMLElement | null
    if (!content) {
      return
    }

    let frame = 0
    let lastSyncedHeight = -1
    let skipNextResize = true

    const clearSyncedHeight = () => {
      content.style.removeProperty("--radix-collapsible-content-height")
      content.style.removeProperty("--radix-accordion-content-height")
      content.classList.remove("accordion-height-sync")
      lastSyncedHeight = -1
      skipNextResize = true
    }

    const syncHeightInstant = () => {
      if (content.dataset.state !== "open") {
        return
      }

      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const nextHeight = inner.scrollHeight
        if (nextHeight === lastSyncedHeight) {
          return
        }

        lastSyncedHeight = nextHeight
        const next = `${nextHeight}px`

        content.classList.add("accordion-height-sync")
        content.style.setProperty("--radix-collapsible-content-height", next)
        requestAnimationFrame(() => {
          content.classList.remove("accordion-height-sync")
        })
      })
    }

    const resizeObserver = new ResizeObserver(() => {
      if (skipNextResize) {
        skipNextResize = false
        return
      }

      syncHeightInstant()
    })
    resizeObserver.observe(inner)

    const stateObserver = new MutationObserver(() => {
      if (content.dataset.state === "closed") {
        clearSyncedHeight()
        return
      }

      // Let Radix measure and animate on open — don't override height here.
    })
    stateObserver.observe(content, {
      attributes: true,
      attributeFilter: ["data-state"],
    })

    return () => {
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      stateObserver.disconnect()
    }
  }, [children, watchNestedResize])

  return (
    <AccordionPrimitive.Content
      data-slot="accordion-content"
      className="overflow-hidden text-sm data-open:animate-accordion-down data-closed:animate-accordion-up"
      {...props}
    >
      <div
        ref={innerRef}
        className={cn(
          "pt-1 pb-2 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground",
          className
        )}
      >
        {children}
      </div>
    </AccordionPrimitive.Content>
  )
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
