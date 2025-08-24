"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "./ui/Button";
import { RefreshCw, AlertTriangle, Home, ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";

// Translations interface for class components
interface ErrorBoundaryTranslations {
  appLevel: {
    title: string;
    description: string;
    tryAgain: string;
    goToHomepage: string;
  };
  pageLevel: {
    title: string;
    description: string;
    retry: string;
    goBack: string;
  };
  sectionLevel: {
    title: string;
    description: string;
    retrySection: string;
  };
  componentLevel: {
    title: string;
    description: string;
    retry: string;
  };
}

// Base Error Boundary Props
interface BaseErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (_error: Error, _errorInfo: ErrorInfo) => void;
  resetKeys?: string[];
  level?: "app" | "page" | "section" | "component";
  context?: string;
  translations?: ErrorBoundaryTranslations;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

// App-Level Error Boundary (Top Level)
export class AppErrorBoundary extends Component<
  BaseErrorBoundaryProps,
  ErrorBoundaryState
> {
  private resetTimeoutId: number | null = null;

  constructor(props: BaseErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
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

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log critical app-level errors
    console.error(
      "🚨 App-level error boundary caught an error:",
      error,
      errorInfo
    );

    // Report to error tracking service in production
    if (process.env.NODE_ENV === "production") {
      // TODO: Integrate with error reporting service (Sentry, LogRocket, etc.)
    }
  }

  override componentDidUpdate(prevProps: BaseErrorBoundaryProps) {
    const { children, resetKeys } = this.props;
    const { hasError } = this.state;

    if (hasError && prevProps.children !== children) {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
      });
    }

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
    this.resetTimeoutId = window.setTimeout(() => {
      this.forceUpdate();
    }, 100);
  };

  private handleGoHome = () => {
    this.handleReset();
    window.location.href = "/";
  };

  override componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  override render() {
    const { hasError, error } = this.state;
    const { children, fallback, translations } = this.props;

    if (hasError) {
      if (fallback) {
        return fallback;
      }

      const t = translations?.appLevel || {
        title: "Something went wrong",
        description:
          "We encountered an unexpected error. Please try refreshing the page or return to the homepage.",
        tryAgain: "Try Again",
        goToHomepage: "Go to Homepage",
      };

      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="space-y-4">
              <div className="w-20 h-20 mx-auto bg-destructive/10 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-10 h-10 text-destructive" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">{t.title}</h1>
              <p className="text-muted-foreground">{t.description}</p>
              {error && process.env.NODE_ENV === "development" && (
                <p className="text-sm text-destructive font-mono">
                  {error.message}
                </p>
              )}
            </div>

            <div className="space-y-3">
              <Button
                onClick={this.handleRetry}
                variant="default"
                className="w-full"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                {t.tryAgain}
              </Button>
              <Button
                onClick={this.handleGoHome}
                variant="outline"
                className="w-full"
              >
                <Home className="w-4 h-4 mr-2" />
                {t.goToHomepage}
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return children;
  }
}

// Page-Level Error Boundary
export class PageErrorBoundary extends Component<
  BaseErrorBoundaryProps,
  ErrorBoundaryState
