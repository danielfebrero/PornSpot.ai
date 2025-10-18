/**
 * @fileoverview Discover Shared Types
 * @description Types for discover functionality and content discovery.
 * @notes
 * - DiscoverRequest for search/filtering.
 * - DiscoverResponse with paginated albums/media.
 * - DiscoverAlbum, DiscoverMedia for response items.
 * - DiscoverCursors for pagination.
 */
import { Album } from "./album";
import { Media } from "./media";

export interface DiscoverCursors {
  albums: string | null;
  media: string | null;
}

export interface DiscoverContent {
  items: (Album | Media)[];
  cursors: DiscoverCursors;
  metadata: {
    totalItems: number;
    albumCount: number;
    mediaCount: number;
    diversificationApplied: boolean;
    timeWindow: string;
  };
}

export interface DiscoverParams {
  limit?: number;
  cursorAlbums?: string;
  cursorMedia?: string;
  tag?: string;
  sort?: string;
  fetchOptions?: RequestInit;
}
