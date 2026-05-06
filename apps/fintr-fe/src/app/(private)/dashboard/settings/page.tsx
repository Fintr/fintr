'use client';

import { useEffect, useState } from 'react';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { updateUser, requestPasswordReset } from '@/services/auth/user/mutations';
import { getUserAuth0Settings } from '@/services/auth/user/queries';
import { useAuthApi } from '@/hooks/useAuthApi';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import ResetDataDialog from '../../../../components/dashboard/reset-data-dialog';
import DeleteUserAccountDialog from '../../../../components/dashboard/delete-user-account-dialog';
import SpaceAccessCard from '../../../../components/dashboard/space-access-card';

/**
 * Renders the settings page where users can manage their profile information.
 * Allows users to update their name, email, and initiate a password reset.
 */
const SettingsPage = () => {
  const { user } = useAuth();
  const { api } = useAuthApi();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [isNameLoading, setIsNameLoading] = useState(false);
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  const [usesEmail, setUsesEmail] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isDeleteAccountDialogOpen, setIsDeleteAccountDialogOpen] = useState(false);

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
    <div className="container mx-auto sm:py-8 px-2 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold mb-8 hidden md:block">Settings</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="px-2">
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
                  <div className="flex items-center text-teal-600 px-2 py-1 rounded-md bg-teal-100/50">
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

        {/* Space Access Management */}
        <SpaceAccessCard />

        <Card className="border-red-300">
          <CardHeader className="px-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-900/20">
                <AlertTriangle className="h-5 w-5 text-red-900" />
              </div>
              <div>
                <CardTitle className="text-red-900">Danger Zone</CardTitle>
                <CardDescription className="text-red-900">
                  Permanently delete all your data and start over.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-4">
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                This will permanently delete all your financial data, including transactions, 
                accounts, budgets, and goals. This action cannot be undone.
              </p>
              <div className="flex gap-2">
                <Button 
                  variant="destructive" 
                  onClick={() => setIsResetDialogOpen(true)}
                  aria-label="Reset all data"
                >
                  Reset Data
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={() => setIsDeleteAccountDialogOpen(true)}
                  aria-label="Delete account"
                >
                  Delete Account
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <ResetDataDialog 
        isOpen={isResetDialogOpen}
        onClose={() => setIsResetDialogOpen(false)}
      />
      <DeleteUserAccountDialog 
        isOpen={isDeleteAccountDialogOpen}
        onClose={() => setIsDeleteAccountDialogOpen(false)}
      />
    </div>
  );
};

export default SettingsPage; 