> {
  private resetTimeoutId: number | null = null;

  constructor(props: BaseErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
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

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    console.error(
      `🔴 Page-level error boundary caught an error (${this.props.context}):`,
      error,
      errorInfo
    );
  }

  override componentDidUpdate(prevProps: BaseErrorBoundaryProps) {
    const { children, resetKeys } = this.props;
    const { hasError } = this.state;

    if (hasError && prevProps.children !== children) {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
      });
    }

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
    this.resetTimeoutId = window.setTimeout(() => {
      this.forceUpdate();
    }, 100);
  };

  private handleGoBack = () => {
    this.handleReset();
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = "/";
    }
  };

  override componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  override render() {
    const { hasError, error } = this.state;
    const { children, fallback, context, translations } = this.props;

    if (hasError) {
      if (fallback) {
        return fallback;
      }

      const t = translations?.pageLevel || {
        title: "Page Error",
        description:
          "This page encountered an error and couldn't load properly.",
        retry: "Retry",
        goBack: "Go Back",
      };

      return (
        <div className="min-h-[400px] flex items-center justify-center p-8">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="space-y-4">
              <div className="w-16 h-16 mx-auto bg-destructive/10 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-destructive" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">
                {t.title}
              </h2>
              <p className="text-muted-foreground">
                {t.description}
                {context && ` (${context})`}
              </p>
              {error && process.env.NODE_ENV === "development" && (
                <p className="text-sm text-destructive font-mono">
                  {error.message}
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <Button onClick={this.handleRetry} variant="default" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                {t.retry}
              </Button>
              <Button onClick={this.handleGoBack} variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                {t.goBack}
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return children;
  }
}

// Section-Level Error Boundary (for major page sections)
export class SectionErrorBoundary extends Component<
  BaseErrorBoundaryProps,
  ErrorBoundaryState
> {
  private resetTimeoutId: number | null = null;

  constructor(props: BaseErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
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

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    console.error(
      `🟡 Section-level error boundary caught an error (${this.props.context}):`,
      error,
      errorInfo
    );
  }

  override componentDidUpdate(prevProps: BaseErrorBoundaryProps) {
    const { children, resetKeys } = this.props;
    const { hasError } = this.state;

    if (hasError && prevProps.children !== children) {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
      });
    }

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
    this.resetTimeoutId = window.setTimeout(() => {
      this.forceUpdate();
    }, 100);
  };

  override componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  override render() {
    const { hasError, error } = this.state;
    const { children, fallback, context, translations } = this.props;

    if (hasError) {
      if (fallback) {
        return fallback;
      }

      const t = translations?.sectionLevel || {
        title: "Section Error",
        description: "This section couldn't load properly.",
        retrySection: "Retry Section",
      };

      return (
        <div className="bg-card border border-border rounded-lg p-6 text-center space-y-4">
          <div className="w-12 h-12 mx-auto bg-destructive/10 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-destructive" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-medium text-foreground">{t.title}</h3>
            <p className="text-sm text-muted-foreground">
              {t.description}
              {context && ` (${context})`}
            </p>
            {error && process.env.NODE_ENV === "development" && (
              <p className="text-xs text-destructive font-mono">
                {error.message}
              </p>
            )}
          </div>
          <Button onClick={this.handleRetry} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            {t.retrySection}
          </Button>
        </div>
      );
    }

    return children;
  }
}

// Component-Level Error Boundary (for individual components)
export class ComponentErrorBoundary extends Component<
  BaseErrorBoundaryProps,
  ErrorBoundaryState
> {
  private resetTimeoutId: number | null = null;

  constructor(props: BaseErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
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

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    console.error(
      `🔵 Component-level error boundary caught an error (${this.props.context}):`,
      error,
      errorInfo
    );
  }

  override componentDidUpdate(prevProps: BaseErrorBoundaryProps) {
    const { children, resetKeys } = this.props;
    const { hasError } = this.state;

    if (hasError && prevProps.children !== children) {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
      });
    }

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
    this.resetTimeoutId = window.setTimeout(() => {
      this.forceUpdate();
    }, 100);
  };

  override componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  override render() {
    const { hasError, error } = this.state;
    const { children, fallback, context, translations } = this.props;

    if (hasError) {
      if (fallback) {
        return fallback;
      }

      const t = translations?.componentLevel || {
        title: "Component Error",
        description: "This component failed to render.",
        retry: "Retry",
      };

      return (
        <div className="bg-muted/50 border border-border rounded p-4 text-center space-y-3">
          <div className="w-8 h-8 mx-auto bg-destructive/10 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-destructive" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">{t.title}</p>
            <p className="text-xs text-muted-foreground">
              {t.description}
              {context && ` (${context})`}
            </p>
            {error && process.env.NODE_ENV === "development" && (
              <p className="text-xs text-destructive font-mono">
                {error.message}
              </p>
            )}
          </div>
          <Button
            onClick={this.handleRetry}
            variant="ghost"
            size="sm"
            className="text-xs"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            {t.retry}
          </Button>
        </div>
      );
    }

    return children;
  }
}

// Convenience wrapper components with predefined contexts
export const AlbumGridErrorBoundary: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const t = useTranslations("errorBoundary");
  const translations: ErrorBoundaryTranslations = {
    appLevel: {
      title: t("appLevel.title"),
      description: t("appLevel.description"),
      tryAgain: t("appLevel.tryAgain"),
      goToHomepage: t("appLevel.goToHomepage"),
    },
    pageLevel: {
      title: t("pageLevel.title"),
      description: t("pageLevel.description"),
      retry: t("pageLevel.retry"),
      goBack: t("pageLevel.goBack"),
    },
    sectionLevel: {
      title: t("sectionLevel.title"),
      description: t("sectionLevel.description"),
      retrySection: t("sectionLevel.retrySection"),
    },
    componentLevel: {
      title: t("componentLevel.title"),
      description: t("componentLevel.description"),
      retry: t("componentLevel.retry"),
    },
  };

  return (
    <SectionErrorBoundary context="Album Grid" translations={translations}>
      {children}
    </SectionErrorBoundary>
  );
};

