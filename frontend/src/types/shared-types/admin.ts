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

// Admin Statistics Types
export interface AdminStats {
  totalAlbums: number;
  totalMedia: number;
  publicAlbums: number;
  storageUsed: string;
  storageUsedBytes: number;
}