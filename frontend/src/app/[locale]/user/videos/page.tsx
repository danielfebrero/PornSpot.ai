"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { useDocumentHeadAndMeta } from "@/hooks/useDocumentHeadAndMeta";
import {
  Video as VideoIcon,
  Grid,
  List,
  Plus,
  MoreVertical,
  Download,
  Trash2,
  X,
  Loader2,
  Globe,
  Lock,
  Edit,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { VirtualizedGrid } from "@/components/ui/VirtualizedGrid";
import { EditTitleDialog } from "@/components/ui/EditTitleDialog";
import { ShareDropdown } from "@/components/ui/ShareDropdown";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AddToAlbumDialog } from "@/components/user/AddToAlbumDialog";
import {
  useUserMedia,
  useUpdateMedia,
  useBulkDeleteMedia,
  useDownloadMediaZip,
} from "@/hooks/queries/useMediaQuery";
import { usePrefetchInteractionStatus } from "@/hooks/queries/useInteractionsQuery";
import { Media, UnifiedMediaResponse } from "@/types";
import { useUserContext } from "@/contexts/UserContext";
import { useDevice } from "@/contexts/DeviceContext";
import { isMediaOwner } from "@/lib/userUtils";
import {
  useGetIncompleteI2VJobs,
  useGetFailedI2VJobs,
  usePollI2VJob,
  useClearI2VJob,
} from "@/hooks/queries/useGenerationQuery";
import ResponsivePicture from "@/components/ui/ResponsivePicture";
import { composeMediaUrl, composeThumbnailUrls } from "@/lib/urlUtils";

type PollReason = "after10s" | "after30s" | "afterEstimate" | "apiDelay";
type PollCallback = (reason: PollReason) => void;
type TimeoutHandle = ReturnType<typeof setTimeout>;

