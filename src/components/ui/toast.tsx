import * as React from "react";
import { Toast as ToastPrimitive } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { XIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const toastVariants = cva(
  "group/toast pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-lg border px-3 py-2.5 text-sm shadow-md transition-[transform,opacity] data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[state=closed]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:animate-in data-[state=open]:slide-in-from-right-full",
  {
    variants: {
      variant: {
        default: "border-border bg-card text-card-foreground",
        success:
          "border-graft-green/30 bg-graft-green/10 text-foreground dark:border-graft-green/25 dark:bg-graft-green/15",
        error:
          "border-destructive/30 bg-destructive/10 text-destructive dark:border-destructive/25 dark:bg-destructive/15",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export type ToastRecord = {
  id: string;
  title: string;
  description?: string;
  variant?: VariantProps<typeof toastVariants>["variant"];
  duration?: number;
};

type ToastContextValue = {
  toasts: ToastRecord[];
  toast: (input: Omit<ToastRecord, "id">) => string;
  dismiss: (id: string) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

function createToastId() {
  return `toast-${Math.random().toString(36).slice(2, 9)}`;
}

function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastRecord[]>([]);

  const dismiss = React.useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = React.useCallback((input: Omit<ToastRecord, "id">) => {
    const id = createToastId();
    setToasts((current) => [...current, { ...input, id }]);
    return id;
  }, []);

  const value = React.useMemo(
    () => ({ toasts, toast, dismiss }),
    [toasts, toast, dismiss]
  );

  return (
    <ToastContext.Provider value={value}>
      <ToastPrimitive.Provider swipeDirection="right">
        {children}
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}

function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

function Toaster({ className }: { className?: string }) {
  const { toasts, dismiss } = useToast();

  return (
    <ToastPrimitive.Viewport
      data-slot="toaster"
      className={cn(
        "fixed right-0 bottom-0 z-[100] flex max-h-screen w-full max-w-[var(--graft-toast-width)] flex-col-reverse gap-2 p-3 outline-none sm:max-w-[360px]",
        className
      )}
    >
      {toasts.map((item) => (
        <ToastItem key={item.id} item={item} onDismiss={() => dismiss(item.id)} />
      ))}
    </ToastPrimitive.Viewport>
  );
}

function ToastItem({
  item,
  onDismiss,
}: {
  item: ToastRecord;
  onDismiss: () => void;
}) {
  return (
    <ToastPrimitive.Root
      data-slot="toast"
      duration={item.duration ?? 3200}
      className={cn(toastVariants({ variant: item.variant }))}
      onOpenChange={(open) => {
        if (!open) {
          onDismiss();
        }
      }}
    >
      <div className="grid flex-1 gap-0.5">
        <ToastPrimitive.Title
          data-slot="toast-title"
          className="font-medium leading-snug"
        >
          {item.title}
        </ToastPrimitive.Title>
        {item.description ? (
          <ToastPrimitive.Description
            data-slot="toast-description"
            className="text-xs leading-relaxed text-muted-foreground"
          >
            {item.description}
          </ToastPrimitive.Description>
        ) : null}
      </div>
      <ToastPrimitive.Close
        data-slot="toast-close"
        className="rounded-md p-0.5 text-muted-foreground opacity-70 transition-opacity hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        aria-label="Dismiss"
      >
        <XIcon className="size-3.5" />
      </ToastPrimitive.Close>
    </ToastPrimitive.Root>
  );
}

export { ToastProvider, Toaster, useToast, toastVariants };
