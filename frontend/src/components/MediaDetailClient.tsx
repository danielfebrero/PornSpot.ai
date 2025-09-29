"use client";

import {
  useState,
  useMemo,
  useEffect,
  FC,
  ReactNode,
  useRef,
  useCallback,
} from "react";
import { useLocaleRouter } from "@/lib/navigation";
import {
  useBulkViewCounts,
  useTrackView,
} from "@/hooks/queries/useViewCountsQuery";
import {
  Share2,
  ArrowLeft,
  FolderOpen,
  MessageCircle,
  Calendar,
  FileText,
  Eye,
  Download,
  User,
  ChevronDown,
  Info,
  Layers,
  Bot,
  Palette,
  Hash,
  Sliders,
  Image as ImageIcon,
} from "lucide-react";
import { Media, EnhancedMedia } from "@/types";
import { usePrefetchInteractionStatus } from "@/hooks/queries/useInteractionsQuery";
import { ShareDropdown } from "@/components/ui/ShareDropdown";
import { Tooltip } from "@/components/ui/Tooltip";
import { ContentCard } from "@/components/ui/ContentCard";
import { HorizontalScroll } from "@/components/ui/HorizontalScroll";
import { Comments } from "@/components/ui/Comments";
import { MediaPlayer } from "@/components/ui/MediaPlayer";
import LocaleLink from "@/components/ui/LocaleLink";
import { cn } from "@/lib/utils";
import { formatFileSize, isVideo } from "@/lib/utils";
import { useDateUtils } from "@/hooks/useDateUtils";
import { useUserContext } from "@/contexts/UserContext";
import { useTranslations } from "next-intl";
import { getLoraNameById } from "@/utils/loraModels";
import { useMediaById } from "@/hooks/queries/useMediaQuery";

// --- PROPS INTERFACES ---

interface MediaDetailClientProps {
  media: EnhancedMedia;
}

