"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { finbyApi } from "@/lib/api";
import { ApiUtil } from "@/lib/api-util";
import { useUserContext } from "@/contexts/UserContext";
import { useLocaleRouter } from "@/lib/navigation";
import { FinbyPaymentStatus } from "@/types";
import { useTranslations } from "next-intl";

type PaymentStatusPageProps = {
  params: { locale: string; status: string };
};

type ViewState = "processing" | "completed" | "error" | "missingReference";
type NormalizedStatus = FinbyPaymentStatus | "unknown";

interface MessageCopy {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  icon?: "success" | "error";
}

const POLLING_INTERVAL_MS = 5000;

type TranslateFn = ReturnType<typeof useTranslations>;

const normalizeStatus = (rawStatus: string | undefined): NormalizedStatus => {
  if (!rawStatus) {
    return "unknown";
  }

  const normalized = rawStatus.toLowerCase();
  if (
    normalized === "success" ||
    normalized === "cancel" ||
    normalized === "error"
  ) {
    return normalized;
  }

  return "unknown";
};

const getProcessingCopy = (
  status: NormalizedStatus,
  t: TranslateFn
): MessageCopy => {
  const key =
    status === "success"
      ? "processing.success"
      : status === "cancel"
      ? "processing.cancel"
      : status === "error"
      ? "processing.error"
      : "processing.default";

  return {
    title: t(`${key}.title`),
    description: t(`${key}.description`),
  };
};

const getCompletedCopy = (
  status: FinbyPaymentStatus,
  t: TranslateFn
): MessageCopy => {
  const key =
    status === "success"
      ? "completed.success"
      : status === "cancel"
      ? "completed.cancel"
      : status === "error"
      ? "completed.error"
      : "completed.default";

  return {
    title: t(`${key}.title`),
    description: t(`${key}.description`),
    actionLabel: t(`${key}.actionLabel`),
    actionHref:
      status === "success"
        ? "/user/profile"
        : status === "cancel"
        ? "/pricing"
        : status === "error"
        ? "/pricing"
        : "/pricing",
    icon: status === "error" ? "error" : "success",
  };
};

const getErrorCopy = (t: TranslateFn, message?: string): MessageCopy => ({
  title: t("errors.genericTitle"),
  description: message || t("errors.genericDescription"),
  actionLabel: t("actions.backToPricing"),
  actionHref: "/pricing",
  icon: "error",
});

function PaymentStatusContent({ status }: { status: NormalizedStatus }) {
  const t = useTranslations("paymentStatus");
  const searchParams = useSearchParams();
  const reference = useMemo(
    () => searchParams.get("Reference"),
    [searchParams]
  );
  const [viewState, setViewState] = useState<ViewState>(
    status === "unknown" ? "error" : "processing"
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(
    status === "unknown" ? t("errors.invalidStatus") : null
  );
  const pollingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasRefetched = useRef(false);
  const { refetch } = useUserContext();
  const router = useLocaleRouter();

  useEffect(() => {
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }

    if (!reference) {
      setViewState("missingReference");
      setErrorMessage(t("errors.missingReference"));
      return;
    }

    if (status === "unknown") {
      setViewState("error");
      setErrorMessage(t("errors.invalidStatus"));
      return;
    }

    let cancelled = false;

    const checkStatus = async () => {
      if (cancelled) return;

      try {
        const response = await finbyApi.status({
          reference,
          status,
        });

        const isCompleted =
          status === "success" ? Boolean(response?.completed) : true;

        if (cancelled) return;

        if (isCompleted) {
          if (status === "success" && !hasRefetched.current) {
            try {
              await refetch();
            } catch (err) {
              console.error("Failed to refresh user after payment:", err);
            } finally {
              hasRefetched.current = true;
            }
          }

          setViewState("completed");
          setErrorMessage(null);
          return;
        }

        setViewState("processing");
        pollingTimeoutRef.current = setTimeout(
          checkStatus,
          POLLING_INTERVAL_MS
        );
      } catch (error) {
        if (cancelled) return;
        setViewState("error");
        setErrorMessage(ApiUtil.handleApiError(error));
      }
    };

    setViewState("processing");
    setErrorMessage(null);
    checkStatus();

    return () => {
      cancelled = true;
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
        pollingTimeoutRef.current = null;
      }
    };
  }, [reference, status, refetch, t]);

  const messages = useMemo<MessageCopy>(() => {
    if (viewState === "missingReference") {
      return {
        title: t("missingReference.title"),
        description: errorMessage || t("missingReference.description"),
        actionLabel: t("missingReference.actionLabel"),
        actionHref: "/pricing",
        icon: "error",
      };
    }

    if (viewState === "error") {
      return getErrorCopy(t, errorMessage ?? undefined);
    }

    if (viewState === "completed") {
      if (status === "unknown") {
        return getErrorCopy(t);
      }

      return getCompletedCopy(status, t);
    }

    return getProcessingCopy(status, t);
  }, [viewState, status, errorMessage, t]);

  const showSpinner = viewState === "processing";

  const actionLabel = messages.actionLabel;
  const actionHref = messages.actionHref;
  const canShowAction = Boolean(
    actionLabel && actionHref && viewState !== "processing"
  );

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-16">
      <div className="w-full max-w-xl rounded-2xl border border-border bg-card/80 p-8 text-center shadow-lg backdrop-blur">
        {showSpinner ? (
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <div className="h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          </div>
        ) : messages.icon === "success" ? (
          <CheckCircle2 className="mx-auto mb-6 h-16 w-16 text-emerald-500" />
        ) : messages.icon === "error" ? (
          <AlertCircle className="mx-auto mb-6 h-16 w-16 text-red-500" />
        ) : null}

        <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">
          {messages.title}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
          {messages.description}
        </p>

        {canShowAction && actionHref && actionLabel && (
          <div className="mt-6 flex justify-center">
            <Button onClick={() => router.push(actionHref)}>
              {actionLabel}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function PaymentStatusFallback({ status }: { status: NormalizedStatus }) {
  const t = useTranslations("paymentStatus");
  const messages = getProcessingCopy(status, t);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-16">
      <div className="w-full max-w-xl rounded-2xl border border-border bg-card/80 p-8 text-center shadow-lg backdrop-blur">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <div className="h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        </div>

        <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">
          {messages.title}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
          {messages.description}
        </p>
      </div>
    </div>
  );
}

export const dynamic = "force-dynamic";

export default function PaymentStatusPage({ params }: PaymentStatusPageProps) {
  const normalizedStatus = normalizeStatus(params.status);

  return (
    <Suspense fallback={<PaymentStatusFallback status={normalizedStatus} />}>
      <PaymentStatusContent status={normalizedStatus} />
    </Suspense>
  );
}