const UserVideosPage: React.FC = () => {
  const t = useTranslations("user.videosPage");
  useDocumentHeadAndMeta(t("meta.title"), t("meta.description"));

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [editingMedia, setEditingMedia] = useState<Media | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedMedias, setSelectedMedias] = useState<Set<string>>(new Set());
  const [showAddToAlbumDialog, setShowAddToAlbumDialog] = useState(false);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const [showPublicStatus, setShowPublicStatus] = useState(false);
  const [mobileExpandedAction, setMobileExpandedAction] = useState<
    string | null
  >(null);
  const [clearingJobId, setClearingJobId] = useState<string | null>(null);
  const MAX_BULK_SELECTION = 50;
  const { user } = useUserContext();
  const { isMobile } = useDevice();

  const updateMedia = useUpdateMedia();
  const bulkDeleteMedia = useBulkDeleteMedia();
  const downloadMediaZip = useDownloadMediaZip();

  const {
    data: mediaData,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useUserMedia({ type: "video" });
  const { prefetch } = usePrefetchInteractionStatus();
  const { data: incompleteJobs } = useGetIncompleteI2VJobs();
  const { data: failedJobs, isFetching: isFetchingFailed } =
    useGetFailedI2VJobs();
  const clearI2VJob = useClearI2VJob();

  const handleConfirmTitleEdit = useCallback(
    async (newTitle: string) => {
      if (!editingMedia) return;
      try {
        await updateMedia.mutateAsync({
          mediaId: editingMedia.id,
          updates: { title: newTitle },
        });
        setEditingMedia(null);
      } catch (error) {
        console.error("Failed to update media title:", error);
      }
    },
    [editingMedia, updateMedia]
  );

  const allMedias = useMemo(() => {
    return (
      mediaData?.pages.flatMap(
        (page: UnifiedMediaResponse) => page.media || []
      ) || []
    );
  }, [mediaData]);

  const medias = useMemo(() => {
    return allMedias.filter((media: Media) => media && media.id);
  }, [allMedias]);

  const totalCount = medias.length;

  const getCustomActions = useMemo(() => {
    return (media: Media) => {
      const isOwner = isMediaOwner(user, media.createdBy);
      if (!isOwner) return [];
      return [
        {
          label: media.isPublic ? "Make Private" : "Make Public",
          icon: media.isPublic ? (
            <Lock className="w-4 h-4" />
          ) : (
            <Globe className="w-4 h-4" />
          ),
          onClick: async () => {
            try {
              await updateMedia.mutateAsync({
                mediaId: media.id,
                updates: { isPublic: !media.isPublic },
              });
            } catch (error) {
              console.error("Failed to toggle media visibility:", error);
            }
          },
          variant: "default" as const,
        },
        {
          label: "Edit Title",
          icon: <Edit className="w-4 h-4" />,
          onClick: () => setEditingMedia(media),
          variant: "default" as const,
        },
      ];
    };
  }, [user, updateMedia]);

  const handleSelectMany = useCallback(() => setIsSelecting(true), []);
  const handleCancelSelection = useCallback(() => {
    setIsSelecting(false);
    setSelectedMedias(new Set());
    setMobileExpandedAction(null);
  }, []);
  const handleToggleSelection = useCallback((mediaId: string) => {
    setSelectedMedias((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(mediaId)) newSet.delete(mediaId);
      else if (newSet.size < MAX_BULK_SELECTION) newSet.add(mediaId);
      return newSet;
    });
  }, []);
  const handleMobileActionTap = useCallback(
    (actionId: string, action: () => void) => {
      if (mobileExpandedAction === actionId) {
        action();
        setMobileExpandedAction(null);
      } else {
        setMobileExpandedAction(actionId);
      }
    },
    [mobileExpandedAction]
  );
  const handleAddToAlbum = useCallback(() => {
    if (selectedMedias.size > 0) setShowAddToAlbumDialog(true);
  }, [selectedMedias]);
  const selectedMediaObjects = useMemo(
    () => medias.filter((media) => selectedMedias.has(media.id)),
    [medias, selectedMedias]
  );
  const handleCloseAddToAlbumDialog = useCallback(
    () => setShowAddToAlbumDialog(false),
    []
  );
  const handleDownload = useCallback(async () => {
    if (selectedMedias.size === 0) return;
    try {
      const mediaIds = Array.from(selectedMedias);
      await downloadMediaZip.mutateAsync(mediaIds);
      setSelectedMedias(new Set());
      setIsSelecting(false);
    } catch (error) {
      console.error("Failed to download media zip:", error);
    }
  }, [selectedMedias, downloadMediaZip]);
  const handleDelete = useCallback(() => {
    if (selectedMedias.size > 0) setShowDeleteConfirmDialog(true);
  }, [selectedMedias]);
  const handleConfirmDelete = useCallback(async () => {
    if (selectedMedias.size === 0) return;
    try {
      const mediaIds = Array.from(selectedMedias);
      setIsSelecting(false);
      setShowDeleteConfirmDialog(false);
      bulkDeleteMedia.mutateAsync(mediaIds);
      setSelectedMedias(new Set());
    } catch (error) {
      console.error("Failed to delete media:", error);
    }
  }, [selectedMedias, bulkDeleteMedia]);

  const handleClearJob = useCallback(
    async (jobId: string) => {
      if (!jobId) return;
      setClearingJobId(jobId);
      try {
        await clearI2VJob.mutateAsync(jobId);
      } catch (error) {
        console.error("Failed to clear I2V job:", error, { jobId });
      } finally {
        setClearingJobId((current) => (current === jobId ? null : current));
      }
    },
    [clearI2VJob]
  );

  const loadMore = () => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  };

  useEffect(() => {
    if (medias.length > 0) {
      const targets = medias.map((media) => ({
        targetType: media.type,
        targetId: media.id,
      }));
      prefetch(targets).catch((error) =>
        console.error(
          "Failed to prefetch user media interaction status:",
          error
        )
      );
    }
  }, [medias, prefetch]);

  // Temporary gate: Only admins can access this page content until Oct 1st
  if (user && user.planInfo.plan !== "pro") {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-center px-4">
        <h1 className="text-2xl font-bold text-foreground">
          {t("comingSoon")}
        </h1>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="bg-card/80 backdrop-blur-sm rounded-xl shadow-lg border border-admin-primary/10 p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-muted/50 rounded w-1/3 mb-4"></div>
            <div className="h-4 bg-muted/50 rounded w-1/2"></div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="bg-card/80 backdrop-blur-sm rounded-xl shadow-lg border border-admin-primary/10 overflow-hidden">
                <div className="aspect-video bg-muted/50"></div>
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-muted/50 rounded w-3/4"></div>
                  <div className="h-3 bg-muted/50 rounded w-1/2"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Child component to leverage hooks per job
  const I2VJobProgressCard: React.FC<{ job: any }> = ({ job }) => {
    // Ticking state to re-render and advance progress smoothly without reload
    const [now, setNow] = useState<number>(() => Date.now());

    const { refetch: refetchJobStatus } = usePollI2VJob(job.jobId);
    const pollFnRef = useRef<PollCallback | null>(null);
    const timersRef = useRef<TimeoutHandle[]>([]);
    const apiDelayTimerRef = useRef<TimeoutHandle | null>(null);
    const lastScheduleKeyRef = useRef<string | null>(null);

    useEffect(() => {
      // Update every second while this card is mounted
      const interval = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(interval);
    }, []);

    const clearAllTimers = useCallback(() => {
      timersRef.current.forEach((timeout) => clearTimeout(timeout));
      timersRef.current = [];
      if (apiDelayTimerRef.current) {
        clearTimeout(apiDelayTimerRef.current);
        apiDelayTimerRef.current = null;
      }
    }, []);

    const performPoll = useCallback(
      (reason: PollReason) => {
        if (!job.jobId) return;
        refetchJobStatus()
          .then((result) => {
            const data = result.data as any;
            const status = data?.status;
            if (
              status === "COMPLETED" ||
              status === "FAILED" ||
              status === "CANCELLED"
            ) {
              clearAllTimers();
              return;
            }

            const delayTime =
              typeof data?.delayTime === "number" ? data.delayTime : undefined;
            if (delayTime && delayTime > 0) {
              if (apiDelayTimerRef.current) {
                clearTimeout(apiDelayTimerRef.current);
              }
              apiDelayTimerRef.current = setTimeout(() => {
                apiDelayTimerRef.current = null;
                pollFnRef.current?.("apiDelay");
              }, delayTime * 1000);
            }
          })
          .catch((error) => {
            console.error("Failed to poll I2V job:", error, {
              jobId: job.jobId,
              reason,
            });
          });
      },
      [job.jobId, refetchJobStatus, clearAllTimers]
    );

    useEffect(() => {
      pollFnRef.current = performPoll;
    }, [performPoll]);

    const schedulePoll = useCallback((delayMs: number, reason: PollReason) => {
      if (!pollFnRef.current) return;
      if (delayMs <= 0) {
        pollFnRef.current(reason);
        return;
      }
      const timeout = setTimeout(() => {
        timersRef.current = timersRef.current.filter((t) => t !== timeout);
        pollFnRef.current?.(reason);
      }, delayMs);
      timersRef.current.push(timeout);
    }, []);

    useEffect(() => {
      return () => {
        lastScheduleKeyRef.current = null;
        clearAllTimers();
      };
    }, [clearAllTimers]);

    const scheduleKey = useMemo(() => {
      const submittedKey = job.submittedAt ? Date.parse(job.submittedAt) : 0;
      const estimateKey = job.estimatedCompletionTimeAt
        ? Date.parse(job.estimatedCompletionTimeAt)
        : 0;
      const estimatedSecondsKey = job.estimatedSeconds ?? 0;
      return `${job.jobId}-${submittedKey}-${estimateKey}-${estimatedSecondsKey}`;
    }, [
      job.jobId,
      job.submittedAt,
      job.estimatedCompletionTimeAt,
      job.estimatedSeconds,
    ]);

    useEffect(() => {
      if (!job.jobId) return;
      if (lastScheduleKeyRef.current === scheduleKey) return;
      lastScheduleKeyRef.current = scheduleKey;

      clearAllTimers();

      const nowTs = Date.now();
      const submittedTs = job.submittedAt ? Date.parse(job.submittedAt) : nowTs;

      const schedules: Array<{ delay: number; reason: PollReason }> = [
        { delay: submittedTs + 10_000 - nowTs, reason: "after10s" },
        { delay: submittedTs + 30_000 - nowTs, reason: "after30s" },
      ];

      const fallbackEstimateMs =
        job.estimatedSeconds && job.estimatedSeconds > 0
          ? job.estimatedSeconds * 1000
          : 60_000;
      const estimatedTarget = job.estimatedCompletionTimeAt
        ? Date.parse(job.estimatedCompletionTimeAt)
        : submittedTs + fallbackEstimateMs;

      if (!Number.isNaN(estimatedTarget)) {
        schedules.push({
          delay: estimatedTarget - nowTs,
          reason: "afterEstimate",
        });
      }

      schedules.forEach(({ delay, reason }) => {
        schedulePoll(delay, reason);
      });
    }, [
      job.jobId,
      job.submittedAt,
      job.estimatedCompletionTimeAt,
      job.estimatedSeconds,
      scheduleKey,
      schedulePoll,
      clearAllTimers,
    ]);

    const submitted = job.submittedAt ? Date.parse(job.submittedAt) : 0;
    const estSeconds = job.estimatedSeconds || 0;
    const elapsed = estSeconds ? (now - submitted) / 1000 : 0;
    let pct = estSeconds ? elapsed / estSeconds : 0;
    if (pct > 0.99) pct = 0.99;
    const pctDisplay = Math.floor(pct * 100);
    const media = job.media;

    return (
      <div className="relative overflow-hidden rounded-xl border border-admin-primary/20 bg-card/80 backdrop-blur-sm shadow-lg group">
        {media?.thumbnailUrl || media?.url ? (
          <div className="aspect-video w-full overflow-hidden">
            <ResponsivePicture
              thumbnailUrls={composeThumbnailUrls(media.thumbnailUrls)}
              fallbackUrl={composeMediaUrl(media.thumbnailUrl || media.url)}
              alt={media.originalFilename || media.filename || "processing"}
              className="w-full h-full object-cover opacity-60 group-hover:opacity-70 transition-opacity"
              loading="lazy"
            />
          </div>
        ) : (
          <div className="aspect-video w-full flex items-center justify-center bg-muted/40">
            <Loader2 className="h-8 w-8 animate-spin text-admin-accent" />
          </div>
        )}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <Loader2 className="h-10 w-10 animate-spin text-admin-accent mb-2" />
          <div className="w-3/4 h-2 rounded-full bg-muted/40 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-admin-accent to-admin-primary transition-all"
              style={{ width: `${pctDisplay}%` }}
            />
          </div>
          <span className="mt-2 text-xs font-medium text-foreground/90">
            {pctDisplay}%
          </span>
        </div>
      </div>
    );
  };

  const renderFailedJobs = () => {
    if (isFetchingFailed && (!failedJobs || failedJobs.length === 0)) {
      return (
        // <div className="space-y-4">
        //   <div className="flex items-center gap-2 text-sm text-muted-foreground">
        //     <Loader2 className="h-4 w-4 animate-spin" />
        //     <span>{t("failedSectionLoading")}</span>
        //   </div>
        // </div>
        null
      );
    }

    if (!failedJobs || failedJobs.length === 0) return null;

    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <h2 className="text-xl font-semibold text-foreground">
              {t("failedSectionTitle")}
            </h2>
          </div>
          <p className="text-sm text-muted-foreground sm:max-w-[60%]">
            {t("failedSectionSubtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {failedJobs.map((job) => {
            const media = (job.media as Media | null) || null;
            const isClearing =
              clearingJobId === job.jobId && clearI2VJob.isPending;
            const clearDisabled =
              clearI2VJob.isPending && clearingJobId !== job.jobId;
            const failedDate =
              job.failedAt && !Number.isNaN(Date.parse(job.failedAt))
                ? new Date(job.failedAt)
                : null;

            return (
              <div
                key={job.jobId}
                className="overflow-hidden rounded-xl border border-destructive/30 bg-card/80 backdrop-blur-sm shadow-lg"
              >
                <div className="aspect-video w-full overflow-hidden bg-destructive/10 flex items-center justify-center">
                  {media?.thumbnailUrls || media?.thumbnailUrl || media?.url ? (
                    <ResponsivePicture
                      thumbnailUrls={composeThumbnailUrls(media?.thumbnailUrls)}
                      fallbackUrl={composeMediaUrl(
                        media?.thumbnailUrl || media?.url
                      )}
                      alt={
                        media?.originalFilename || media?.filename || "failed"
                      }
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <AlertTriangle className="h-10 w-10 text-destructive" />
                  )}
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {t("failedBadge")}
                    </Badge>
                    {failedDate ? (
                      <span className="text-xs text-muted-foreground">
                        {failedDate.toLocaleString()}
                      </span>
                    ) : null}
                  </div>
                  {media?.originalFilename ? (
                    <p className="text-sm font-medium text-foreground line-clamp-2">
                      {media.originalFilename}
                    </p>
                  ) : null}
                  <p className="text-sm text-muted-foreground">
                    {t("failedCardDescription")}
                  </p>
                  <div className="flex items-center justify-between">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 text-destructive border-destructive/40 hover:bg-destructive/10"
                      onClick={() => handleClearJob(job.jobId)}
                      disabled={isClearing || clearDisabled}
                    >
                      {isClearing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      {isClearing ? t("clearingButton") : t("clearButton")}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderIncompleteJobs = () => {
    if (!incompleteJobs || incompleteJobs.length === 0) return null;
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">
          {t("inProgressTitle")}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {incompleteJobs.map((job) => (
            <I2VJobProgressCard key={job.jobId} job={job} />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div
        className={`${
          isSelecting
            ? "sticky top-0 z-50 bg-background/60 backdrop-blur-lg border-border/50 shadow-2xl rounded-none border-x-0 border-t-0 border-b overflow-hidden"
            : "bg-gradient-to-r from-admin-accent/10 to-admin-primary/10 rounded-xl border border-admin-accent/20 shadow-lg"
        } p-6 transition-all duration-300 ${
          isSelecting
            ? "md:min-h-[80px] min-h-[70px]"
            : "md:min-h-[140px] min-h-[120px]"
        }`}
      >
        {isSelecting ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="bg-admin-accent/20 text-admin-accent text-sm font-bold px-3 py-1.5 rounded-lg border border-admin-accent/30 shadow-sm">
                {selectedMedias.size}/{MAX_BULK_SELECTION}
              </div>
              <button
                onClick={() => {
                  if (isMobile)
                    handleMobileActionTap("addToAlbum", handleAddToAlbum);
                  else handleAddToAlbum();
                }}
                className={`group p-3 rounded-lg bg-admin-accent/20 text-admin-accent hover:bg-admin-accent/30 focus:bg-admin-accent/30 focus:outline-none transition-all flex items-center border border-admin-accent/30 shadow-sm overflow-hidden ${
                  mobileExpandedAction === "addToAlbum"
                    ? "bg-admin-accent/30"
                    : ""
                }`}
              >
                <Plus className="h-4 w-4 flex-shrink-0" />
                <span
                  className={`opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-all duration-200 text-sm font-medium whitespace-nowrap ml-0 group-hover:ml-2 group-focus:ml-2 max-w-0 group-hover:max-w-20 group-focus:max-w-20 ${
                    mobileExpandedAction === "addToAlbum"
                      ? "opacity-100 ml-2 max-w-20"
                      : ""
                  }`}
                >
                  {t("album")}
                </span>
              </button>
              <button
                onClick={() => {
                  if (isMobile)
                    handleMobileActionTap("download", handleDownload);
                  else handleDownload();
                }}
                disabled={downloadMediaZip.isPending}
                className={`group p-3 rounded-lg bg-background/80 text-foreground hover:bg-background/90 focus:bg-background/90 focus:outline-none transition-all flex items-center border border-border/50 shadow-sm overflow-hidden ${
                  mobileExpandedAction === "download" ? "bg-background/90" : ""
                } ${
                  downloadMediaZip.isPending
                    ? "opacity-50 cursor-not-allowed"
                    : ""
                }`}
              >
                {downloadMediaZip.isPending ? (
                  <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 flex-shrink-0" />
                )}
                <span
                  className={`opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-all duration-200 text-sm font-medium whitespace-nowrap ml-0 group-hover:ml-2 group-focus:ml-2 max-w-0 group-hover:max-w-24 group-focus:max-w-24 ${
                    mobileExpandedAction === "download"
                      ? "opacity-100 ml-2 max-w-24"
                      : ""
                  }`}
                >
                  {t("download")}
                </span>
              </button>
              <button
                onClick={() => {
                  if (isMobile) handleMobileActionTap("delete", handleDelete);
                  else handleDelete();
                }}
                className={`group p-3 rounded-lg bg-red-500/20 text-red-500 hover:bg-red-500/30 focus:bg-red-500/30 focus:outline-none transition-all flex items-center border border-red-500/30 shadow-sm overflow-hidden ${
                  mobileExpandedAction === "delete" ? "bg-red-500/30" : ""
                }`}
              >
                <Trash2 className="h-4 w-4 flex-shrink-0" />
                <span
                  className={`opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-all duration-200 text-sm font-medium whitespace-nowrap ml-0 group-hover:ml-2 group-focus:ml-2 max-w-0 group-hover:max-w-20 group-focus:max-w-20 ${
                    mobileExpandedAction === "delete"
                      ? "opacity-100 ml-2 max-w-20"
                      : ""
                  }`}
                >
                  {t("delete")}
                </span>
              </button>
            </div>
            <button
              onClick={handleCancelSelection}
              className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors border border-border/50 bg-background/50"
              aria-label="Cancel selection"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <>
            <div className="block sm:hidden space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-admin-accent to-admin-primary rounded-lg flex items-center justify-center">
                    <VideoIcon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">
                      {t("videos")}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                      {t("personalVideoGallery")}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="bg-admin-accent/20 text-admin-accent text-sm font-semibold px-3 py-1.5 rounded-full">
                  {t("videosCount", {
                    count: totalCount,
                    hasNextPage: hasNextPage ? 1 : 0,
                  })}
                </span>
                <div className="flex items-center space-x-2">
                  <ShareDropdown
                    trigger={({ toggle }) => (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={toggle}
                        className="h-10 px-2 bg-gradient-to-r from-admin-accent to-admin-primary hover:from-admin-accent/90 hover:to-admin-primary/90 text-admin-accent-foreground shadow-lg"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    )}
                  >
                    {({ close }) => (
                      <>
                        <button
                          onClick={() => {
                            handleSelectMany();
                            close();
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-accent rounded-md transition-colors"
                        >
                          <span>{t("selectMany")}</span>
                        </button>
                        <button
                          onClick={() => {
                            setShowPublicStatus(!showPublicStatus);
                            close();
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-accent rounded-md transition-colors"
                        >
                          <span>
                            {showPublicStatus
                              ? t("hidePublicStatus")
                              : t("showPublicStatus")}
                          </span>
                        </button>
                      </>
                    )}
                  </ShareDropdown>
                </div>
              </div>
            </div>
            <div className="hidden sm:flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-admin-accent to-admin-primary rounded-lg flex items-center justify-center">
                  <VideoIcon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-foreground">
                    {t("videos")}
                  </h1>
                  <p className="text-muted-foreground">
                    {t("personalVideoGallery")}
                  </p>
                </div>
                <span className="bg-admin-accent/20 text-admin-accent text-sm font-semibold px-3 py-1.5 rounded-full">
                  {t("videosCount", {
                    count: totalCount,
                    hasNextPage: hasNextPage ? 1 : 0,
                  })}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <ShareDropdown
                  trigger={({ toggle }) => (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={toggle}
                      className="h-10 px-2 bg-gradient-to-r from-admin-accent to-admin-primary hover:from-admin-accent/90 hover:to-admin-primary/90 text-admin-accent-foreground shadow-lg"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  )}
                >
                  {({ close }) => (
                    <>
                      <button
                        onClick={() => {
                          handleSelectMany();
                          close();
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-accent rounded-md transition-colors"
                      >
                        <span>{t("selectMany")}</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowPublicStatus(!showPublicStatus);
                          close();
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-accent rounded-md transition-colors"
                      >
                        <span>
                          {showPublicStatus
                            ? t("hidePublicStatus")
                            : t("showPublicStatus")}
                        </span>
                      </button>
                    </>
                  )}
                </ShareDropdown>
                <Button
                  variant={viewMode === "grid" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("grid")}
                  className={
                    viewMode === "grid"
                      ? "bg-admin-accent text-admin-accent-foreground hover:bg-admin-accent/90"
                      : ""
                  }
                >
                  <Grid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                  className={
                    viewMode === "list"
                      ? "bg-admin-accent text-admin-accent-foreground hover:bg-admin-accent/90"
                      : ""
                  }
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {renderFailedJobs()}
      {renderIncompleteJobs()}
      {medias.length > 0 ? (
        <VirtualizedGrid
          items={medias}
          viewMode={viewMode}
          isLoading={isLoading}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          onLoadMore={loadMore}
          scrollRestorationKey="user-videos-grid"
          isSelecting={isSelecting}
          selectedItems={selectedMedias}
          onToggleSelection={handleToggleSelection}
          contentCardProps={{
            canLike: true,
            canBookmark: true,
            canFullscreen: true,
            canAddToAlbum: true,
            canDownload: true,
            canDelete: true,
            showCounts: true,
            showTags: false,
            showIsPublic: showPublicStatus,
            customActions: getCustomActions,
            preferredThumbnailSize:
              viewMode === "grid" ? undefined : "originalSize",
            inActions: {
              addToAlbum: true,
              removeFromAlbum: true,
              download: true,
              delete: true,
            },
          }}
          mediaList={medias}
          emptyState={{
            icon: (
              <VideoIcon className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            ),
            title: t("noVideosYet"),
            description: t("startCreatingVideos"),
          }}
          loadingState={{
            loadingText: t("loadingMoreVideos"),
            noMoreText: t("noMoreVideosToLoad"),
          }}
        />
      ) : (
        <div className="bg-card/80 backdrop-blur-sm rounded-xl shadow-lg border border-admin-primary/10 p-12 text-center">
          <VideoIcon className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">
            {t("noVideosYet")}
          </h3>
          <p className="text-muted-foreground mb-6">
            {t("startCreatingVideos")}{" "}
            {t.rich("convertHintDesktop", {
              btn: () => (
                <button
                  type="button"
                  disabled
                  className="p-2.5 sm:p-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white transition-all shadow-lg hover:shadow-xl hover:scale-110 ring-2 ring-white/20 pointer-events-none"
                  aria-label="Convert to video"
                  aria-hidden="true"
                >
                  <VideoIcon className="h-4 w-4 sm:h-4 sm:w-4" />
                </button>
              ),
            })}
          </p>
        </div>
      )}

      {editingMedia && (
        <EditTitleDialog
          isOpen={!!editingMedia}
          onClose={() => setEditingMedia(null)}
          onConfirm={handleConfirmTitleEdit}
          currentTitle={editingMedia.originalFilename || ""}
          loading={updateMedia.isPending}
        />
      )}

      {showAddToAlbumDialog && selectedMediaObjects.length > 0 && (
        <AddToAlbumDialog
          isOpen={showAddToAlbumDialog}
          onClose={handleCloseAddToAlbumDialog}
          media={selectedMediaObjects}
        />
      )}

      <ConfirmDialog
        isOpen={showDeleteConfirmDialog}
        onClose={() => setShowDeleteConfirmDialog(false)}
        onConfirm={handleConfirmDelete}
        title={t("confirmDeleteTitle")}
        message={t("confirmDeleteMessage", { count: selectedMedias.size })}
        confirmText={t("delete")}
        cancelText={t("cancel")}
        confirmVariant="danger"
        loading={bulkDeleteMedia.isPending}
      />
    </div>
  );
};

export default UserVideosPage;
