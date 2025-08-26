import { ApiUtil } from "../api-util";
import type { UnifiedPaginationMeta, UserEntity } from "@/types";

// Types

export interface AdminUsersResponse {
  users: UserEntity[];
  pagination: UnifiedPaginationMeta;
}

export interface DisableUserResponse {
  message: string;
  user: UserEntity;
}

export interface EnableUserResponse {
  message: string;
  user: UserEntity;
}

// Admin Users API Functions
export const adminUsersApi = {
  // Get admin users list with pagination
  getUsers: async (params?: {
    limit?: number;
    lastEvaluatedKey?: string;
    cursor?: string; // Add cursor support for compatibility
  }): Promise<AdminUsersResponse> => {
    const apiParams = {
      limit: params?.limit,
      cursor: params?.cursor || params?.lastEvaluatedKey,
    };
    const response = await ApiUtil.get<AdminUsersResponse>(
      "/admin/users/list",
      apiParams
    );
    return ApiUtil.extractData(response);
  },

  // Disable a user
  disableUser: async (userId: string): Promise<DisableUserResponse> => {
    const response = await ApiUtil.post<DisableUserResponse>(
      "/admin/users/disable",
      { userId }
    );
    return ApiUtil.extractData(response);
  },

  // Enable a user
  enableUser: async (userId: string): Promise<EnableUserResponse> => {
    const response = await ApiUtil.post<EnableUserResponse>(
      "/admin/users/enable",
      { userId }
    );
    return ApiUtil.extractData(response);
  },
};
