import { AxiosInstance } from "axios";

interface GetUserAuth0SettingsProps {
  api: AxiosInstance;
}

export const getUserAuth0Settings = async ({ api }: GetUserAuth0SettingsProps) => {
  const response = await api.get('/auth/user');
  return response.data;
};
