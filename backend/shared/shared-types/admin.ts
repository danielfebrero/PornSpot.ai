// Admin authentication and management types

export interface AdminUser {
  adminId: string;
  username: string;
  createdAt: string;
  isActive: boolean;
}

export interface AdminSession {
  sessionId: string;
  adminId: string;
  adminUsername: string;
  createdAt: string;
  expiresAt: string;
  lastAccessedAt: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  admin: AdminUser;
  sessionId: string;
}

export interface SessionValidationResult {
  isValid: boolean;
  admin?: AdminUser;
  session?: AdminSession;
}

// Admin Album Management Types
export interface CreateAdminAlbumRequest {
  title: string;
  description?: string;
  isPublic: boolean;
}

export interface UpdateAdminAlbumRequest {
  title?: string;
  tags?: string[];
  isPublic?: boolean;
  coverImageUrl?: string;
}

// Admin Media Management Types
export interface AdminUploadMediaResponse {
  mediaId: string;
  uploadUrl: string;
  key: string;
  expiresIn: number;
}

export interface AdminDeleteMediaRequest {
  albumId: string;
  mediaId: string;
}

// Admin Statistics Types
export interface AdminStats {
  totalAlbums: number;
  totalMedia: number;
  publicAlbums: number;
  storageUsed: string;
  storageUsedBytes: number;
}