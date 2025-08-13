import {
  AlertCircle,
  Clock,
  Cpu,
  RotateCcw,
  Zap,
  CheckCircle2,
  Circle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="relative rounded-2xl overflow-hidden bg-card border border-border shadow-lg">
        {/* Fixed Aspect Ratio Container */}
        <div className="relative aspect-square bg-gradient-to-br from-background via-muted/5 to-background">
          {/* Animated Background Layers */}
          <div className="absolute inset-0">
            {/* Gradient Orbs */}
            <div className="absolute top-1/4 left-1/4 w-48 h-48 bg-primary/10 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl animate-pulse animation-delay-1000" />

            {/* Grid Pattern Overlay */}
            <div
              className="absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage: `linear-gradient(0deg, hsl(var(--border)) 1px, transparent 1px),
                                  linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)`,
                backgroundSize: "30px 30px",
              }}
            />
          </div>

          {/* Central Status Indicator */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative">
              {/* Progress Ring Container */}
              <div className="relative w-40 h-40">
                {/* Background Ring */}
                <svg className="absolute inset-0 w-40 h-40 -rotate-90">
                  <circle
                    cx="80"
                    cy="80"
                    r="72"
                    stroke="currentColor"
                    strokeWidth="3"
                    fill="none"
                    className="text-border/50"
                  />
                  {/* Progress Ring */}
                  <circle
                    cx="80"
                    cy="80"
                    r="72"
                    stroke="url(#progressGradient)"
                    strokeWidth="3"
                    fill="none"
                    strokeDasharray={`${progressPercentage * 4.52} 452`}
                    strokeLinecap="round"
                    className="transition-all duration-700 ease-out"
                    style={{
                      filter:
                        progressPercentage > 0
                          ? "drop-shadow(0 0 6px rgb(var(--primary) / 0.5))"
                          : "none",
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

                {/* Central Icon */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative w-28 h-28 bg-gradient-to-br from-card to-card/80 backdrop-blur-sm rounded-full flex items-center justify-center border border-border/50 shadow-2xl">
                    {error ? (
                      <AlertCircle className="h-12 w-12 text-destructive" />
                    ) : isQueued ? (
                      <Clock className="h-12 w-12 text-muted-foreground" />
                    ) : isRetrying ? (
                      <RotateCcw className="h-12 w-12 text-amber-500 animate-spin" />
                    ) : isProcessing ? (
                      <div className="relative">
                        <Zap className="h-12 w-12 text-primary" />
                        <div className="absolute inset-0 animate-ping">
                          <Zap className="h-12 w-12 text-primary opacity-30" />
                        </div>
                      </div>
                    ) : (
                      <CheckCircle2 className="h-12 w-12 text-green-500" />
                    )}
                  </div>
                </div>

                {/* Percentage Display */}
                {isProcessing && progressPercentage > 0 && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="mt-20 bg-background/90 backdrop-blur-sm px-3 py-1 rounded-full border border-border/50">
                      <span className="text-sm font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                        {progressPercentage}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Fixed Height Bottom Content Area */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/98 to-transparent">
            <div className="p-6 space-y-4" style={{ minHeight: "280px" }}>
              {/* Status Header - Fixed Height */}
              <div className="h-16 flex flex-col justify-center text-center">
                <h3 className="text-lg font-semibold text-foreground">
                  {error
                    ? "Generation Failed"
                    : isQueued
                    ? "Queued for Generation"
                    : isRetrying
                    ? "Retrying Generation"
                    : isProcessing
                    ? "Creating Your Masterpiece"
                    : "Complete"}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {error
                    ? "Please try again"
                    : isQueued && queueStatus?.queuePosition
                    ? `Position #${queueStatus.queuePosition} in queue`
                    : isRetrying
                    ? `Attempt ${retryCount}/3`
                    : isProcessing
                    ? "AI is working its magic..."
                    : "Your image is ready"}
                </p>
              </div>

              {/* Node/Workflow Display - Fixed Height Container */}
              <div className="h-20">
                {currentNode ? (
                  <div className="bg-gradient-to-r from-primary/5 to-purple-600/5 border border-primary/20 rounded-xl p-3 backdrop-blur-sm">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5">
                        <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                        <span className="text-xs font-medium text-primary">
                          Processing
                        </span>
                      </div>
                      {nodeState && (
                        <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full capitalize">
                          {nodeState}
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-medium text-foreground mt-1.5 truncate">
                      {currentNode}
                    </div>
                  </div>
                ) : workflowNodes.length > 0 && isProcessing ? (
                  <div className="bg-muted/5 border border-muted/10 rounded-xl p-3 backdrop-blur-sm">
                    <div className="text-xs font-medium text-muted-foreground mb-2">
                      Workflow Pipeline
                    </div>
                    <div className="flex items-center gap-1">
                      {workflowNodes.map((node, index) => (
                        <div
                          key={node.nodeId}
                          className="flex-1 flex items-center"
                        >
                          <div
                            className={cn(
                              "flex-1 h-1.5 rounded-full transition-all duration-500",
                              index < currentNodeIndex
                                ? "bg-green-500"
                                : index === currentNodeIndex
                                ? "bg-primary animate-pulse"
                                : "bg-muted/30"
                            )}
                            title={node.nodeTitle}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="text-xs text-muted-foreground mt-2">
                      Step{" "}
                      {Math.min(currentNodeIndex + 1, workflowNodes.length)} of{" "}
                      {workflowNodes.length}
                    </div>
                  </div>
                ) : error ? (
                  <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-3 backdrop-blur-sm">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-destructive/90 line-clamp-3">
                        {error}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Progress Bar Section - Always Visible */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-muted-foreground">
                    Overall Progress
                  </span>
                  <div className="flex items-center gap-2">
                    {progressPercentage > 0 && (
                      <span className="text-xs font-bold text-foreground">
                        {progressPercentage}%
                      </span>
                    )}
                    {queueStatus?.estimatedWaitTime > 0 && isQueued && (
                      <span className="text-xs text-muted-foreground">
                        ~{Math.round(queueStatus.estimatedWaitTime / 1000 / 60)}{" "}
                        min
                      </span>
                    )}
                  </div>
                </div>
                <div className="relative w-full h-1.5 bg-muted/30 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out",
                      error
                        ? "bg-destructive"
                        : "bg-gradient-to-r from-primary to-purple-600"
                    )}
                    style={{
                      width: `${progressPercentage}%`,
                      boxShadow:
                        progressPercentage > 0
                          ? "0 0 10px rgb(var(--primary) / 0.5)"
                          : "none",
                    }}
                  />
                  {/* Shimmer effect for active progress */}
                  {isProcessing &&
                    progressPercentage > 0 &&
                    progressPercentage < 100 && (
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
                    )}
                </div>
              </div>

              {/* Message Display - Fixed Height */}
              <div className="h-5 flex items-center justify-center">
                {currentMessage && (
                  <p className="text-xs text-muted-foreground text-center animate-fade-in">
                    {currentMessage}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