export const MediaGalleryErrorBoundary: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const t = useTranslations("errorBoundary");
  const translations: ErrorBoundaryTranslations = {
    appLevel: {
      title: t("appLevel.title"),
      description: t("appLevel.description"),
      tryAgain: t("appLevel.tryAgain"),
      goToHomepage: t("appLevel.goToHomepage"),
    },
    pageLevel: {
      title: t("pageLevel.title"),
      description: t("pageLevel.description"),
      retry: t("pageLevel.retry"),
      goBack: t("pageLevel.goBack"),
    },
    sectionLevel: {
      title: t("sectionLevel.title"),
      description: t("sectionLevel.description"),
      retrySection: t("sectionLevel.retrySection"),
    },
    componentLevel: {
      title: t("componentLevel.title"),
      description: t("componentLevel.description"),
      retry: t("componentLevel.retry"),
    },
  };

  return (
    <SectionErrorBoundary context="Media Gallery" translations={translations}>
      {children}
    </SectionErrorBoundary>
  );
};

export const ProfileErrorBoundary: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const t = useTranslations("errorBoundary");
  const translations: ErrorBoundaryTranslations = {
    appLevel: {
      title: t("appLevel.title"),
      description: t("appLevel.description"),
      tryAgain: t("appLevel.tryAgain"),
      goToHomepage: t("appLevel.goToHomepage"),
    },
    pageLevel: {
      title: t("pageLevel.title"),
      description: t("pageLevel.description"),
      retry: t("pageLevel.retry"),
      goBack: t("pageLevel.goBack"),
    },
    sectionLevel: {
      title: t("sectionLevel.title"),
      description: t("sectionLevel.description"),
      retrySection: t("sectionLevel.retrySection"),
    },
    componentLevel: {
      title: t("componentLevel.title"),
      description: t("componentLevel.description"),
      retry: t("componentLevel.retry"),
    },
  };

  return (
    <SectionErrorBoundary context="User Profile" translations={translations}>
      {children}
    </SectionErrorBoundary>
  );
};

export const AdminErrorBoundary: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const t = useTranslations("errorBoundary");
  const translations: ErrorBoundaryTranslations = {
    appLevel: {
      title: t("appLevel.title"),
      description: t("appLevel.description"),
      tryAgain: t("appLevel.tryAgain"),
      goToHomepage: t("appLevel.goToHomepage"),
    },
    pageLevel: {
      title: t("pageLevel.title"),
      description: t("pageLevel.description"),
      retry: t("pageLevel.retry"),
      goBack: t("pageLevel.goBack"),
    },
    sectionLevel: {
      title: t("sectionLevel.title"),
      description: t("sectionLevel.description"),
      retrySection: t("sectionLevel.retrySection"),
    },
    componentLevel: {
      title: t("componentLevel.title"),
      description: t("componentLevel.description"),
      retry: t("componentLevel.retry"),
    },
  };

  return (
    <SectionErrorBoundary context="Admin Panel" translations={translations}>
      {children}
    </SectionErrorBoundary>
  );
};

export const AuthErrorBoundary: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const t = useTranslations("errorBoundary");
  const translations: ErrorBoundaryTranslations = {
    appLevel: {
      title: t("appLevel.title"),
      description: t("appLevel.description"),
      tryAgain: t("appLevel.tryAgain"),
      goToHomepage: t("appLevel.goToHomepage"),
    },
    pageLevel: {
      title: t("pageLevel.title"),
      description: t("pageLevel.description"),
      retry: t("pageLevel.retry"),
      goBack: t("pageLevel.goBack"),
    },
    sectionLevel: {
      title: t("sectionLevel.title"),
      description: t("sectionLevel.description"),
      retrySection: t("sectionLevel.retrySection"),
    },
    componentLevel: {
      title: t("componentLevel.title"),
      description: t("componentLevel.description"),
      retry: t("componentLevel.retry"),
    },
  };

  return (
    <SectionErrorBoundary context="Authentication" translations={translations}>
      {children}
    </SectionErrorBoundary>
  );
};

export const CommentsErrorBoundary: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const t = useTranslations("errorBoundary");
  const translations: ErrorBoundaryTranslations = {
    appLevel: {
      title: t("appLevel.title"),
      description: t("appLevel.description"),
      tryAgain: t("appLevel.tryAgain"),
      goToHomepage: t("appLevel.goToHomepage"),
    },
    pageLevel: {
      title: t("pageLevel.title"),
      description: t("pageLevel.description"),
      retry: t("pageLevel.retry"),
      goBack: t("pageLevel.goBack"),
    },
    sectionLevel: {
      title: t("sectionLevel.title"),
      description: t("sectionLevel.description"),
      retrySection: t("sectionLevel.retrySection"),
    },
    componentLevel: {
      title: t("componentLevel.title"),
      description: t("componentLevel.description"),
      retry: t("componentLevel.retry"),
    },
  };

  return (
    <ComponentErrorBoundary context="Comments" translations={translations}>
      {children}
    </ComponentErrorBoundary>
  );
};

