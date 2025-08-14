import {
  AlertCircle,
  Clock,
  Cpu,
  RotateCcw,
  Zap,
  CheckCircle2,
  Loader2,
  Sparkles,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  queueStatus: any;
  progress: number;
  maxProgress: number;
  currentMessage: string;
  currentNode: string;
  nodeState: string;
  retryCount: number;
  isRetrying: boolean;
  error: string | null;
  workflowNodes: Array<{
    nodeId: string;
    classType: string;
    nodeTitle: string;
    dependencies: string[];
  }>;
  currentNodeIndex: number;
}) {
  const progressPercentage =
    progress > 0 && maxProgress > 0
      ? Math.round((progress / maxProgress) * 100)
      : 0;

  const isQueued =
    queueStatus?.status === "pending" &&
    !currentNode &&
    progressPercentage === 0;
  const isProcessing =
    queueStatus?.status === "processing" ||
    currentNode ||
    progressPercentage > 0;
  const isComplete = progressPercentage === 100 && !isProcessing && !error;
  const hasWorkflow = workflowNodes.length > 0;

  // Determine title and subtitle based on state
  const getStatusText = () => {
    if (error)
      return { title: "Generation Failed", subtitle: "Please try again" };
    if (isQueued)
      return {
        title: "Queued for Generation",
        subtitle: "Waiting to start",
      };
    if (isRetrying)
      return {
        title: "Retrying Generation",
        subtitle: `Attempt ${retryCount}/3 - AI is working...`,
      };
    if (isComplete)
      return {
        title: "Generation Complete",
        subtitle: "Your image is ready",
      };
    if (isProcessing)
      return {
        title: "Creating Your Masterpiece",
        subtitle: "AI is working its magic...",
      };
    return { title: "Ready to Generate", subtitle: "Start when you're ready" };
  };

  const { title, subtitle } = getStatusText();

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="relative rounded-2xl overflow-hidden bg-card border border-border shadow-lg">
        {/* Fixed Aspect Ratio Container */}
        <div className="relative aspect-square flex flex-col">
          {/* Header Section - Fixed at Top */}
          <div className="relative z-10 bg-gradient-to-b from-background via-background/95 to-transparent px-6 pt-6 pb-4">
            <div className="text-center space-y-1">
              <h3 className="text-lg font-semibold text-foreground">{title}</h3>
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            </div>
          </div>

          {/* Central Visual Area - Never Overlapped */}
          <div className="flex-1 relative flex items-center justify-center px-6">
            {/* Background Effects */}
            <div className="absolute inset-0 pointer-events-none">
              {/* Animated gradient orbs */}
              <div className="absolute top-1/3 left-1/3 w-32 h-32 bg-primary/10 rounded-full blur-3xl animate-pulse" />
              <div className="absolute bottom-1/3 right-1/3 w-40 h-40 bg-purple-600/10 rounded-full blur-3xl animate-pulse animation-delay-1000" />

              {/* Active shimmer effect */}
              {(isProcessing || isRetrying) && !error && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent animate-shimmer" />
              )}
            </div>

            {/* Central Icon with Progress Ring */}
            <div className="relative">
              {/* Progress Ring */}
              <svg className="absolute inset-0 w-32 h-32 -rotate-90">
                {/* Background circle */}
                <circle
                  cx="64"
                  cy="64"
                  r="58"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                  className="text-border/30"
                />
                {/* Progress circle */}
                <circle
                  cx="64"
                  cy="64"
                  r="58"
                  stroke="url(#progressGradient)"
                  strokeWidth="3"
                  fill="none"
                  strokeDasharray={`${progressPercentage * 3.64} 364`}
                  strokeLinecap="round"
                  className="transition-all duration-700 ease-out"
                  style={{
                    filter:
                      progressPercentage > 0
                        ? "drop-shadow(0 0 8px rgb(var(--primary) / 0.4))"
                        : "none",
                    opacity: progressPercentage > 0 ? 1 : 0,
                  }}
                />
                <defs>
                  <linearGradient
                    id="progressGradient"
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="100%"
                  >
                    <stop offset="0%" stopColor="hsl(var(--primary))" />
                    <stop offset="100%" stopColor="rgb(147, 51, 234)" />
                  </linearGradient>
                </defs>
              </svg>

              {/* Icon Container */}
              <div className="relative w-32 h-32 bg-gradient-to-br from-card/80 to-card/60 backdrop-blur-sm rounded-full flex items-center justify-center border border-border/50 shadow-xl">
                {error ? (
                  <AlertCircle className="h-14 w-14 text-destructive" />
                ) : isComplete ? (
                  <CheckCircle2 className="h-14 w-14 text-green-500" />
                ) : isQueued ? (
                  <Clock className="h-14 w-14 text-muted-foreground" />
                ) : isRetrying ? (
                  <RotateCcw className="h-14 w-14 text-amber-500 animate-spin" />
                ) : isProcessing ? (
                  <div className="relative">
                    <Sparkles className="h-14 w-14 text-primary" />
                    <div className="absolute inset-0 animate-ping">
                      <Sparkles className="h-14 w-14 text-primary opacity-30" />
                    </div>
                  </div>
                ) : (
                  <Zap className="h-14 w-14 text-muted-foreground" />
                )}
              </div>

              {/* Percentage Badge */}
              {progressPercentage > 0 && !isComplete && (
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
                  <div className="bg-background/90 backdrop-blur-sm px-3 py-1 rounded-full border border-border/50 shadow-lg">
                    <span className="text-sm font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                      {progressPercentage}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Information Section - Fixed Height */}
          <div className="relative z-10 bg-gradient-to-t from-background via-background/98 to-transparent px-6 pb-6 pt-2">
            <div className="space-y-3" style={{ minHeight: "180px" }}>
              {/* Progress Bar - Always Present */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-muted-foreground">
                    Overall Progress
                  </span>
                  <div className="flex items-center gap-3">
                    {progressPercentage > 0 && (
                      <span className="text-xs font-semibold text-foreground">
                        {progressPercentage}%
                      </span>
                    )}
                    {isQueued && queueStatus?.estimatedWaitTime > 0 && (
                      <span className="text-xs text-muted-foreground">
                        ~{Math.round(queueStatus.estimatedWaitTime / 1000 / 60)}{" "}
                        min
                      </span>
                    )}
                  </div>
                </div>
                <div className="relative w-full h-1.5 bg-muted/20 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out",
                      error
                        ? "bg-destructive"
                        : isComplete
                        ? "bg-green-500"
                        : "bg-gradient-to-r from-primary to-purple-600"
                    )}
                    style={{
                      width: `${progressPercentage}%`,
                      boxShadow:
                        progressPercentage > 0 && !error
                          ? "0 0 8px rgb(var(--primary) / 0.3)"
                          : "none",
                    }}
                  />
                  {/* Shimmer effect */}
                  {isProcessing &&
                    progressPercentage > 0 &&
                    progressPercentage < 100 && (
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
                    )}
                </div>
              </div>

              {/* Dynamic Content Area - Fixed Height Containers */}
              <div className="space-y-2.5" style={{ minHeight: "120px" }}>
                {/* Current Node Info - Always Shows */}
                <div
                  className={cn(
                    "rounded-xl p-3 backdrop-blur-sm",
                    error
                      ? "bg-gradient-to-r from-destructive/5 to-destructive/10 border border-destructive/20"
                      : currentNode
                      ? "bg-gradient-to-r from-primary/5 to-purple-600/5 border border-primary/20"
                      : "bg-muted/10 border border-muted/20"
                  )}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      {error ? (
                        <AlertCircle className="w-3.5 h-3.5 text-destructive" />
                      ) : currentNode ? (
                        <Activity className="w-3.5 h-3.5 text-primary animate-pulse" />
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                      <span
                        className={cn(
                          "text-xs font-medium",
                          error
                            ? "text-destructive"
                            : currentNode
                            ? "text-primary"
                            : "text-muted-foreground"
                        )}
                      >
                        {error
                          ? "Failed"
                          : currentNode
                          ? "Processing"
                          : "Waiting"}
                      </span>
                    </div>
                    {nodeState && !error && (
                      <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full capitalize">
                        {nodeState}
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-medium text-foreground truncate">
                    {error
                      ? "Generation stopped due to error"
                      : currentNode
                      ? currentNode
                      : isQueued
                      ? "Waiting in queue to start..."
                      : isComplete
                      ? "All nodes completed successfully"
                      : "Ready to begin processing"}
                  </div>
                </div>

                {/* Workflow Progress - Always Shows */}
                <div className="bg-muted/10 border border-muted/20 rounded-xl p-3 backdrop-blur-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      Workflow Progress
                    </span>
                    <span className="text-xs font-semibold text-foreground">
                      {hasWorkflow ? (
                        <>
                          Step{" "}
                          {error
                            ? currentNodeIndex + 1
                            : Math.min(
                                currentNodeIndex + 1,
                                workflowNodes.length
                              )}{" "}
                          of {workflowNodes.length}
                        </>
                      ) : (
                        "Initializing..."
                      )}
                    </span>
                  </div>

                  {hasWorkflow ? (
                    <div className="flex items-center gap-0.5">
                      {workflowNodes.map((node, index) => (
                        <div
                          key={node.nodeId}
                          className="flex-1 h-1 first:rounded-l-full last:rounded-r-full overflow-hidden"
                          title={node.nodeTitle}
                        >
                          <div
                            className={cn(
                              "h-full transition-all duration-500",
                              error && index >= currentNodeIndex
                                ? "bg-destructive/60"
                                : error && index < currentNodeIndex
                                ? "bg-destructive"
                                : index < currentNodeIndex
                                ? "bg-green-500"
                                : index === currentNodeIndex
                                ? "bg-primary animate-pulse"
                                : "bg-muted/30"
                            )}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-0.5">
                      {/* Show placeholder bars when no workflow data */}
                      {Array.from({ length: error ? 1 : 3 }).map((_, index) => (
                        <div
                          key={index}
                          className="flex-1 h-1 first:rounded-l-full last:rounded-r-full overflow-hidden"
                        >
                          <div
                            className={cn(
                              "h-full transition-all duration-500",
                              error
                                ? "bg-destructive animate-pulse"
                                : isQueued
                                ? "bg-muted/30"
                                : isProcessing
                                ? "bg-primary/50 animate-pulse"
                                : "bg-muted/30"
                            )}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Error Message */}
                {error && (
                  <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-3 backdrop-blur-sm">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-destructive/90 line-clamp-2">
                        {error}
                      </p>
                    </div>
                  </div>
                )}

                {/* Current Message */}
                {/* {currentMessage && !error && (
                  <div className="flex items-center justify-center py-2">
                    <p className="text-xs text-muted-foreground text-center animate-fade-in">
                      {currentMessage}
                    </p>
                  </div>
                )} */}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
