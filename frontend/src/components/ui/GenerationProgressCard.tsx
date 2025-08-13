import {
  AlertCircle,
  Clock,
  Cpu,
  RotateCcw,
  Zap,
  ArrowRight,
} from "lucide-react";
import { useMemo } from "react";

type QueueStatus = {
  status?: "pending" | "processing" | "completed" | "failed";
  queuePosition?: number;
  estimatedWaitTime?: number; // ms
};

type WorkflowNode = {
  nodeId: string;
  classType: string;
  nodeTitle: string;
  dependencies: string[];
};

export function GenerationProgressCard({
  queueStatus,
  progress,
  maxProgress,
  currentMessage,
  currentNode,
  nodeState,
  retryCount,
  isRetrying,
  error,
  workflowNodes,
  currentNodeIndex,
}: {
  queueStatus: QueueStatus | null | undefined;
  progress: number;
  maxProgress: number;
  currentMessage: string;
  currentNode: string;
  nodeState: string;
  retryCount: number;
  isRetrying: boolean;
  error: string | null;
  workflowNodes: WorkflowNode[];
  currentNodeIndex: number;
}) {
  // Derived values
  const percent = useMemo(() => {
    if (!maxProgress || maxProgress <= 0) return 0;
    const p = Math.max(0, Math.min(100, (progress / maxProgress) * 100));
    return p;
  }, [progress, maxProgress]);

  const status = queueStatus?.status ?? (error ? "failed" : undefined);

  const showStepsPreview =
    !currentNode && workflowNodes.length > 0 && status === "processing";

  const circumference = 2 * Math.PI * 60; // r=60 (matches viewBox)
  const dash = (percent / 100) * circumference;

  const isPending = status === "pending";
  const isProcessing = status === "processing";
  const isFailed = !!error || status === "failed";

  // Choose central icon with minimal DOM changes (only icon changes)
  const CentralIcon = isFailed
    ? AlertCircle
    : isRetrying
    ? RotateCcw
    : isPending
    ? Clock
    : Zap;

  // Status text variations (texts swap without remount)
  const titleText = isFailed
    ? "Generation Failed"
    : isRetrying
    ? "Retrying Generation"
    : isPending && !currentNode && percent === 0
    ? "Queued for Generation"
    : "Creating Your Masterpiece";

  const subtitleText = isFailed
    ? "Please review the error details below."
    : isRetrying
    ? `Attempt ${Math.max(1, retryCount)}/3 - AI is working its magic...`
    : isPending && queueStatus?.queuePosition
    ? `Position #${queueStatus.queuePosition} in queue`
    : "AI is working its magic...";

  // Estimated wait (minutes)
  const estimatedWaitMin =
    queueStatus?.estimatedWaitTime && queueStatus.estimatedWaitTime > 0
      ? Math.round(queueStatus.estimatedWaitTime / 1000 / 60)
      : 0;

  return (
    <div className="w-full max-w-md mx-auto">
      <div
        className="relative rounded-2xl overflow-hidden bg-card border border-border shadow-lg"
        aria-busy={isProcessing || isPending || isRetrying}
      >
        {/* Fixed-Aspect Visual Container to prevent layout shift across states */}
        <div className="relative aspect-square bg-gradient-to-br from-muted/40 via-muted/20 to-muted/10">
          {/* Subtle animated background that does not affect layout */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 bg-gradient-to-t from-primary/10 via-transparent to-transparent animate-pulse" />
          </div>

          {/* Center Visual + Progress Ring (always rendered for stability) */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-40 h-40 md:w-48 md:h-48">
              {/* Glow */}
              <div className="absolute inset-0 rounded-full blur-3xl bg-primary/15 animate-pulse" />
              {/* Ring */}
              <svg
                className="relative w-full h-full -rotate-90"
                viewBox="0 0 128 128"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient
                    id="progressGradient"
                    x1="0"
                    x2="1"
                    y1="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor="rgb(var(--primary))" />
                    <stop offset="100%" stopColor="rgb(147, 51, 234)" />
                  </linearGradient>
                </defs>
                <circle
                  cx="64"
                  cy="64"
                  r="60"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-border/60"
                  fill="none"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="60"
                  stroke="url(#progressGradient)"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${dash} ${circumference}`}
                  strokeLinecap="round"
                  className="transition-[stroke-dasharray] duration-500 ease-out"
                />
              </svg>

              {/* Central Icon Button-like disc (icon only changes) */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="relative w-28 h-28 md:w-32 md:h-32 rounded-full border border-primary/30 bg-gradient-to-br from-primary/20 to-purple-600/20 backdrop-blur-sm flex items-center justify-center">
                  <CentralIcon
                    className={
                      "h-14 w-14 " +
                      (isFailed
                        ? "text-destructive"
                        : isRetrying
                        ? "text-amber-500 animate-spin"
                        : "text-primary animate-pulse")
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Overlay Content (kept consistent to minimize shifts) */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/95 to-transparent p-6">
            <div className="space-y-4">
              {/* Status Header (fixed block height via line-clamp and min-h) */}
              <div
                className="text-center space-y-1.5 min-h-[56px]"
                aria-live="polite"
              >
                <h3 className="text-lg font-semibold text-foreground">
                  {titleText}
                </h3>
                <p className="text-sm text-muted-foreground">{subtitleText}</p>
              </div>

              {/* Node / Steps Area (constant min-height to avoid shift) */}
              <div className="min-h-[112px]">
                {/* Current Node Details */}
                <div
                  className={
                    "transition-opacity duration-300 " +
                    (currentNode
                      ? "opacity-100"
                      : "opacity-0 pointer-events-none")
                  }
                  aria-hidden={!currentNode}
                >
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Cpu className="w-3 h-3 text-primary animate-pulse" />
                      <span className="text-xs font-medium text-primary">
                        Currently Processing
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-foreground truncate">
                      {currentNode || "\u00A0"}
                    </div>
                    <div className="text-xs text-muted-foreground capitalize mt-1 min-h-[16px]">
                      {nodeState ? `State: ${nodeState}` : "\u00A0"}
                    </div>

                    {/* Workflow Progress Indicator */}
                    {workflowNodes.length > 0 ? (
                      <div className="mt-2 pt-2 border-t border-primary/10">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">
                            Workflow Progress
                          </span>
                          <span className="text-foreground font-medium">
                            {Math.min(
                              currentNodeIndex + 1,
                              workflowNodes.length
                            )}{" "}
                            of {workflowNodes.length}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-1 overflow-hidden">
                          {workflowNodes.map((node, index) => (
                            <div
                              key={node.nodeId}
                              className="flex items-center"
                            >
                              <div
                                className={`w-2 h-2 rounded-full transition-colors ${
                                  index < currentNodeIndex
                                    ? "bg-green-500"
                                    : index === currentNodeIndex
                                    ? "bg-primary animate-pulse"
                                    : "bg-muted"
                                }`}
                                title={node.nodeTitle}
                              />
                              {index < workflowNodes.length - 1 && (
                                <ArrowRight className="w-2 h-2 text-muted-foreground mx-0.5" />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Steps Preview (shown when no current node but have workflow) */}
                <div
                  className={
                    "transition-opacity duration-300 " +
                    (showStepsPreview
                      ? "opacity-100"
                      : "opacity-0 pointer-events-none")
                  }
                  aria-hidden={!showStepsPreview}
                >
                  <div className="bg-muted/5 border border-muted/20 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">
                        Workflow Steps
                      </span>
                    </div>
                    <div className="space-y-1">
                      {workflowNodes.slice(0, 3).map((node, index) => (
                        <div
                          key={node.nodeId}
                          className="flex items-center gap-2 text-xs"
                          title={node.nodeTitle}
                        >
                          <div
                            className={`w-1.5 h-1.5 rounded-full ${
                              index < currentNodeIndex
                                ? "bg-green-500"
                                : index === currentNodeIndex
                                ? "bg-primary"
                                : "bg-muted"
                            }`}
                          />
                          <span className="text-muted-foreground truncate">
                            {node.nodeTitle}
                          </span>
                        </div>
                      ))}
                      {workflowNodes.length > 3 && (
                        <div className="text-xs text-muted-foreground pl-3.5">
                          ... and {workflowNodes.length - 3} more steps
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Placeholder (kept for layout stability when neither node nor preview) */}
                <div
                  className={
                    "transition-opacity duration-300 " +
                    (currentNode || showStepsPreview
                      ? "opacity-0 pointer-events-none"
                      : "opacity-100")
                  }
                  aria-hidden={!!currentNode || showStepsPreview}
                >
                  <div className="rounded-lg p-3 border border-border/50 bg-muted/10">
                    <div className="h-3 w-24 bg-muted rounded animate-pulse" />
                    <div className="mt-2 h-3 w-40 bg-muted rounded animate-pulse" />
                    <div className="mt-2 h-3 w-32 bg-muted rounded animate-pulse" />
                  </div>
                </div>
              </div>

              {/* Progress Bar (always visible) */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="text-foreground font-medium">
                    {Math.round(percent)}%
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-primary to-purple-600 h-2 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>

              {/* System Message / Error Area (reserve space to minimize shift) */}
              <div className="min-h-[72px]">
                {/* Error Callout */}
                <div
                  className={
                    "transition-opacity duration-300 " +
                    (isFailed ? "opacity-100" : "opacity-0 pointer-events-none")
                  }
                  role={isFailed ? "alert" : undefined}
                  aria-hidden={!isFailed}
                >
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <div className="flex items-center gap-2 text-destructive mb-1">
                      <AlertCircle className="h-3 w-3" />
                      <span className="text-xs font-medium">
                        Generation Failed
                      </span>
                    </div>
                    <p className="text-xs text-destructive/80">
                      {error || "An unexpected error occurred."}
                    </p>
                  </div>
                </div>

                {/* Informational Message (shown when no error) */}
                <div
                  className={
                    "text-center transition-opacity duration-300 " +
                    (!isFailed
                      ? "opacity-100"
                      : "opacity-0 pointer-events-none")
                  }
                  aria-hidden={isFailed}
                >
                  {currentMessage ? (
                    <p className="text-xs text-muted-foreground">
                      {currentMessage}
                    </p>
                  ) : isPending && estimatedWaitMin > 0 ? (
                    <div className="text-xs text-muted-foreground">
                      Estimated wait: ~{estimatedWaitMin} minutes
                    </div>
                  ) : (
                    <div className="h-4" />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