export const ContentCardErrorBoundary: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const t = useTranslations("errorBoundary");
  const translations: ErrorBoundaryTranslations = {
    appLevel: {
      title: t("appLevel.title"),
      description: t("appLevel.description"),
      tryAgain: t("appLevel.tryAgain"),
      goToHomepage: t("appLevel.goToHomepage"),
    },
    pageLevel: {
      title: t("pageLevel.title"),
      description: t("pageLevel.description"),
      retry: t("pageLevel.retry"),
      goBack: t("pageLevel.goBack"),
    },
    sectionLevel: {
      title: t("sectionLevel.title"),
      description: t("sectionLevel.description"),
      retrySection: t("sectionLevel.retrySection"),
    },
    componentLevel: {
      title: t("componentLevel.title"),
      description: t("componentLevel.description"),
      retry: t("componentLevel.retry"),
    },
  };

  return (
    <ComponentErrorBoundary context="Content Card" translations={translations}>
      {children}
    </ComponentErrorBoundary>
  );
};

export const LightboxErrorBoundary: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const t = useTranslations("errorBoundary");
  const translations: ErrorBoundaryTranslations = {
    appLevel: {
      title: t("appLevel.title"),
      description: t("appLevel.description"),
      tryAgain: t("appLevel.tryAgain"),
      goToHomepage: t("appLevel.goToHomepage"),
    },
    pageLevel: {
      title: t("pageLevel.title"),
      description: t("pageLevel.description"),
      retry: t("pageLevel.retry"),
      goBack: t("pageLevel.goBack"),
    },
    sectionLevel: {
      title: t("sectionLevel.title"),
      description: t("sectionLevel.description"),
      retrySection: t("sectionLevel.retrySection"),
    },
    componentLevel: {
      title: t("componentLevel.title"),
      description: t("componentLevel.description"),
      retry: t("componentLevel.retry"),
    },
  };

  return (
    <ComponentErrorBoundary context="Lightbox" translations={translations}>
      {children}
    </ComponentErrorBoundary>
  );
};

// Main wrapper components that use translations
export const TranslatedAppErrorBoundary: React.FC<{
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (_error: Error, _errorInfo: ErrorInfo) => void;
  resetKeys?: string[];
}> = ({ children, ...props }) => {
  const t = useTranslations("errorBoundary");
  const translations: ErrorBoundaryTranslations = {
    appLevel: {
      title: t("appLevel.title"),
      description: t("appLevel.description"),
      tryAgain: t("appLevel.tryAgain"),
      goToHomepage: t("appLevel.goToHomepage"),
    },
    pageLevel: {
      title: t("pageLevel.title"),
      description: t("pageLevel.description"),
      retry: t("pageLevel.retry"),
      goBack: t("pageLevel.goBack"),
    },
    sectionLevel: {
      title: t("sectionLevel.title"),
      description: t("sectionLevel.description"),
      retrySection: t("sectionLevel.retrySection"),
    },
    componentLevel: {
      title: t("componentLevel.title"),
      description: t("componentLevel.description"),
      retry: t("componentLevel.retry"),
    },
  };

  return (
    <AppErrorBoundary translations={translations} {...props}>
      {children}
    </AppErrorBoundary>
  );
};

export const TranslatedPageErrorBoundary: React.FC<{
  children: ReactNode;
  context?: string;
  fallback?: ReactNode;
  onError?: (_error: Error, _errorInfo: ErrorInfo) => void;
  resetKeys?: string[];
}> = ({ children, ...props }) => {
  const t = useTranslations("errorBoundary");
  const translations: ErrorBoundaryTranslations = {
    appLevel: {
      title: t("appLevel.title"),
      description: t("appLevel.description"),
      tryAgain: t("appLevel.tryAgain"),
      goToHomepage: t("appLevel.goToHomepage"),
    },
    pageLevel: {
      title: t("pageLevel.title"),
      description: t("pageLevel.description"),
      retry: t("pageLevel.retry"),
      goBack: t("pageLevel.goBack"),
    },
    sectionLevel: {
      title: t("sectionLevel.title"),
      description: t("sectionLevel.description"),
      retrySection: t("sectionLevel.retrySection"),
    },
    componentLevel: {
      title: t("componentLevel.title"),
      description: t("componentLevel.description"),
      retry: t("componentLevel.retry"),
    },
  };

  return (
    <PageErrorBoundary translations={translations} {...props}>
      {children}
    </PageErrorBoundary>
  );
};
