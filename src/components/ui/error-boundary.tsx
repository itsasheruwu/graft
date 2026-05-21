import { Button } from "@/components/ui/button";
import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  title?: string;
};

type State = {
  error: Error | null;
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[Graft UI]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <p className="text-sm font-medium text-foreground">
            {this.props.title ?? "Something went wrong"}
          </p>
          <p className="text-xs text-muted-foreground">
            {this.state.error.message || "An unexpected error occurred."}
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              this.setState({ error: null });
              window.location.reload();
            }}
          >
            Reload
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
