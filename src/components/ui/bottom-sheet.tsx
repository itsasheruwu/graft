import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { XIcon } from "lucide-react";

import { cn } from "@/lib/utils";

function BottomSheet({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="bottom-sheet" {...props} />;
}

function BottomSheetTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="bottom-sheet-trigger" {...props} />;
}

function BottomSheetClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="bottom-sheet-close" {...props} />;
}

function BottomSheetPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="bottom-sheet-portal" {...props} />;
}

function BottomSheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="bottom-sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-foreground/20 backdrop-blur-[1px] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  );
}

function BottomSheetContent({
  className,
  children,
  showClose = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showClose?: boolean;
}) {
  return (
    <BottomSheetPortal>
      <BottomSheetOverlay />
      <DialogPrimitive.Content
        data-slot="bottom-sheet-content"
        className={cn(
          "graft-bottom-sheet fixed inset-x-0 bottom-0 z-50 flex max-h-[var(--graft-sheet-max-height)] w-full flex-col rounded-t-2xl border border-b-0 bg-background shadow-lg outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-bottom-[14px] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-[14px]",
          className
        )}
        {...props}
      >
        <div
          data-slot="bottom-sheet-handle"
          className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border"
          aria-hidden
        />
        {children}
        {showClose ? (
          <DialogPrimitive.Close
            data-slot="bottom-sheet-close"
            className="absolute top-3 right-3 rounded-md p-1 text-muted-foreground opacity-80 transition-opacity hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <XIcon className="size-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Content>
    </BottomSheetPortal>
  );
}

function BottomSheetHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="bottom-sheet-header"
      className={cn("flex flex-col gap-1 px-4 pt-4 pb-2", className)}
      {...props}
    />
  );
}

function BottomSheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="bottom-sheet-title"
      className={cn("text-base font-medium leading-snug", className)}
      {...props}
    />
  );
}

function BottomSheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="bottom-sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

function BottomSheetBody({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="bottom-sheet-body"
      className={cn("min-h-0 flex-1 overflow-y-auto px-4 py-2", className)}
      {...props}
    />
  );
}

function BottomSheetFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="bottom-sheet-footer"
      className={cn(
        "flex items-center justify-end gap-2 border-t bg-muted/30 px-4 py-3",
        className
      )}
      {...props}
    />
  );
}

export {
  BottomSheet,
  BottomSheetTrigger,
  BottomSheetClose,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
  BottomSheetDescription,
  BottomSheetBody,
  BottomSheetFooter,
};
