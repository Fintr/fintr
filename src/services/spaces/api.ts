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
    api.get<{ data: { spaces: Space[] } }>("/spaces"),

  // Get space details
  getSpace: (api: AxiosInstance, code: string) =>
    api.get<{ data: { space: SpaceContext } }>(`/spaces/${code}`),

  // Create organization space
  createSpace: (api: AxiosInstance, data: CreateSpaceRequest) =>
    api.post<{ data: { space: Space } }>("/spaces", data),

  // Join space with access code
  joinSpace: (api: AxiosInstance, code: string, accessCode: string) =>
    api.post<{ data: { space: Space } }>(`/spaces/${code}/join`, { 
      access_code: accessCode 
    }),

  // Leave space
  leaveSpace: (api: AxiosInstance, code: string) =>
    api.delete<{ message: string }>(`/spaces/${code}/leave`),

  // Switch to space (for future implementation)
  switchSpace: (api: AxiosInstance, spaceCode: string) =>
    api.post<{ data: { space: Space } }>("/spaces/switch", { 
      space_code: spaceCode 
    }),

  // Get space users (admin only)
  getSpaceUsers: (api: AxiosInstance, spaceCode: string) =>
    api.get<{ success: boolean; message: string; data: { users: SpaceUser[] } }>(`/spaces/${spaceCode}/users`),

  // Grant access to space (admin only)
  grantAccess: (api: AxiosInstance, spaceCode: string, data: GrantAccessRequest) =>
    api.post<{ data: { access_link: string } }>(
      `/spaces/${spaceCode}/users/grant_access`,
      data
    ),

  // Remove user from space (admin only)
  removeUser: (api: AxiosInstance, spaceCode: string, userId: string) =>
    api.delete<{ message: string }>(`/spaces/${spaceCode}/users/${userId}/remove`),
};

