"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useLocaleRouter } from "@/lib/navigation";
import { AlbumForm } from "@/components/admin/AlbumForm";
import {
  useAdminAlbum,
  useUpdateAdminAlbum,
} from "@/hooks/queries/useAdminAlbumsQuery";

interface EditAlbumPageProps {
  params: {
    albumId: string;
  };
}

export default function EditAlbumPage({ params }: EditAlbumPageProps) {
  const t = useTranslations("admin.albums");
  const router = useLocaleRouter();
  const {
    data: album,
    isLoading: fetchLoading,
    error: fetchError,
  } = useAdminAlbum(params.albumId);
  const updateAlbumMutation = useUpdateAdminAlbum();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (data: {
    title: string;
    tags?: string[];
    isPublic: boolean;
    coverImageUrl?: string;
  }) => {
    setError(null);

    try {
      await updateAlbumMutation.mutateAsync({
        albumId: params.albumId,
        updates: data,
      });
      router.push("/admin/albums");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("failedToUpdateAlbum"));
    }
  };

  const handleCancel = () => {
    router.push("/admin/albums");
  };

  if (fetchLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-8 h-8 border-4 border-admin-primary border-t-transparent rounded-full animate-spin"></div>
          <div className="text-muted-foreground">{t("loadingAlbum")}</div>
        </div>
      </div>
    );
  }

  if (fetchError && !album) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-gradient-to-r from-admin-primary/10 to-admin-secondary/10 rounded-xl p-6 border border-admin-primary/20">
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-8 h-8 bg-gradient-to-br from-admin-primary to-admin-secondary rounded-lg flex items-center justify-center">
              <svg
                className="w-5 h-5 text-white"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-foreground">
              {t("editAlbum")}
            </h1>
          </div>
          <p className="text-muted-foreground">
            {t("updateAlbumDetailsAndSettings")}
          </p>
        </div>
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          <div className="flex items-center">
            <svg
              className="w-5 h-5 text-destructive mr-2"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <p className="text-destructive font-medium">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!album) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-gradient-to-r from-admin-primary/10 to-admin-secondary/10 rounded-xl p-6 border border-admin-primary/20">
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-8 h-8 bg-gradient-to-br from-admin-primary to-admin-secondary rounded-lg flex items-center justify-center">
              <svg
                className="w-5 h-5 text-white"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-foreground">
              {t("editAlbum")}
            </h1>
          </div>
          <p className="text-muted-foreground">{t("albumNotFound")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-gradient-to-r from-admin-primary/10 to-admin-secondary/10 rounded-xl p-6 border border-admin-primary/20">
        <div className="flex items-center space-x-3 mb-2">
          <div className="w-8 h-8 bg-gradient-to-br from-admin-primary to-admin-secondary rounded-lg flex items-center justify-center">
            <svg
              className="w-5 h-5 text-white"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-foreground">
            {t("editAlbum")}
          </h1>
        </div>
        <p className="text-muted-foreground">
          {t("updateAlbumDetailsAndSettings")}
        </p>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          <div className="flex items-center">
            <svg
              className="w-5 h-5 text-destructive mr-2"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <p className="text-destructive font-medium">{error}</p>
          </div>
        </div>
      )}

      <AlbumForm
        initialData={{
          title: album.title,
          ...(album.tags && { tags: album.tags }),
          isPublic: album.isPublic,
          ...(album.coverImageUrl && { coverImageUrl: album.coverImageUrl }),
        }}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        loading={updateAlbumMutation.isPending}
        submitText={t("updateAlbum")}
        albumId={params.albumId}
      />
    </div>
  );
}
