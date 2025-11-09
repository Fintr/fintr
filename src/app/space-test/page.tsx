"use client";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthApi } from "@/hooks/useAuthApi";
import { useSpaceContext } from "@/hooks/useSpaceContext";
import { useSpacePermissions } from "@/hooks/useSpacePermissions";
import { useSpaceFeatures } from "@/hooks/useSpaceFeatures";
import NavDrawer from "@/components/dashboard/nav-drawer";
import { GrantAccessDialog } from "@/components/space/grant-access-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Settings, Users, BarChart, PieChart } from "lucide-react";

export default function SpaceTestPage() {
  const { user, logout } = useAuth();
  const { api } = useAuthApi();
  const { spaces, currentSpace, switchSpace, isLoading, isSwitching } = useSpaceContext(api);
  const { canManageUsers, canManageSettings, canViewAnalytics, canManageBudgets } = useSpacePermissions();
  const { teamCollaboration, advancedReporting, aiEnabled } = useSpaceFeatures();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [showGrantAccessDialog, setShowGrantAccessDialog] = useState(false);

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('spaceCode');
    }
    
    logout({
      logoutParams: {
        returnTo: process.env.NEXT_PUBLIC_APP_BASE_URL || window.location.origin
      }
    });
  };

  const navItems = [
    { title: "Settings", href: "/dashboard/settings", icon: Settings },
    { title: "Test Page", href: "/space-test", icon: BarChart },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading spaces...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">Space Switching Test</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                onClick={() => setIsMobileNavOpen(true)}
              >
                Menu
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Current Space Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Current Space
                {isSwitching && (
                  <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
                )}
              </CardTitle>
              <CardDescription>
                Information about your currently selected space
              </CardDescription>
            </CardHeader>
            <CardContent>
              {currentSpace ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${currentSpace.isOrganization ? 'bg-blue-500' : 'bg-green-500'}`} />
                    <div>
                      <h3 className="font-semibold text-lg">
                        {currentSpace.isPersonal ? "Personal Space" : currentSpace.name}
                      </h3>
                      <p className="text-sm text-gray-600">{currentSpace.code}</p>
                    </div>
                    <Badge variant={currentSpace.isOrganization ? "default" : "secondary"}>
                      {currentSpace.isOrganization ? "Organization" : "Personal"}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Currency:</span> {currentSpace.currency}
                    </div>
                    <div>
                      <span className="font-medium">Your Role:</span> {currentSpace.userRole}
                    </div>
                    <div>
                      <span className="font-medium">Type:</span> {currentSpace.type}
                    </div>
                    <div>
                      <span className="font-medium">Created:</span> {new Date(currentSpace.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500">No space selected</p>
              )}
            </CardContent>
          </Card>

          {/* Available Spaces */}
          <Card>
            <CardHeader>
              <CardTitle>Available Spaces</CardTitle>
              <CardDescription>
                All spaces you have access to
              </CardDescription>
            </CardHeader>
            <CardContent>
              {spaces && spaces.length > 0 ? (
                <div className="grid gap-3">
                  {spaces.map((space) => (
                    <div
                      key={space.id}
                      className={`p-4 rounded-lg border transition-colors ${
                        space.code === currentSpace?.code
                          ? 'bg-blue-50 border-blue-200'
                          : 'bg-white border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div 
                          className="flex items-center gap-3 flex-1 cursor-pointer"
                          onClick={() => switchSpace(space.code)}
                        >
                          <div className={`w-3 h-3 rounded-full ${space.isOrganization ? 'bg-blue-500' : 'bg-green-500'}`} />
                          <div>
                            <h4 className="font-medium">
                              {space.isPersonal ? "Personal Space" : space.name}
                            </h4>
                            <p className="text-sm text-gray-600">{space.code}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{space.userRole}</Badge>
                          {space.code === currentSpace?.code && (
                            <Badge variant="default">Current</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No spaces available</p>
              )}
            </CardContent>
          </Card>

          {/* Permissions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Current Space Permissions
              </CardTitle>
              <CardDescription>
                Your permissions in the current space
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${canManageUsers ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span className="text-sm">Manage Users</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${canManageSettings ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span className="text-sm">Manage Settings</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${canViewAnalytics ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span className="text-sm">View Analytics</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${canManageBudgets ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span className="text-sm">Manage Budgets</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Features */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                Available Features
              </CardTitle>
              <CardDescription>
                Features enabled in the current space
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${teamCollaboration ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span className="text-sm">Team Collaboration</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${advancedReporting ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span className="text-sm">Advanced Reporting</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${aiEnabled ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span className="text-sm">AI Features</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* NavDrawer */}
      <NavDrawer
        open={isMobileNavOpen}
        onClose={() => setIsMobileNavOpen(false)}
        onLogout={handleLogout}
        navItems={navItems}
        isMobile={true}
        showSpaceSwitcher={true}
      />

      {/* Grant Access Dialog */}
      <GrantAccessDialog 
        open={showGrantAccessDialog} 
        onOpenChange={setShowGrantAccessDialog} 
      />
    </div>
  );
}

