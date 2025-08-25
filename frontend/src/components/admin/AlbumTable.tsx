"use client";

import { Album } from "@/types";
import { Button } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import { formatDate } from "@/lib/utils";
import { useTranslations } from "next-intl";
import {
  getBestThumbnailUrl,
  composeThumbnailUrls,
  composeAlbumCoverUrl,
} from "@/lib/urlUtils";
import { ComponentErrorBoundary } from "../ErrorBoundaries";

interface AlbumTableProps {
  albums: Album[];
  selectedAlbums: string[];
  onSelectAlbum: (_albumId: string, _selected: boolean) => void;
  onSelectAll: (_selected: boolean) => void;
  onEdit: (_albumId: string) => void;
  onDelete: (_album: Album) => void;
  onManageMedia: (_albumId: string) => void;
  loading?: boolean;
}

export function AlbumTable({
  albums,
  selectedAlbums,
  onSelectAlbum,
  onSelectAll,
  onEdit,
  onDelete,
  onManageMedia,
  loading = false,
}: AlbumTableProps) {
  const t = useTranslations("common");
  const tTable = useTranslations("admin.albumTable");

  const allSelected =
    albums.length > 0 && selectedAlbums.length === albums.length;
  const someSelected =
    selectedAlbums.length > 0 && selectedAlbums.length < albums.length;

  if (loading && albums.length === 0) {
    return (
      <div className="bg-card shadow-lg rounded-xl border border-border">
        <div className="p-12 text-center">
          <div className="w-12 h-12 border-4 border-admin-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-muted-foreground">{tTable("loadingAlbums")}</div>
        </div>
      </div>
    );
  }

  if (albums.length === 0) {
    return (
      <div className="bg-card shadow-lg rounded-xl border border-border">
        <div className="p-12 text-center">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-muted-foreground"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">
            {tTable("noAlbumsFound")}
          </h3>
          <p className="text-muted-foreground">{tTable("createFirstAlbum")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card shadow-lg rounded-xl overflow-hidden border border-border">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted/30">
            <tr>
              <th className="px-6 py-4 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(input) => {
                    if (input) input.indeterminate = someSelected;
                  }}
                  onChange={(e) => onSelectAll(e.target.checked)}
                  className="h-4 w-4 text-admin-primary focus:ring-admin-primary border-border rounded"
                />
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                {tTable("headers.album")}
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                {tTable("headers.status")}
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                {tTable("headers.mediaCount")}
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                {tTable("headers.created")}
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                {tTable("headers.actions")}
              </th>
            </tr>
          </thead>
          <tbody className="bg-card divide-y divide-border">
            {albums.map((album) => (
              <ComponentErrorBoundary
                key={album.id}
                context={`Album Row (${album.id})`}
              >
                <tr
                  key={album.id}
                  className="hover:bg-muted/20 transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedAlbums.includes(album.id)}
                      onChange={(e) =>
                        onSelectAlbum(album.id, e.target.checked)
                      }
                      className="h-4 w-4 text-admin-primary focus:ring-admin-primary border-border rounded"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {(album.thumbnailUrls || album.coverImageUrl) && (
                        <div className="flex-shrink-0 h-12 w-12">
                          <img
                            className="h-12 w-12 rounded-lg object-cover border border-border"
                            src={getBestThumbnailUrl(
                              composeThumbnailUrls(album.thumbnailUrls),
                              composeAlbumCoverUrl(album.coverImageUrl),
                              "small"
                            )}
                            alt={album.title}
                          />
                        </div>
                      )}
                      <div className={album.coverImageUrl ? "ml-4" : ""}>
                        <div className="text-sm font-semibold text-foreground">
                          {album.title}
                        </div>
                        {album.tags && album.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2 max-w-xs">
                            {album.tags.slice(0, 2).map((tag, index) => (
                              <Tag key={index} size="sm">
                                {tag}
                              </Tag>
                            ))}
                            {album.tags.length > 2 && (
                              <span className="text-xs text-muted-foreground font-medium">
                                {tTable("moreTagsCount", {
                                  count: album.tags.length - 2,
                                })}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                        album.isPublic
                          ? "bg-admin-success/10 text-admin-success border border-admin-success/20"
                          : "bg-muted text-muted-foreground border border-border"
                      }`}
                    >
                      {album.isPublic
                        ? tTable("status.public")
                        : tTable("status.private")}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className="text-sm font-medium text-foreground">
                        {album.mediaCount}
                      </span>
                      <span className="text-xs text-muted-foreground ml-1">
                        {tTable("items")}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                    {formatDate(album.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEdit(album.id)}
                        className="border-admin-primary/30 text-admin-primary hover:bg-admin-primary hover:text-admin-primary-foreground"
                      >
                        {t("edit")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onManageMedia(album.id)}
                        className="border-admin-secondary/30 text-admin-secondary hover:bg-admin-secondary hover:text-admin-secondary-foreground"
                      >
                        {tTable("actions.media")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onDelete(album)}
                        className="text-destructive border-destructive/30 hover:bg-destructive hover:text-destructive-foreground"
                      >
                        {t("delete")}
                      </Button>
                    </div>
                  </td>
                </tr>
              </ComponentErrorBoundary>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
