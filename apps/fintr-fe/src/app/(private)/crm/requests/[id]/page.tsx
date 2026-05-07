"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  MessageCircle,
  Calendar,
  User,
  Mail,
  Clock,
  Send,
  AlertCircle,
} from "lucide-react";
import { useTicket, useCreateTicketResponse, useUpdateAdminTicket } from "@/hooks/async/useTickets";
import { useAtomValue } from "jotai";
import { isAdminAtom } from "@/atoms/dashboardAtoms";
import ImageGallery from "@/components/crm/ImageGallery";
import ImageUploadInput from "@/components/crm/ImageUploadInput";
import LoadingSpinner from "@/components/ui/loading-spinner";
import ExpandableTextarea from "@/components/ui/expandable-textarea";
import { formatDateTime } from "@/utils/dateUtils";
import { ButtonLoader } from "@/components/ui/loading";

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const ticketId = params.id as string;

  const isAdmin = useAtomValue(isAdminAtom);

  const [replyText, setReplyText] = useState("");
  const [replyImages, setReplyImages] = useState<File[]>([]);

  const {
    data: ticket,
    isLoading,
    isError,
    refetch,
  } = useTicket(ticketId);

  const createResponseMutation = useCreateTicketResponse(ticketId);
  const updateTicketMutation = useUpdateAdminTicket(ticketId);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-blue-100/50 text-blue-800 hover:bg-blue-200 transition-colors";
      case "in_progress":
        return "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 transition-colors";
      case "resolved":
        return "bg-teal-200 text-green-800 hover:bg-teal-300 transition-colors";
      case "dismissed":
        return "bg-gray-100 text-gray-800 hover:bg-gray-200 transition-colors";
      default:
        return "bg-gray-100 text-gray-800 hover:bg-gray-200 transition-colors";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "bg-red-900/20 text-red-800 hover:bg-red-900/30 transition-colors";
      case "high":
        return "bg-orange-100 text-orange-800 hover:bg-orange-200 transition-colors";
      case "medium":
        return "bg-blue-100/50 text-blue-800 hover:bg-blue-200 transition-colors";
      case "low":
        return "bg-gray-100 text-gray-800 hover:bg-gray-200 transition-colors";
      default:
        return "bg-gray-100 text-gray-800 hover:bg-gray-200 transition-colors";
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim() && replyImages.length === 0) return;

    try {
      await createResponseMutation.mutateAsync({
        message: replyText.trim(),
        images: replyImages.length > 0 ? replyImages : undefined,
      });
      setReplyText("");
      setReplyImages([]);
    } catch (error) {
      console.error("Error sending reply:", error);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!isAdmin || !ticket) return;
    try {
      await updateTicketMutation.mutateAsync({ status: newStatus as any });
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const handlePriorityChange = async (newPriority: string) => {
    if (!isAdmin || !ticket) return;
    try {
      await updateTicketMutation.mutateAsync({ priority: newPriority as any });
    } catch (error) {
      console.error("Error updating priority:", error);
    }
  };

  const getResponseTypeColor = (type: string) => {
    switch (type) {
      case "admin_response":
        return "bg-primary/10 text-primary border-primary/20";
      case "system_update":
        return "bg-gray-100 text-gray-700 border-gray-200";
      default:
        return "bg-blue-50 text-blue-800 border-blue-200";
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex justify-center items-center py-12">
          <LoadingSpinner size="medium" />
        </div>
      </div>
    );
  }

  if (isError || !ticket) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Button variant="outline" onClick={() => router.push("/crm/requests")} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Tickets
        </Button>
        <Card>
          <CardContent className="p-4 text-center">
            <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <p className="text-red-900 mb-4">Failed to load ticket. Please try again.</p>
            <Button onClick={() => refetch()} variant="outline">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 pb-24 md:pb-8 max-w-4xl">
      {/* Back Button */}
      <Button variant="outline" onClick={() => router.push("/crm/requests")} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Tickets
      </Button>

      {/* Ticket Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold break-words">
          {ticket.title || "Untitled Ticket"}
        </h1>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <Badge className={getStatusColor(ticket.status || "open")}>
            {ticket.status?.replace("_", " ") || "Unknown"}
          </Badge>
          <Badge className={getPriorityColor(ticket.priority || "medium")}>
            {ticket.priority || "medium"}
          </Badge>
          <Badge variant="outline">{ticket.ticketType?.replace("_", " ") || "Unknown"}</Badge>
        </div>
      </div>

      {/* Admin Controls */}
      {isAdmin && (
        <Card className="mb-6 py-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Admin Controls</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium mb-1 block">Status</label>
                <Select value={ticket.status} onValueChange={handleStatusChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="dismissed">Dismissed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium mb-1 block">Priority</label>
                <Select value={ticket.priority} onValueChange={handlePriorityChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ticket Details */}
      <Card className="mb-6 py-0">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 text-sm text-gray-500 mb-4">
            <div className="flex items-center gap-1">
              <User className="h-4 w-4" />
              {isAdmin && ticket.userInfo ? ticket.userInfo.fullName : ticket.userName || "You"}
            </div>
            {isAdmin && ticket.userInfo && (
              <div className="flex items-center gap-1">
                <Mail className="h-4 w-4" />
                {ticket.userInfo.email}
              </div>
            )}
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {formatDateTime(ticket.createdAt)}
            </div>
            {ticket.updatedAt && ticket.updatedAt !== ticket.createdAt && (
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                Updated {formatDateTime(ticket.updatedAt)}
              </div>
            )}
          </div>

          <div className="prose prose-sm max-w-none">
            <p className="whitespace-pre-wrap break-words">{ticket.description || "No description provided."}</p>
          </div>

          {ticket.images && ticket.images.length > 0 && (
            <div className="mt-6">
              <ImageGallery images={ticket.images} title="Attachments" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Responses */}
      <div className="mb-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          Responses ({ticket.responses?.length || 0})
        </h2>

        {(!ticket.responses || ticket.responses.length === 0) ? (
          <Card className="py-0">
            <CardContent className="p-4 text-center text-gray-500">
              <MessageCircle className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p>No responses yet. Be the first to reply!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            {ticket.responses.map((response, index) => (
              <Card key={response.id || index} className="py-0">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={getResponseTypeColor(response.responseType)}>
                        {response.responseType?.replace("_", " ") || "Reply"}
                      </Badge>
                      {response.responderName && (
                        <span className="text-sm font-medium">{response.responderName}</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">{formatDateTime(response.createdAt)}</span>
                  </div>
                  <p className="text-gray-700 whitespace-pre-wrap break-words">{response.message}</p>
                  {response.images && response.images.length > 0 && (
                    <div className="mt-3">
                      <ImageGallery images={response.images} title="" variant="compact" />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Reply Form */}
      <Card className="py-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Add a Response</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="space-y-4">
            <div className="relative">
              <ExpandableTextarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Type your response..."
                className="min-h-[80px] max-h-[200px]"
                rows={3}
              />
            </div>

            <ImageUploadInput
              images={replyImages}
              onImagesChange={setReplyImages}
              variant="compact"
              maxImages={3}
              maxSizeInMB={10}
              disabled={createResponseMutation.isLoading}
            />

            <div className="flex justify-end">
              <Button
                onClick={handleSendReply}
                disabled={
                  createResponseMutation.isLoading ||
                  (!replyText.trim() && replyImages.length === 0)
                }
                className="bg-primary hover:bg-primary/90"
              >
                {createResponseMutation.isLoading ? (
                  <ButtonLoader text="Sending..." />
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Response
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
