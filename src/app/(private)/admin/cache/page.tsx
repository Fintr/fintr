"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthApi } from "@/hooks/useAuthApi";
import { getAdminCacheVersion, clearAppCache } from "@/services/admin/cache";
import { toast } from "sonner";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { RefreshCw, Trash2 } from "lucide-react";

export default function AdminCachePage() {
  const { getToken } = useAuthApi();
  const [version, setVersion] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  const loadVersion = async () => {
    setLoading(true);
    try {
      const data = await getAdminCacheVersion(getToken);
      setVersion(data.cacheVersion);
      setUpdatedAt(data.updatedAt ?? null);
    } catch (e) {
      toast.error("Failed to load cache version");
      setVersion(null);
      setUpdatedAt(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVersion();
  }, []);

  const handleClearCache = async () => {
    setClearing(true);
    try {
      const data = await clearAppCache(getToken);
      setVersion(data.cacheVersion);
      setUpdatedAt(data.updatedAt);
      toast.success(
        "Cache cleared. All iOS and Android apps will refresh on next load or when they check for updates."
      );
    } catch (e) {
      toast.error("Failed to clear cache");
    } finally {
      setClearing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>App cache</CardTitle>
        <CardDescription>
          Clear cache for all mobile apps (iOS and Android). After clearing, apps will load fresh
          content on next launch or when they check for updates.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">Current cache version</p>
            <p className="font-mono text-lg">{version ?? "—"}</p>
            {updatedAt && (
              <p className="text-xs text-muted-foreground mt-1">
                Last updated: {new Date(updatedAt).toLocaleString()}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadVersion}
              disabled={loading}
              aria-label="Refresh version"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleClearCache}
              disabled={clearing}
              aria-label="Clear cache for all apps"
            >
              {clearing ? (
                <LoadingSpinner className="h-4 w-4 mr-1" />
              ) : (
                <Trash2 className="h-4 w-4 mr-1" />
              )}
              Clear cache for all apps
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