interface MetaSectionProps {
  icon: ReactNode;
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

interface InfoPillProps {
  icon: ReactNode;
  label: string;
  value: string | ReactNode;
  isTag?: boolean;
}

interface GenerationPromptProps {
  title: string;
  prompt: string;
}

// --- DATA EXTRACTORS ---

const useMediaMetadata = (media: Media) => {
  return useMemo(() => {
    const metadata = media.metadata || {};

    // Determine creator from multiple sources
    let creator = "Unknown";
    let creatorUsername: string | null = null;
    let isCreatorClickable = false;

    // Priority order:
    // 1. creatorUsername from metadata (fetched from backend)
    // 2. creator/artist from metadata (fallback for older entries)
    // 3. Check if we have createdBy info
    if (metadata.creatorUsername) {
      creator = String(metadata.creatorUsername);
      creatorUsername = String(metadata.creatorUsername);
      isCreatorClickable = true;
    } else if (metadata.creator || metadata.artist) {
      creator = String(metadata.creator || metadata.artist);
    } else if (media.createdBy && media.createdByType === "user") {
      creator = `User ${media.createdBy.slice(10)}`; // Show last 8 chars of userId as fallback
    } else if (media.createdBy && media.createdByType === "admin") {
      creator = "Admin";
    }

    return {
      creator,
      creatorUsername,
      isCreatorClickable,
      prompt: metadata.prompt || metadata.description,
      negativePrompt: metadata.negativePrompt,
      loraModels: metadata.selectedLoras || [],
      loraStrengths: (metadata.loraStrengths || {}) as Record<
        string,
        { mode: "auto" | "manual"; value: number }
      >,
      highLorasScales: (metadata.highLorasScales || {}) as Record<
        string,
        { mode: "auto" | "manual"; value: number }
      >,
      lowLorasScales: (metadata.lowLorasScales || {}) as Record<
        string,
        { mode: "auto" | "manual"; value: number }
      >,
      bulkSiblings: metadata.bulkSiblings || [],
      dimensions:
        media.width && media.height ? `${media.width} × ${media.height}` : null,
      cfgScale: metadata.cfgScale || 4.5,
      steps: metadata.steps || 30,
      seed: metadata.seed || -1,
    };
  }, [media]);
};

// --- UI COMPONENTS ---

const MetaSection: FC<MetaSectionProps> = ({
  icon,
  title,
  defaultOpen = false,
  children,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-border/10 rounded-lg bg-background/20 backdrop-blur-sm">
      <button
        className="flex items-center justify-between w-full md:p-4 py-4"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
          <div className="text-primary">{icon}</div>
          <h3 className="font-semibold text-foreground">{title}</h3>
        </div>
        <ChevronDown
          className={cn(
            "w-5 h-5 text-muted-foreground transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </button>
      {isOpen && <div className="md:p-4 py-4 pt-0 space-y-4">{children}</div>}
    </div>
  );
};

const InfoPill: FC<InfoPillProps> = ({ icon, label, value, isTag = false }) => (
  <div
    className={cn(
      "flex items-center justify-between py-2 px-3 rounded-md",
      isTag ? "bg-primary/10 text-primary" : "bg-muted/50 text-muted-foreground"
    )}
  >
    <div className="flex items-center gap-2 text-sm">
      {icon}
      <span>{label}</span>
    </div>
    <span className={cn("font-medium text-sm", !isTag && "text-foreground")}>
      {value}
    </span>
  </div>
);

const GenerationPrompt: FC<GenerationPromptProps> = ({ title, prompt }) => (
  <div>
    <h4 className="mb-2 text-sm font-medium text-muted-foreground">{title}</h4>
    <div className="p-3 text-sm rounded-lg bg-muted/50 max-h-40 overflow-y-auto scrollbar-hide">
      {prompt}
    </div>
  </div>
);

// --- MAIN COMPONENT ---

export function MediaDetailClient({ media }: MediaDetailClientProps) {
  const router = useLocaleRouter();
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);
  const [viewTracked, setViewTracked] = useState(false);
  const [localMedia, setLocalMedia] = useState(media);
  const t = useTranslations("mediaDetail");
  const tGenerate = useTranslations("generate");
  const metadata = useMediaMetadata(localMedia);
  const { user } = useUserContext();
  const { formatRelativeTime } = useDateUtils();
  const hasTrackedView = useRef(false);
  const trackViewMutation = useTrackView();

  // Use TanStack Query to get fresh data and handle real-time updates
  const { data: freshMedia, isLoading } = useMediaById(media.id, true);

  // Sync local media with fresh data when available, fallback to initial props
  useEffect(() => {
    if (freshMedia) {
      setLocalMedia(freshMedia);
    } else {
      setLocalMedia(media);
    }
  }, [freshMedia, isLoading, media]);

  // Handler for media updates from MediaPlayer
  const handleMediaUpdate = useCallback((updates: Partial<Media>) => {
    setLocalMedia((prev) => ({ ...prev, ...updates }));
  }, []);

  // Hook for bulk prefetching interaction status
  const { prefetch } = usePrefetchInteractionStatus();

  // Track view when component mounts, then enable view count fetching
  useEffect(() => {
    if (hasTrackedView.current) return;
    hasTrackedView.current = true;

    // Track view and then enable view count fetching
    trackViewMutation.mutate(
      {
        targetType: localMedia.type,
        targetId: localMedia.id,
      },
      {
        onSettled: () => {
          // Enable view count fetching after tracking is done (success or failure)
          setViewTracked(true);
        },
      }
    );
  }, [localMedia.id, localMedia.type, trackViewMutation]);

  // Bulk prefetch view counts for the media and albums
  const viewCountTargets = useMemo(() => {
    const targets: Array<{
      targetType: "album" | "image" | "video";
      targetId: string;
    }> = [{ targetType: localMedia.type, targetId: localMedia.id }];

    // Add albums to view count targets if they exist
    if (localMedia.albums && localMedia.albums.length > 0) {
      const albumTargets = localMedia.albums.map((album) => ({
        targetType: "album" as const,
        targetId: album.id,
      }));
      targets.push(...albumTargets);
    }

    return targets;
  }, [localMedia.type, localMedia.id, localMedia.albums]);

  // Prefetch view counts in the background - but only after view tracking is done
  useBulkViewCounts(viewCountTargets, {
    enabled: viewCountTargets.length > 0 && viewTracked,
  });

  // Prefetch interaction status for media and related albums
  useEffect(() => {
    const targets: Array<{
      targetType: "album" | "image" | "video";
      targetId: string;
    }> = [
      {
        targetType: localMedia.type,
        targetId: localMedia.id,
      },
    ];

    // Add albums to prefetch targets if they exist
    if (localMedia.albums && localMedia.albums.length > 0) {
      const albumTargets = localMedia.albums.map((album) => ({
        targetType: "album" as const,
        targetId: album.id,
      }));
      targets.push(...albumTargets);
    }

    prefetch(targets).catch((error) => {
      console.error(
        "Failed to prefetch media detail interaction status:",
        error
      );
    });
  }, [localMedia, prefetch]);

  // Determine if media is video
  const isVideoMedia = isVideo(localMedia);
  const shouldShowPlayer = isVideoMedia;
  const originalMedia = localMedia.originalMedia;

  // Desktop-only handler for MediaPlayer - mobile behavior is handled by ContentCard
  const handleDesktopMediaClick = () => {
    if (shouldShowPlayer) {
      setIsPlayingVideo(!isPlayingVideo);
    }
  };

  // Mobile handler for MediaPlayer - triggers appropriate action on second tap
  const handleMobileMediaClick = () => {
    if (shouldShowPlayer) {
      setIsPlayingVideo(!isPlayingVideo);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur-sm border-border">
        <div className="flex items-center min-h-16 gap-4 md:px-4 py-4">
          <Tooltip content={t("goBack")} side="bottom">
            <button
              onClick={() => router.back()}
              className="p-2 transition-colors rounded-full hover:bg-muted flex-shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Tooltip>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold">
              {localMedia.originalFilename || localMedia.filename}
            </h1>
            {/* Media Metadata in Header */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1">
              {/* Creation Date */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <Calendar className="w-3 h-3" />
                <span>{formatRelativeTime(localMedia.createdAt)}</span>
              </div>

              {/* Creator Username */}
              {metadata.isCreatorClickable && metadata.creatorUsername ? (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <User className="w-3 h-3" />
                  <LocaleLink
                    href={`/profile/${metadata.creatorUsername}`}
                    className="hover:text-foreground transition-colors hover:underline"
                  >
                    {metadata.creator}
                  </LocaleLink>
                </div>
              ) : (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <User className="w-3 h-3" />
                  <span
                    className={
                      metadata.creator !== "Unknown"
                        ? "text-primary font-medium"
                        : ""
                    }
                  >
                    {metadata.creator}
                  </span>
                </div>
              )}
            </div>
          </div>
          <ShareDropdown
            trigger={({ toggle }: { toggle: () => void }) => (
              <Tooltip content={t("share")} side="bottom">
                <button
                  onClick={toggle}
                  className="p-2 transition-colors rounded-full hover:bg-muted flex-shrink-0"
                >
                  <Share2 className="w-5 h-5" />
                </button>
              </Tooltip>
            )}
          >
            {({ close }: { close: () => void }) => (
              <>
                <button
                  className="flex items-center w-full px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    close();
                  }}
                >
                  {t("copyLink")}
                </button>
                <a
                  className="flex items-center w-full px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
                  href={`https://www.reddit.com/submit?url=${encodeURIComponent(
                    window.location.href
                  )}&title=${encodeURIComponent(
                    localMedia.originalFilename || localMedia.filename
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={close}
                >
                  Reddit
                </a>
                <a
                  className="flex items-center w-full px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
                  href={`https://x.com/intent/tweet?url=${encodeURIComponent(
                    window.location.href
                  )}&text=${encodeURIComponent(
                    localMedia.originalFilename || localMedia.filename
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={close}
                >
                  X (Twitter)
                </a>
              </>
            )}
          </ShareDropdown>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto md:p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Media Display */}
          <div className="lg:col-span-2">
            <div className="relative bg-card shadow-lg rounded-lg overflow-hidden flex items-center justify-center min-h-[400px]">
              <MediaPlayer
                media={localMedia}
                isPlaying={isPlayingVideo}
                onTogglePlay={handleDesktopMediaClick}
                onMobileClick={handleMobileMediaClick}
                onMediaUpdate={handleMediaUpdate}
                className="w-fit h-fit max-w-full"
                imageClassName="w-auto h-auto object-contain"
                canFullscreen={true}
                useAllAvailableSpace={true}
              />
            </div>
          </div>

          {/* Right Column: Information & Details */}
          <aside className="space-y-6">
            <MetaSection
              icon={<Info className="w-5 h-5" />}
              title={t("mediaDetails")}
              defaultOpen
            >
              <div className="space-y-3">
                {metadata.dimensions && (
                  <InfoPill
                    icon={<Eye className="w-4 h-4" />}
                    label="Dimensions"
                    value={metadata.dimensions}
                  />
                )}
                <InfoPill
                  icon={<Download className="w-4 h-4" />}
                  label="File Size"
                  value={formatFileSize(localMedia.size)}
                />
                <InfoPill
                  icon={<FileText className="w-4 h-4" />}
                  label="File Type"
                  value={
                    <span className="font-mono text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                      {localMedia.mimeType}
                    </span>
                  }
                />
              </div>
            </MetaSection>

            {originalMedia && (
              <MetaSection
                icon={<ImageIcon className="w-5 h-5" />}
                title={t("originalMedia")}
                defaultOpen
              >
                <ContentCard
                  item={originalMedia}
                  canLike={false}
                  canBookmark={false}
                  canAddToAlbum={false}
                  canRemoveFromAlbum={false}
                  canDownload={false}
                  canDelete={false}
                  showCounts={false}
                  showTags={false}
                  aspectRatio="auto"
                />
              </MetaSection>
            )}

            {metadata.prompt && (
              <MetaSection
                icon={<Bot className="w-5 h-5" />}
                title={t("prompts")}
              >
                <GenerationPrompt
                  title={t("prompt")}
                  prompt={String(metadata.prompt)}
                />
                {metadata.negativePrompt && (
                  <GenerationPrompt
                    title={t("negativePrompt")}
                    prompt={String(metadata.negativePrompt)}
                  />
                )}
              </MetaSection>
            )}

            {Array.isArray(metadata.loraModels) &&
              metadata.loraModels.length > 0 && (
                <MetaSection
                  icon={<Palette className="w-5 h-5" />}
                  title={t("loraModels")}
                >
                  <div className="space-y-2">
                    {metadata.loraModels.map((lora: string, index: number) => {
                      const strength = metadata.loraStrengths[lora];
                      const highScale = metadata.highLorasScales[lora];
                      const lowScale = metadata.lowLorasScales[lora];

                      const formatValue = (value: number) =>
                        Number(value.toFixed(3)).toString();

                      const formatMode = (mode: "auto" | "manual") =>
                        mode === "manual"
                          ? tGenerate("manual")
                          : tGenerate("auto");

                      const renderScaleLine = (
                        label: string | null | undefined,
                        scale?: { mode: "auto" | "manual"; value: number }
                      ) =>
                        scale ? (
                          <span className="block text-right text-sm">
                            {label ? (
                              <span className="text-xs text-muted-foreground">
                                {label}:
                              </span>
                            ) : null}
                            {label ? " " : null}
                            <span className="text-foreground">
                              {formatValue(scale.value)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {" "}
                              ({formatMode(scale.mode)})
                            </span>
                          </span>
                        ) : null;

                      const loraValue = (() => {
                        if (highScale || lowScale) {
                          return (
                            <>
                              {renderScaleLine(t("loraHighNoise"), highScale)}
                              {renderScaleLine(t("loraLowNoise"), lowScale)}
                            </>
                          );
                        }

                        if (strength) {
                          return renderScaleLine(null, strength);
                        }

                        return "1";
                      })();

                      return (
                        <InfoPill
                          key={index}
                          icon={<Hash className="w-4 h-4" />}
                          label={getLoraNameById(lora, tGenerate)}
                          value={loraValue}
                          isTag
                        />
                      );
                    })}
                  </div>
                </MetaSection>
              )}

            <MetaSection
              icon={<Sliders className="w-5 h-5" />}
              title={t("otherControls")}
            >
              <div className="space-y-2">
                <InfoPill
                  icon={<Hash className="w-4 h-4" />}
                  label="CFG Scale"
                  value={String(metadata.cfgScale)}
                />
                <InfoPill
                  icon={<Hash className="w-4 h-4" />}
                  label="Steps"
                  value={String(metadata.steps)}
                />
                <InfoPill
                  icon={<Hash className="w-4 h-4" />}
                  label="Seed"
                  value={String(metadata.seed)}
                />
              </div>
            </MetaSection>

            {localMedia.type === "image" && (
              <MetaSection
                icon={<Layers className="w-5 h-5" />}
                title={t("relatedImages")}
                defaultOpen={
                  localMedia.bulkSiblings && localMedia.bulkSiblings.length > 0
                }
              >
                {localMedia.bulkSiblings &&
                localMedia.bulkSiblings.length > 0 ? (
                  <HorizontalScroll
                    itemWidth="150px"
                    gap="small"
                    showArrows={true}
                    className="w-full"
                  >
                    {localMedia.bulkSiblings?.map(
                      (sibling: Media, index: number) => (
                        <ContentCard
                          item={sibling}
                          key={sibling.id}
                          canFullscreen={true}
                          canBookmark={true}
                          canLike={true}
                          canAddToAlbum={true}
                          mediaList={localMedia.bulkSiblings}
                          currentIndex={index}
                        />
                      )
                    )}
                  </HorizontalScroll>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <Layers className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p>No related images found.</p>
                  </div>
                )}
              </MetaSection>
            )}

            <MetaSection
              icon={<FolderOpen className="w-5 h-5" />}
              title={t("inAlbums")}
              defaultOpen={localMedia.albums && localMedia.albums.length > 0}
            >
              {localMedia.albums && localMedia.albums.length > 0 ? (
                <HorizontalScroll
                  itemWidth="200px"
                  gap="medium"
                  showArrows={true}
                  className="w-full"
                >
                  {localMedia.albums.map((album) => (
                    <ContentCard
                      key={album.id}
                      item={album}
                      aspectRatio="square"
                      canLike={false}
                      canBookmark={false}
                      canFullscreen={false}
                      canAddToAlbum={false}
                      canDownload={false}
                      canDelete={false}
                      showTags={false}
                      showCounts={true}
                      className="w-full"
                    />
                  ))}
                </HorizontalScroll>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <FolderOpen className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p>Not in any albums yet.</p>
                </div>
              )}
            </MetaSection>

            <MetaSection
              icon={<MessageCircle className="w-5 h-5" />}
              title={t("comments")}
              defaultOpen
            >
              <Comments
                targetType={localMedia.type}
                targetId={localMedia.id}
                initialComments={localMedia.comments}
                currentUserId={user?.userId}
              />
            </MetaSection>
          </aside>
        </div>
      </main>
    </div>
  );
}
