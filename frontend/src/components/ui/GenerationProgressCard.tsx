import {
  AlertCircle,
  Clock,
  Cpu,
  RotateCcw,
  Zap,
  ArrowRight,
  Sparkles,
} from "lucide-react";

// Custom Generation Progress Card Component
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
  // Determine current status for consistent layout
  const isQueued =
    queueStatus?.status === "pending" &&
    !currentNode &&
    (progress === 0 || maxProgress === 0);
  const isProcessing =
    queueStatus?.status === "processing" ||
    currentNode ||
    (progress > 0 && maxProgress > 0);
  const hasWorkflow = workflowNodes.length > 0;
  const progressPercentage =
    progress > 0 && maxProgress > 0
      ? Math.round((progress / maxProgress) * 100)
      : 0;

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="relative rounded-xl overflow-hidden bg-card border border-border shadow-lg transition-all duration-300">
        {/* Fixed aspect ratio container to prevent layout shift */}
        <div className="relative aspect-square">
          {/* Background with subtle gradient and shimmer effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-muted/20 via-background to-muted/30">
            <div className="absolute inset-0 bg-gradient-to-t from-primary/5 via-transparent to-transparent" />
            {/* Subtle shimmer effect for active states */}
            {(isProcessing || isRetrying) && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent animate-shimmer" />
            )}
          </div>

          {/* Center content area with fixed dimensions */}
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6">
            {/* Fixed size central icon area */}
            <div className="relative mb-6">
              {/* Glowing background effect */}
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl scale-110 animate-pulse" />

              {/* Main icon container with consistent size */}
              <div className="relative w-24 h-24 bg-gradient-to-br from-primary/10 to-accent/10 backdrop-blur-sm rounded-full flex items-center justify-center border border-primary/20 shadow-lg">
                {error ? (
                  <AlertCircle className="h-10 w-10 text-destructive" />
                ) : isQueued ? (
                  <Clock className="h-10 w-10 text-primary animate-pulse" />
                ) : isRetrying ? (
                  <RotateCcw className="h-10 w-10 text-amber-500 animate-spin" />
                ) : isProcessing ? (
                  <Sparkles className="h-10 w-10 text-primary animate-pulse" />
                ) : (
                  <Zap className="h-10 w-10 text-muted-foreground" />
                )}
              </div>

              {/* Progress ring - always rendered but conditionally visible */}
              <svg
                className={`absolute inset-0 w-24 h-24 -rotate-90 transition-opacity duration-300 ${
                  progressPercentage > 0 ? "opacity-100" : "opacity-0"
                }`}
                viewBox="0 0 96 96"
              >
                <circle
                  cx="48"
                  cy="48"
                  r="44"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                  className="text-border"
                />
                <circle
                  cx="48"
                  cy="48"
                  r="44"
                  stroke="url(#progressGradient)"
                  strokeWidth="4"
                  fill="none"
                  strokeDasharray={`${(progressPercentage / 100) * 276} 276`}
                  strokeLinecap="round"
                  className="transition-all duration-700 ease-out"
                />
                <defs>
                  <linearGradient
                    id="progressGradient"
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="0%"
                  >
                    <stop offset="0%" stopColor="hsl(var(--primary))" />
                    <stop offset="100%" stopColor="hsl(var(--accent))" />
                  </linearGradient>
                </defs>
              </svg>
            </div>

            {/* Fixed height content area to prevent layout shift */}
            <div className="w-full space-y-3 min-h-[200px] flex flex-col">
              {/* Status header with fixed height */}
              <div className="text-center space-y-1 min-h-[60px] flex flex-col justify-center">
                <h3 className="text-lg font-semibold text-foreground leading-tight">
                  {error
                    ? "Generation Failed"
                    : isQueued
                    ? "Queued for Generation"
                    : isRetrying
                    ? "Retrying Generation"
                    : isProcessing
                    ? "Creating Your Masterpiece"
                    : "Ready to Generate"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {error
                    ? "Please try again"
                    : isQueued && queueStatus?.queuePosition
                    ? `Position #${queueStatus.queuePosition} in queue`
                    : isRetrying
                    ? `Attempt ${retryCount}/3 - AI is working...`
                    : isProcessing
                    ? "AI is working its magic..."
                    : "Ready when you are"}
                </p>
              </div>

              {/* Progress bar - always visible with fixed height */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground font-medium">
                    Progress
                  </span>
                  <span className="text-foreground font-semibold">
                    {progressPercentage}%
                  </span>
                </div>
                <div className="w-full bg-muted/60 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-primary to-accent h-2.5 rounded-full transition-all duration-700 ease-out shadow-sm"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
              </div>

              {/* Current node processing info with fixed container */}
              <div className="min-h-[80px] flex flex-col justify-start">
                {currentNode && (
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Cpu className="w-3.5 h-3.5 text-primary animate-pulse" />
                      <span className="text-xs font-medium text-primary">
                        Currently Processing
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-foreground truncate">
                      {currentNode}
                    </div>
                    {nodeState && (
                      <div className="text-xs text-muted-foreground capitalize">
                        State: {nodeState}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Workflow progress indicator with fixed container */}
              {hasWorkflow && (
                <div className="min-h-[60px] flex flex-col justify-start">
                  <div className="bg-muted/30 border border-muted/40 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        <span className="font-medium text-muted-foreground">
                          Workflow Progress
                        </span>
                      </div>
                      <span className="text-foreground font-semibold">
                        {currentNodeIndex + 1} of {workflowNodes.length}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 overflow-hidden">
                      {workflowNodes.slice(0, 8).map((node, index) => (
                        <div
                          key={node.nodeId}
                          className="flex items-center flex-shrink-0"
                        >
                          <div
                            className={`w-2 h-2 rounded-full transition-all duration-300 ${
                              index < currentNodeIndex
                                ? "bg-green-500 shadow-sm"
                                : index === currentNodeIndex
                                ? "bg-primary animate-pulse shadow-sm"
                                : "bg-muted"
                            }`}
                            title={node.nodeTitle}
                          />
                          {index < Math.min(workflowNodes.length - 1, 7) && (
                            <ArrowRight className="w-1.5 h-1.5 text-muted-foreground mx-0.5 flex-shrink-0" />
                          )}
                        </div>
                      ))}
                      {workflowNodes.length > 8 && (
                        <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                          +{workflowNodes.length - 8}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Messages and wait time with fixed container */}
              <div className="min-h-[40px] flex flex-col justify-center space-y-2">
                {currentMessage && (
                  <p className="text-xs text-muted-foreground text-center leading-relaxed">
                    {currentMessage}
                  </p>
                )}

                {isQueued && queueStatus?.estimatedWaitTime > 0 && (
                  <div className="text-xs text-muted-foreground text-center">
                    Estimated wait: ~
                    {Math.round(queueStatus.estimatedWaitTime / 1000 / 60)} min
                  </div>
                )}
              </div>

              {/* Error display with fixed container */}
              {error && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-destructive mb-1">
                    <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="text-xs font-medium">
                      Generation Failed
                    </span>
                  </div>
                  <p className="text-xs text-destructive/80 leading-relaxed">
                    {error}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
