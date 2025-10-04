"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { useAiInteractions, AiInteraction, AiInteractionStats } from "@/services/admin/ai-interactions";
import { formatDistanceToNow } from "date-fns";
import { Eye, Search, Filter, BarChart3, Users, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";

export default function AiInteractionsPage() {
  const { fetchAiInteractions, fetchAiInteractionStats } = useAiInteractions();
  const [interactions, setInteractions] = useState<AiInteraction[]>([]);
  const [stats, setStats] = useState<AiInteractionStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedInteraction, setSelectedInteraction] = useState<AiInteraction | null>(null);
  const [filters, setFilters] = useState({
    status: "all",
    search: "",
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const [interactionsResponse, statsResponse] = await Promise.all([
          fetchAiInteractions(),
          fetchAiInteractionStats(),
        ]);
        setInteractions(interactionsResponse.data);
        setStats(statsResponse.data);
      } catch (error) {
        console.error("Error loading AI interactions:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const handleFilterChange = async (newFilters: Partial<typeof filters>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    
    try {
      setIsLoading(true);
      const response = await fetchAiInteractions({
        status: updatedFilters.status === "all" ? undefined : updatedFilters.status,
      });
      setInteractions(response.data);
    } catch (error) {
      console.error("Error filtering interactions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failure":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "pending":
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      success: "default",
      failure: "destructive",
      pending: "secondary",
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || "secondary"}>
        {status}
      </Badge>
    );
  };

  if (isLoading && !stats) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
        <h1 className="text-2xl font-bold lg:text-3xl">AI Interactions</h1>
        <div className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-2">
          <Input
            placeholder="Search interactions..."
            value={filters.search}
            onChange={(e) => handleFilterChange({ search: e.target.value })}
            className="w-full sm:w-64"
          />
          <Select value={filters.status} onValueChange={(value) => handleFilterChange({ status: value === "all" ? "" : value })}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="failure">Failure</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="interactions">Interactions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {stats && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Interactions</CardTitle>
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.summary.total_interactions}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                    <CheckCircle className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.summary.success_rate}%</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.summary.total_tokens.toLocaleString()}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {stats.summary.avg_response_time ? `${stats.summary.avg_response_time}s` : "N/A"}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Top Users</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {stats.top_users.slice(0, 5).map((user, index) => (
                        <div key={index} className="flex justify-between items-center">
                          <span className="text-sm">{user.user}</span>
                          <Badge variant="secondary">{user.count}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Top Spaces</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {stats.top_spaces.slice(0, 5).map((space, index) => (
                        <div key={index} className="flex justify-between items-center">
                          <span className="text-sm">{space.space}</span>
                          <Badge variant="secondary">{space.count}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="interactions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Interactions</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <LoadingSpinner />
                </div>
              ) : (
                <>
                  {/* Mobile Card View */}
                  <div className="block lg:hidden space-y-4">
                    {interactions.map((interaction) => (
                      <Card key={interaction.id}>
                        <CardContent className="p-4">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                {getStatusIcon(interaction.status)}
                                {getStatusBadge(interaction.status)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Click request below
                              </div>
                            </div>
                            
                            <div>
                              <div className="font-medium text-sm mb-1">{interaction.user.name}</div>
                              <div className="text-xs text-muted-foreground mb-2">{interaction.user.email}</div>
                              <div className="text-sm text-muted-foreground mb-2">
                                Space: {interaction.space.name}
                              </div>
                              <Dialog>
                                <DialogTrigger asChild>
                                  <div className="text-sm truncate cursor-pointer hover:bg-muted p-2 rounded transition-colors" title="Click to view details">
                                    {interaction.request}
                                  </div>
                                </DialogTrigger>
                                <DialogContent className="max-w-4xl max-h-[80vh] w-[95vw] sm:w-full">
                                  <DialogHeader>
                                    <DialogTitle>AI Interaction Details</DialogTitle>
                                  </DialogHeader>
                                  <ScrollArea className="max-h-[60vh]">
                                    <div className="space-y-4">
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                          <h4 className="font-medium">User</h4>
                                          <p className="text-sm text-muted-foreground">
                                            {interaction.user.name} ({interaction.user.email})
                                          </p>
                                        </div>
                                        <div>
                                          <h4 className="font-medium">Space</h4>
                                          <p className="text-sm text-muted-foreground">
                                            {interaction.space.name} ({interaction.space.code})
                                          </p>
                                        </div>
                                      </div>

                                      <Separator />

                                      <div>
                                        <h4 className="font-medium mb-2">User Question</h4>
                                        <div className="bg-muted p-3 rounded-md">
                                          <p className="text-sm whitespace-pre-wrap">{interaction.request}</p>
                                        </div>
                                      </div>

                                      {interaction.enhanced_prompt && (
                                        <div>
                                          <h4 className="font-medium mb-2">Enhanced Prompt Sent to OpenAI</h4>
                                          <div className="bg-blue-50 border border-blue-200 p-3 rounded-md">
                                            <p className="text-sm whitespace-pre-wrap">{interaction.enhanced_prompt}</p>
                                          </div>
                                        </div>
                                      )}

                                      {interaction.response && (
                                        <div>
                                          <h4 className="font-medium mb-2">Response</h4>
                                          <div className="bg-muted p-3 rounded-md">
                                            <p className="text-sm whitespace-pre-wrap">{interaction.response}</p>
                                          </div>
                                        </div>
                                      )}

                                      {interaction.error && (
                                        <div>
                                          <h4 className="font-medium mb-2 text-red-600">Error</h4>
                                          <div className="bg-red-50 p-3 rounded-md">
                                            <p className="text-sm text-red-800">{interaction.error}</p>
                                          </div>
                                        </div>
                                      )}

                                      <Separator />

                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                          <h4 className="font-medium">Status</h4>
                                          <div className="flex items-center space-x-2 mt-1">
                                            {getStatusIcon(interaction.status)}
                                            {getStatusBadge(interaction.status)}
                                          </div>
                                        </div>
                                        <div>
                                          <h4 className="font-medium">Tokens Used</h4>
                                          <p className="text-sm text-muted-foreground">{interaction.tokens_used}</p>
                                        </div>
                                        <div>
                                          <h4 className="font-medium">Response Time</h4>
                                          <p className="text-sm text-muted-foreground">
                                            {interaction.time_seconds ? `${interaction.time_seconds}s` : "N/A"}
                                          </p>
                                        </div>
                                        <div>
                                          <h4 className="font-medium">Created</h4>
                                          <p className="text-sm text-muted-foreground">
                                            {new Date(interaction.created_at).toLocaleString()}
                                          </p>
                                        </div>
                                      </div>

                                      {interaction.metadata && Object.keys(interaction.metadata).length > 0 && (
                                        <div>
                                          <h4 className="font-medium mb-2">Metadata</h4>
                                          <div className="bg-muted p-3 rounded-md">
                                            <pre className="text-xs overflow-auto">
                                              {JSON.stringify(interaction.metadata, null, 2)}
                                            </pre>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </ScrollArea>
                                </DialogContent>
                              </Dialog>
                              <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                                <span>{interaction.tokens_used} tokens</span>
                                <span>{formatDistanceToNow(new Date(interaction.created_at), { addSuffix: true })}</span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden lg:block overflow-x-auto">
                    <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[120px]">User</TableHead>
                        <TableHead className="min-w-[120px] hidden sm:table-cell">Space</TableHead>
                        <TableHead className="min-w-[200px]">Request</TableHead>
                        <TableHead className="min-w-[100px]">Status</TableHead>
                        <TableHead className="min-w-[80px] hidden md:table-cell">Tokens</TableHead>
                        <TableHead className="min-w-[80px] hidden lg:table-cell">Time</TableHead>
                        <TableHead className="min-w-[100px] hidden lg:table-cell">Created</TableHead>
                        <TableHead className="min-w-[120px]">Info</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {interactions.map((interaction) => (
                        <TableRow key={interaction.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium text-sm">{interaction.user.name}</div>
                              <div className="text-xs text-muted-foreground hidden sm:block">{interaction.user.email}</div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <div>
                              <div className="font-medium text-sm">{interaction.space.name}</div>
                              <div className="text-xs text-muted-foreground">{interaction.space.code}</div>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[200px]">
                            <Dialog>
                              <DialogTrigger asChild>
                                <div className="truncate text-sm cursor-pointer hover:bg-muted p-2 rounded transition-colors" title="Click to view details">
                                  {interaction.request}
                                </div>
                              </DialogTrigger>
                              <DialogContent className="max-w-4xl max-h-[80vh] w-[95vw] sm:w-full">
                                <DialogHeader>
                                  <DialogTitle>AI Interaction Details</DialogTitle>
                                </DialogHeader>
                                <ScrollArea className="max-h-[60vh]">
                                  <div className="space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                      <div>
                                        <h4 className="font-medium">User</h4>
                                        <p className="text-sm text-muted-foreground">
                                          {interaction.user.name} ({interaction.user.email})
                                        </p>
                                      </div>
                                      <div>
                                        <h4 className="font-medium">Space</h4>
                                        <p className="text-sm text-muted-foreground">
                                          {interaction.space.name} ({interaction.space.code})
                                        </p>
                                      </div>
                                    </div>

                                    <Separator />

                                    <div>
                                      <h4 className="font-medium mb-2">User Question</h4>
                                      <div className="bg-muted p-3 rounded-md">
                                        <p className="text-sm whitespace-pre-wrap">{interaction.request}</p>
                                      </div>
                                    </div>

                                    {interaction.enhanced_prompt && (
                                      <div>
                                        <h4 className="font-medium mb-2">Enhanced Prompt Sent to OpenAI</h4>
                                        <div className="bg-blue-50 border border-blue-200 p-3 rounded-md">
                                          <p className="text-sm whitespace-pre-wrap">{interaction.enhanced_prompt}</p>
                                        </div>
                                      </div>
                                    )}

                                    {interaction.response && (
                                      <div>
                                        <h4 className="font-medium mb-2">Response</h4>
                                        <div className="bg-muted p-3 rounded-md">
                                          <p className="text-sm whitespace-pre-wrap">{interaction.response}</p>
                                        </div>
                                      </div>
                                    )}

                                    {interaction.error && (
                                      <div>
                                        <h4 className="font-medium mb-2 text-red-600">Error</h4>
                                        <div className="bg-red-50 p-3 rounded-md">
                                          <p className="text-sm text-red-800">{interaction.error}</p>
                                        </div>
                                      </div>
                                    )}

                                    <Separator />

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                      <div>
                                        <h4 className="font-medium">Status</h4>
                                        <div className="flex items-center space-x-2 mt-1">
                                          {getStatusIcon(interaction.status)}
                                          {getStatusBadge(interaction.status)}
                                        </div>
                                      </div>
                                      <div>
                                        <h4 className="font-medium">Tokens Used</h4>
                                        <p className="text-sm text-muted-foreground">{interaction.tokens_used}</p>
                                      </div>
                                      <div>
                                        <h4 className="font-medium">Response Time</h4>
                                        <p className="text-sm text-muted-foreground">
                                          {interaction.time_seconds ? `${interaction.time_seconds}s` : "N/A"}
                                        </p>
                                      </div>
                                      <div>
                                        <h4 className="font-medium">Created</h4>
                                        <p className="text-sm text-muted-foreground">
                                          {new Date(interaction.created_at).toLocaleString()}
                                        </p>
                                      </div>
                                    </div>

                                    {interaction.metadata && Object.keys(interaction.metadata).length > 0 && (
                                      <div>
                                        <h4 className="font-medium mb-2">Metadata</h4>
                                        <div className="bg-muted p-3 rounded-md">
                                          <pre className="text-xs overflow-auto">
                                            {JSON.stringify(interaction.metadata, null, 2)}
                                          </pre>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </ScrollArea>
                              </DialogContent>
                            </Dialog>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-1">
                              {getStatusIcon(interaction.status)}
                              <span className="hidden sm:inline">
                                {getStatusBadge(interaction.status)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-sm">
                            {interaction.tokens_used}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-sm">
                            {interaction.time_seconds > 0 ? `${interaction.time_seconds}s` : "N/A"}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-sm">
                            {formatDistanceToNow(new Date(interaction.created_at), { addSuffix: true })}
                          </TableCell>
                          <TableCell>
                            <div className="text-xs text-muted-foreground">
                              Click request to view details
                            </div>
                          </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
