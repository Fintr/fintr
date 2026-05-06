import { AxiosInstance } from "axios";
import { 
  Space, 
  CreateSpaceRequest, 
  GrantAccessRequest, 
  SpaceUser,
  SpaceContext 
} from "@/types/spaceTypes";

export const spacesApi = {
  // Get all spaces for current user
  getSpaces: (api: AxiosInstance) => 
    api.get<{ success: boolean; message: string; data: { spaces: Space[] } }>("/spaces"),

  // Get space details
  getSpace: (api: AxiosInstance, code: string) =>
    api.get<{ success: boolean; message: string; data: { space: SpaceContext } }>(`/spaces/${code}`),

  // Create organization space
  createSpace: (api: AxiosInstance, data: CreateSpaceRequest) =>
    api.post<{ success: boolean; message: string; data: { id: string } }>("/spaces", data),

  // Join space with access code
  joinSpace: (api: AxiosInstance, code: string, accessCode: string) =>
    api.post<{ success: boolean; message: string; data: { space: Space } }>(`/spaces/${code}/join`, { 
      access_code: accessCode 
    }),

  // Leave space
  leaveSpace: (api: AxiosInstance, code: string) =>
    api.delete<{ success: boolean; message: string }>(`/spaces/${code}/leave`),

  // Switch to space (for future implementation)
  switchSpace: (api: AxiosInstance, spaceCode: string) =>
    api.post<{ success: boolean; message: string; data: { space: Space } }>("/spaces/switch", { 
      space_code: spaceCode 
    }),

  // Get space users (admin only)
  getSpaceUsers: (api: AxiosInstance, spaceCode: string) =>
    api.get<{ success: boolean; message: string; data: { users: SpaceUser[] } }>(`/spaces/${spaceCode}/users`),

  // Grant access to space (admin only)
  grantAccess: (api: AxiosInstance, spaceCode: string, data: GrantAccessRequest) =>
    api.post<{ success: boolean; message: string; data: { accessLink: string } }>(
      `/spaces/${spaceCode}/users/grant_access`,
      data
    ),

  // Remove user from space (admin only)
  removeUser: (api: AxiosInstance, spaceCode: string, userId: string) =>
    api.delete<{ success: boolean; message: string }>(`/spaces/${spaceCode}/users/${userId}/remove`),

  // Update space (admin only): name, currency, and/or defaultTransactionCurrency
  updateSpace: (
    api: AxiosInstance,
    spaceId: string,
    params: {
      name: string;
      currency?: string | null;
      defaultTransactionCurrency?: string | null;
    }
  ) =>
    api.patch<{ success: boolean; message: string; data: { space: Space } }>(
      `/spaces/${spaceId}`,
      {
        name: params.name,
        ...(params.currency !== undefined && {
          currency: params.currency || null,
        }),
        ...(params.defaultTransactionCurrency !== undefined && {
          default_transaction_currency: params.defaultTransactionCurrency || null,
        }),
      }
    ),

  // Mark space invitation as seen
  markSeen: (api: AxiosInstance, spaceCode: string) =>
    api.post<{ success: boolean; message: string }>(`/spaces/${spaceCode}/mark_seen`),

  // Delete space (owner only)
  deleteSpace: (api: AxiosInstance, spaceCode: string) =>
    api.delete<{ success: boolean; message: string }>(`/spaces/${spaceCode}`),

  // Transfer ownership (owner only)
  transferOwnership: (api: AxiosInstance, spaceCode: string, newOwnerId: string) =>
    api.post<{ success: boolean; message: string; data: { space: Space } }>(
      `/spaces/${spaceCode}/transfer_ownership`,
      { new_owner_id: newOwnerId }
    ),
};

