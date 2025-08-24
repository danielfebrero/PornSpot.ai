import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "./ui/Button";
import { useTranslations } from "next-intl";

// Backward compatibility - re-export the original ErrorBoundary as a component-level boundary
import { ComponentErrorBoundary } from "./ErrorBoundaries";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (_error: Error, _errorInfo: ErrorInfo) => void;
  resetKeys?: string[];
  context?: string;
  translations?: {
    title: string;
    tryAgain: string;
    errorDetails: string;
    error: string;
    componentStack: string;
  };
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

// Legacy ErrorBoundary - maintained for backward compatibility
// New implementations should use the granular error boundaries from ErrorBoundaries.tsx
export class ErrorBoundary extends Component<Props, State> {
  private resetTimeoutId: number | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // Call the onError callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log the error in development
    if (process.env.NODE_ENV === "development") {
      console.error("ErrorBoundary caught an error:", error, errorInfo);
    }
  }

  override componentDidUpdate(prevProps: Props) {
    const { children, resetKeys } = this.props;
    const { hasError } = this.state;

    // Reset error state if children change and we're in an error state
    if (hasError && prevProps.children !== children) {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
      });
    }

    // Reset error state if resetKeys change
    if (hasError && resetKeys && prevProps.resetKeys) {
      const hasResetKeyChanged = resetKeys.some(
        (key, idx) => key !== prevProps.resetKeys?.[idx]
      );
      if (hasResetKeyChanged) {
        this.setState({
          hasError: false,
          error: null,
          errorInfo: null,
        });
      }
    }
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  private handleRetry = () => {
    this.handleReset();
    // Force a re-render after a short delay
    this.resetTimeoutId = window.setTimeout(() => {
      this.forceUpdate();
    }, 100);
  };

  override componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  private getErrorMessage(error: Error | null): string {
    if (!error) return "";

    // Handle different error types
    if (error.name === "NetworkError" || error.message.includes("Network")) {
      return "Check your internet connection";
    }

    return error.message;
  }

  override render() {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback, translations } = this.props;

    if (hasError) {
      // Custom fallback UI
      if (fallback) {
        return fallback;
      }

      const errorMessage = this.getErrorMessage(error);

      // Default error UI
      return (
        <div
          className="flex min-h-[400px] flex-col items-center justify-center space-y-4 p-8 text-center"
          role="alert"
          aria-live="assertive"
        >
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-destructive">
              {translations?.title || "Something went wrong"}
            </h2>
            {error && <p className="text-muted-foreground">{error.message}</p>}
            {errorMessage && errorMessage !== error?.message && (
              <p className="text-muted-foreground">{errorMessage}</p>
            )}
          </div>

          <div className="space-y-2">
            <Button
              onClick={this.handleRetry}
              variant="default"
              className="min-w-[120px]"
            >
              {translations?.tryAgain || "Try again"}
            </Button>
          </div>

          {/* Development error details */}
          {process.env.NODE_ENV === "development" && error && errorInfo && (
            <details className="mt-8 w-full max-w-2xl">
              <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                {translations?.errorDetails || "Error Details"}
              </summary>
              <div className="mt-4 space-y-4 text-left">
                <div>
                  <h4 className="font-medium">
                    {translations?.error || "Error"}:
                  </h4>
                  <pre className="mt-1 overflow-auto rounded bg-muted p-2 text-xs">
                    {error.toString()}
                  </pre>
                </div>
                <div>
                  <h4 className="font-medium">
                    {translations?.componentStack || "Component Stack"}:
                  </h4>
                  <pre className="mt-1 overflow-auto rounded bg-muted p-2 text-xs">
                    {errorInfo.componentStack}
                  </pre>
                </div>
              </div>
            </details>
          )}
        </div>
      );
    }

    return children;
  }
}

// For new code, prefer the granular error boundaries from ErrorBoundaries.tsx
// This is a convenience wrapper that uses ComponentErrorBoundary
export const SimpleErrorBoundary: React.FC<{
  children: ReactNode;
  context?: string;
}> = ({ children, context = "Component" }) => (
  <ComponentErrorBoundary context={context}>{children}</ComponentErrorBoundary>
);
