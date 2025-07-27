
'use client';

import { useEffect, useState } from 'react';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../components/ui/card';
import { useAuth0 } from '@auth0/auth0-react';
import { Toaster, toast } from 'sonner';
import { updateUser, requestPasswordReset } from '@/services/auth/user/mutations';
import { getUserAuth0Settings } from '@/services/auth/user/queries';
import { useAuthApi } from '@/hooks/useAuthApi';
import { CheckCircle } from 'lucide-react';

/**
 * Renders the settings page where users can manage their profile information.
 * Allows users to update their name, email, and initiate a password reset.
 */
const SettingsPage = () => {
  const { user } = useAuth0();
  const { api } = useAuthApi();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [isNameLoading, setIsNameLoading] = useState(false);
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  const [usesEmail, setUsesEmail] = useState(false);

  useEffect(() => {
    const runGetUserAuth0Settings = async () => {
      const response = await getUserAuth0Settings({ api });
      setUsesEmail(response.data.usesEmail);
    };
    runGetUserAuth0Settings();
  }, [user]);

  /**
   * Handles the update of the user's name.
   * This function would typically call a backend API to update the user metadata in Auth0.
   */
  const handleUpdateName = async () => {
    setIsNameLoading(true);
    try {
      const response = await updateUser({ api, name });
      toast.success(response.message);
    } catch (error) {
      toast.error(`Failed to update name: ${(error as Error).message}`);
      console.error('Failed to update name:', error);
    } finally {
      setIsNameLoading(false);
    }
  };

  /**
   * Handles the update of the user's email.
   * This function would typically call a backend API to update the user's email in Auth0
   * and potentially trigger an email verification flow.
   */
  const handleUpdateEmail = async () => {
    setIsEmailLoading(true);
    try {
      const response = await updateUser({ api, email });
      toast.success(response.message);
    } catch (error) {
      toast.error(`Failed to update email: ${(error as Error).message}`);
      console.error('Failed to update email:', error);
    } finally {
      setIsEmailLoading(false);
    }
  };

  /**
   * Handles the password reset request.
   * This function initiates Auth0's password reset flow, typically by sending a reset email.
   */
  const handleResetPassword = async () => {
    setIsPasswordLoading(true);
    try {
      if (user?.email) {
        await requestPasswordReset({ api, email: user.email });
      } else {
        throw new Error("User email not found for password reset.");
      }

      toast.info('Password reset email sent. Please check your inbox.');
    } catch (error) {
      toast.error(`Failed to send password reset email: ${(error as Error).message}`);
      console.error('Failed to send password reset email:', error);
    } finally {
      setIsPasswordLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Update Profile</CardTitle>
            <CardDescription>
              Manage your personal information such as name and email address.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                placeholder="Your Name"
                aria-label="Your Name"
              />
              <Button onClick={handleUpdateName} disabled={isNameLoading} className="mt-2" aria-label="Update Name">
                {isNameLoading ? 'Updating...' : 'Update Name'}
              </Button>
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <div className="flex items-center space-x-2">
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                  placeholder="Your Email"
                  aria-label="Your Email"
                  disabled={!usesEmail}
                />
                {user?.email_verified && (
                  <div className="flex items-center text-green-600 px-2 py-1 rounded-md bg-green-50">
                    <CheckCircle className="h-4 w-4 mr-1" />
                    <span className="text-sm font-medium">Verified</span>
                  </div>
                )}
              </div>
              <Button onClick={handleUpdateEmail} disabled={isEmailLoading || !usesEmail} className="mt-2" aria-label="Update Email">
                {isEmailLoading ? 'Updating...' : usesEmail ? 'Update Email' : 'Cannot update email'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {usesEmail && (
          <Card>
            <CardHeader>
              <CardTitle>Password Management</CardTitle>
              <CardDescription>Reset your password securely.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleResetPassword} disabled={isPasswordLoading} aria-label="Reset Password">
                {isPasswordLoading ? 'Sending...' : 'Reset Password'}
              </Button>
              <p className="text-sm text-gray-500 mt-2">
                A password reset link will be sent to your registered email address.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
      <Toaster />
    </div>
  );
};

export default SettingsPage; 
