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
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content
      data-slot="accordion-content"
      className="overflow-hidden text-sm"
      {...props}
    >
      <div
        className={cn(
          "min-h-0 min-w-0 overflow-hidden pt-1 pb-2 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground",
          className
        )}
      >
        {children}
      </div>
    </AccordionPrimitive.Content>
  )
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
