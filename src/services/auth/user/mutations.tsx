
import { AxiosInstance } from 'axios';

interface UpdateUserArgs {
  api: AxiosInstance;
  name?: string;
  email?: string;
}

interface RequestPasswordResetArgs {
  api: AxiosInstance;
  email: string;
}

/**
 * Patches user profile information (name or email).
 * @param {UpdateUserArgs} args - Arguments for patching user data.
 * @param {AxiosInstance} args.api - Authenticated Axios instance.
 * @param {string} [args.name] - New name for the user.
 * @param {string} [args.email] - New email for the user.
 * @returns {Promise<any>} - The response data from the backend API.
 */
export const updateUser = async ({ api, name, email }: UpdateUserArgs) => {
  const body: { name?: string; email?: string } = {};
  if (name !== undefined) {
    body.name = name;
  }
  if (email !== undefined) {
    body.email = email;
  }

  const response = await api.patch('/auth/user', body);
  return response.data;
};

/**
 * Requests a password reset email for the user.
 * @param {RequestPasswordResetArgs} args - Arguments for requesting password reset.
 * @param {AxiosInstance} args.api - Authenticated Axios instance.
 * @param {string} args.email - User's email for password reset.
 * @returns {Promise<any>} - The response data from the backend API.
 */
export const requestPasswordReset = async ({ api, email }: RequestPasswordResetArgs) => {
  const response = await api.post('/auth/user/reset_password', { email });
  return response.data;
}; 
