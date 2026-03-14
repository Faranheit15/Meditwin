"use client";

import Link from "next/link";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";

import { ROUTES } from "@/constants/routes";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    errorMessage: null,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    if (process.env.NODE_ENV === "development") {
      console.error("Render error captured", error, errorInfo);
    }
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      errorMessage: null,
    });
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="w-full max-w-xl rounded-3xl border border-border/70 bg-card/75 p-8 shadow-[0_24px_120px_rgba(0,0,0,0.35)] backdrop-blur">
          <div className="flex flex-col gap-5">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <AlertTriangle className="h-7 w-7" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold text-foreground">A rendering error interrupted the dashboard.</h1>
              <p className="text-sm leading-7 text-muted-foreground">
                Reset the current boundary or return to the dashboard shell.
              </p>
              {process.env.NODE_ENV === "development" && this.state.errorMessage ? (
                <pre className="overflow-x-auto rounded-2xl border border-border/80 bg-black/30 p-4 text-xs text-cyan-600 dark:text-cyan-200">
                  {this.state.errorMessage}
                </pre>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={this.handleReset}>
                <RefreshCcw className="h-4 w-4" />
                Try Again
              </Button>
              <Link href={ROUTES.PROTOCOLS} className={buttonVariants({ variant: "outline" })}>
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
