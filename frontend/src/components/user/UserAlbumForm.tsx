"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { TagManager } from "@/components/ui/TagManager";
import { Media } from "@/types";
import { useTranslations } from "next-intl";
import { usePermissions } from "@/contexts/PermissionsContext";
import { Crown } from "lucide-react";
import ResponsivePicture from "@/components/ui/ResponsivePicture";
import { CoverImageSelector } from "@/components/user/CoverImageSelector";
import {
  composeThumbnailUrls,
  getBestThumbnailUrl,
  composeMediaUrl,
} from "@/lib/urlUtils";
import { mediaApi } from "@/lib/api";

interface UserAlbumFormData {
  title: string;
  tags?: string[];
  isPublic: boolean;
  mediaIds?: string[];
  coverImageId?: string;
}

interface UserAlbumFormProps {
  onSubmit: (data: UserAlbumFormData) => void;
  onCancel: () => void;
  loading?: boolean;
  submitText?: string;
}

interface MediaWithSelection extends Media {
  selected: boolean;
}

export function UserAlbumForm({
  onSubmit,
  onCancel,
  loading = false,
  submitText = "Create Album",
}: UserAlbumFormProps) {
  const t = useTranslations("common");
  const tForm = useTranslations("user.userAlbumForm");
  const { canCreatePrivateContent } = usePermissions();

  const canMakePrivate = canCreatePrivateContent();

  const [formData, setFormData] = useState<UserAlbumFormData>({
    title: "",
    tags: [],
    isPublic: true, // Default to public - private content is Pro-only
    mediaIds: [],
    coverImageId: undefined,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [userMedia, setUserMedia] = useState<MediaWithSelection[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  // Fetch user's media on component mount
  useEffect(() => {
    const fetchUserMedia = async () => {
      setMediaLoading(true);
      setMediaError(null);

      try {
        const response = await mediaApi.getUserMedia({ limit: 100 });

        const mediaWithSelection = response.media.map((media: Media) => ({
          ...media,
          selected: false,
        }));
        setUserMedia(mediaWithSelection);
      } catch (err) {
        setMediaError(
          err instanceof Error ? err.message : tForm("failedToFetchImages")
        );
      } finally {
        setMediaLoading(false);
      }
    };

    fetchUserMedia();
  }, [tForm]);

  const handleInputChange = (
    field: keyof UserAlbumFormData,
    value: string | boolean | string[]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors["title"] = tForm("titleRequired");
    } else if (formData.title.trim().length < 2) {
      newErrors["title"] = tForm("titleTooShort");
    } else if (formData.title.length > 100) {
      newErrors["title"] = tForm("titleTooLong");
    }

    if (formData.tags && formData.tags.length > 20) {
      newErrors["tags"] = tForm("maxTagsReached");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      const selectedMediaIds = userMedia
        .filter((media) => media.selected)
        .map((media) => media.id);

      onSubmit({
        ...formData,
        mediaIds: selectedMediaIds.length > 0 ? selectedMediaIds : undefined,
        coverImageId: formData.coverImageId,
      });
    }
  };

  const toggleMediaSelection = (mediaId: string) => {
    setUserMedia((prev) =>
      prev.map((media) =>
        media.id === mediaId ? { ...media, selected: !media.selected } : media
      )
    );
  };

  const handleCoverSelect = (coverImageId?: string) => {
    if (!coverImageId) return;
    handleInputChange("coverImageId", coverImageId);
  };

  const selectedCount = userMedia.filter((media) => media.selected).length;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Title */}
      <div>
        <label
          htmlFor="title"
          className="block text-sm font-semibold text-foreground mb-2"
        >
          {tForm("title")} *
        </label>
        <Input
          id="title"
          type="text"
          value={formData.title}
          onChange={(e) => handleInputChange("title", e.target.value)}
          placeholder={tForm("titlePlaceholder")}
          className={
            errors["title"]
              ? "border-destructive focus:border-destructive focus:ring-destructive"
              : "focus:border-admin-primary focus:ring-admin-primary"
          }
          disabled={loading}
        />
        {errors["title"] && (
          <p className="mt-2 text-sm text-destructive flex items-center">
            <svg
              className="w-4 h-4 mr-1"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            {errors["title"]}
          </p>
        )}
      </div>

      {/* Tags */}
      <TagManager
        tags={formData.tags || []}
        onTagsChange={(newTags) => handleInputChange("tags", newTags)}
        label={tForm("tags")}
        placeholder={tForm("tagsPlaceholder")}
        helpText={tForm("tagsHelpText")}
        maxTags={20}
        maxTagLength={50}
        showCounter={true}
        disabled={loading}
        error={errors["tags"]}
        inputClassName={
          errors["tags"]
            ? "border-destructive focus:border-destructive focus:ring-destructive"
            : "focus:border-admin-primary focus:ring-admin-primary"
        }
        buttonClassName="border-admin-primary/30 text-admin-primary hover:bg-admin-primary/10"
      />

      {/* Public/Private Toggle */}
      <div className={`space-y-3 ${!canMakePrivate ? "opacity-50" : ""}`}>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isPublic"
            checked={!formData.isPublic}
            onChange={(e) => {
              if (!canMakePrivate) return;
              handleInputChange("isPublic", !e.target.checked);
            }}
            disabled={loading || !canMakePrivate}
            className="h-4 w-4 text-admin-primary focus:ring-admin-primary border-border rounded"
          />
          <label
            htmlFor="isPublic"
            className="text-sm font-medium text-foreground"
          >
            {tForm("makePrivate")}
          </label>
          {!canMakePrivate && (
            <div className="flex items-center gap-1">
              <Crown className="h-4 w-4 text-amber-500" />
              <span className="text-xs text-amber-600 font-medium">
                {tForm("proOnly")}
              </span>
            </div>
          )}
        </div>
        {!canMakePrivate && (
          <p className="text-xs text-muted-foreground">
            {tForm("privateContentDescription")}
          </p>
        )}
      </div>

      {/* Media Selection */}
      <div>
        <label className="block text-sm font-semibold text-foreground mb-4">
          {tForm("selectImages", { count: selectedCount })}
        </label>

        {mediaLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-admin-primary border-t-transparent rounded-full animate-spin"></div>
            <span className="ml-2 text-muted-foreground">
              {tForm("loadingImages")}
            </span>
          </div>
        )}

        {mediaError && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-4">
            <p className="text-destructive text-sm">{mediaError}</p>
          </div>
        )}

        {!mediaLoading && !mediaError && userMedia.length === 0 && (
          <div className="text-center py-8">
            <p className="text-muted-foreground">{tForm("noImages")}</p>
          </div>
        )}

        {!mediaLoading && !mediaError && userMedia.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 max-h-96 overflow-y-auto p-2 border border-border rounded-lg">
            {userMedia.map((media) => (
              <div
                key={media.id}
                className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
                  media.selected
                    ? "border-admin-primary shadow-lg"
                    : "border-transparent hover:border-admin-primary/30"
                }`}
                onClick={() => toggleMediaSelection(media.id)}
              >
                <ResponsivePicture
                  thumbnailUrls={composeThumbnailUrls(
                    media.thumbnailUrls || {}
                  )}
                  fallbackUrl={getBestThumbnailUrl(
                    composeThumbnailUrls(media.thumbnailUrls || {}),
                    composeMediaUrl(media.url)
                  )}
                  alt={media.originalFilename || "User image"}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                {media.selected && (
                  <div className="absolute top-2 right-2 w-5 h-5 bg-admin-primary rounded-full flex items-center justify-center">
                    <svg
                      className="w-3 h-3 text-white"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cover Image Selector */}
      <CoverImageSelector
        selectedMedia={userMedia}
        currentCoverImageId={formData.coverImageId}
        onCoverSelect={handleCoverSelect}
        disabled={loading}
      />

      {/* Action buttons */}
      <div className="flex gap-4 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={loading}
          className="flex-1 border-admin-primary/30 text-admin-primary hover:bg-admin-primary/10"
        >
          {t("cancel")}
        </Button>
        <Button
          type="submit"
          disabled={loading}
          className="flex-1 bg-gradient-to-r from-admin-primary to-admin-secondary hover:from-admin-primary/90 hover:to-admin-secondary/90 text-admin-primary-foreground"
        >
          {loading ? (
            <div className="flex items-center">
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></div>
              {tForm("creating")}
            </div>
          ) : (
            submitText || tForm("createAlbum")
          )}
        </Button>
      </div>
    </form>
  );
}
