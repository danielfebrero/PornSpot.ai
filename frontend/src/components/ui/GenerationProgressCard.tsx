import { AlertCircle, Clock, Cpu, RotateCcw, Zap } from "lucide-react";

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
}) {
  return (
    <div className="w-full max-w-md mx-auto">
      <div className="relative rounded-2xl overflow-hidden bg-card border border-border shadow-lg">
        {/* Aspect Ratio Container matching ContentCard */}
        <div className="relative aspect-square bg-gradient-to-br from-muted/50 to-muted/30">
          {/* Animated Background Effect */}
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-gradient-to-t from-primary/10 via-transparent to-transparent animate-pulse" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative">
                {/* Central Icon with Animation */}
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/20 rounded-full blur-3xl animate-pulse" />
                  <div className="relative w-32 h-32 bg-gradient-to-br from-primary/20 to-purple-600/20 backdrop-blur-sm rounded-full flex items-center justify-center border border-primary/30">
                    {queueStatus?.status === "pending" ? (
                      <Clock className="h-16 w-16 text-primary animate-pulse" />
                    ) : isRetrying ? (
                      <RotateCcw className="h-16 w-16 text-amber-500 animate-spin" />
                    ) : (
                      <Zap className="h-16 w-16 text-primary animate-pulse" />
                    )}
                  </div>
                </div>

                {/* Progress Ring */}
                {progress > 0 && maxProgress > 0 && (
                  <svg
                    className="absolute inset-0 w-32 h-32 -rotate-90"
                    viewBox="0 0 128 128"
                  >
                    <circle
                      cx="64"
                      cy="64"
                      r="60"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="none"
                      className="text-border"
                    />
                    <circle
                      cx="64"
                      cy="64"
                      r="60"
                      stroke="url(#progressGradient)"
                      strokeWidth="8"
                      fill="none"
                      strokeDasharray={`${(progress / maxProgress) * 377} 377`}
                      strokeLinecap="round"
                      className="transition-all duration-500 ease-out"
                    />
                    <defs>
                      <linearGradient id="progressGradient">
                        <stop offset="0%" stopColor="rgb(var(--primary))" />
                        <stop offset="100%" stopColor="rgb(147, 51, 234)" />
                      </linearGradient>
                    </defs>
                  </svg>
                )}
              </div>
            </div>
          </div>

          {/* Status Content Overlay */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/95 to-transparent p-6">
            <div className="space-y-4">
              {/* Status Header */}
              {queueStatus && (
                <div className="text-center space-y-2">
                  {queueStatus.status === "pending" && (
                    <>
                      <h3 className="text-lg font-semibold text-foreground">
                        Queued for Generation
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Position #{queueStatus.queuePosition} in queue
                      </p>
                    </>
                  )}

                  {queueStatus.status === "processing" && (
                    <>
                      <h3 className="text-lg font-semibold text-foreground">
                        {isRetrying
                          ? "Retrying Generation"
                          : "Creating Your Masterpiece"}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {isRetrying
                          ? `Attempt ${retryCount}/3 - AI is working its magic...`
                          : "AI is working its magic..."}
                      </p>
                    </>
                  )}
                </div>
              )}

              {/* Current Node Display */}
              {currentNode && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Cpu className="w-3 h-3 text-primary animate-pulse" />
                    <span className="text-xs font-medium text-primary">
                      Processing Node
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-foreground">
                    {currentNode}
                  </div>
                  {nodeState && (
                    <div className="text-xs text-muted-foreground capitalize mt-1">
                      State: {nodeState}
                    </div>
                  )}
                </div>
              )}

              {/* Progress Bar */}
              {progress > 0 && maxProgress > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="text-foreground font-medium">
                      {Math.round((progress / maxProgress) * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-primary to-purple-600 h-2 rounded-full transition-all duration-500 ease-out"
                      style={{
                        width: `${(progress / maxProgress) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Current Message */}
              {currentMessage && (
                <p className="text-xs text-muted-foreground text-center">
                  {currentMessage}
                </p>
              )}

              {/* Estimated Wait Time */}
              {queueStatus?.status === "pending" &&
                queueStatus.estimatedWaitTime > 0 && (
                  <div className="text-xs text-muted-foreground text-center">
                    Estimated wait: ~
                    {Math.round(queueStatus.estimatedWaitTime / 1000 / 60)}{" "}
                    minutes
                  </div>
                )}

              {/* Error Display */}
              {error && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <div className="flex items-center gap-2 text-destructive mb-1">
                    <AlertCircle className="h-3 w-3" />
                    <span className="text-xs font-medium">
                      Generation Failed
                    </span>
                  </div>
                  <p className="text-xs text-destructive/80">{error}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
