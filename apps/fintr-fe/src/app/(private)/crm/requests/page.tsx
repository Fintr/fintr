"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Filter, MessageCircle, Calendar, User, Mail, Clock, Building } from 'lucide-react';
import { useTickets } from '@/hooks/async/useTickets';
import ImageGallery from '@/components/crm/ImageGallery';
import CreateTicketForm from './components/CreateTicketForm';
import LoadingSpinner from '@/components/ui/loading-spinner';
import { formatDateTime } from '@/utils/dateUtils';
import Link from 'next/link';
import { useAtomValue } from 'jotai';
import { isAdminAtom } from '@/atoms/dashboardAtoms';
import { useDebouncedValue, SEARCH_DEBOUNCE_MS } from '@/hooks/useDebouncedValue';

export default function CRMRequestsPage() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebouncedValue(searchQuery, SEARCH_DEBOUNCE_MS);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  const isAdmin = useAtomValue(isAdminAtom);

  // Ensure currentPage is always a valid number
  const safePage = Math.max(1, parseInt(currentPage.toString()) || 1);

  // Safe setter for currentPage that prevents NaN
  const setSafePage = (page: number | ((prev: number) => number)) => {
    if (typeof page === 'function') {
      setCurrentPage(prev => {
        const newPage = page(prev);
        return Math.max(1, parseInt(newPage.toString()) || 1);
      });
    } else {
      setCurrentPage(Math.max(1, parseInt(page.toString()) || 1));
    }
  };

  const {
    data: ticketsData,
    isLoading,
    isError,
    refetch
  } = useTickets({
    page: safePage,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    type: typeFilter !== 'all' ? typeFilter : undefined,
    searchQuery: debouncedSearchQuery.trim() || undefined,
  });

  useEffect(() => {
    setSafePage(1);
  }, [debouncedSearchQuery]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-blue-100/50 text-blue-800 hover:bg-blue-200 transition-colors';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 transition-colors';
      case 'resolved': return 'bg-teal-200 text-green-800 hover:bg-teal-300 transition-colors';
      case 'dismissed': return 'bg-gray-100 text-gray-800 hover:bg-gray-200 transition-colors';
      default: return 'bg-gray-100 text-gray-800 hover:bg-gray-200 transition-colors';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-900/20 text-red-800 hover:bg-red-900/30 transition-colors';
      case 'high': return 'bg-orange-100 text-orange-800 hover:bg-orange-200 transition-colors';
      case 'medium': return 'bg-blue-100/50 text-blue-800 hover:bg-blue-200 transition-colors';
      case 'low': return 'bg-gray-100 text-gray-800 hover:bg-gray-200 transition-colors';
      default: return 'bg-gray-100 text-gray-800 hover:bg-gray-200 transition-colors';
    }
  };

  const handleCreateSuccess = () => {
    setShowCreateForm(false);
    refetch();
  };

  if (showCreateForm) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <Button
            variant="outline"
            onClick={() => setShowCreateForm(false)}
            className="mb-6"
          >
            ← Back to Tickets
          </Button>
          <h1 className="text-3xl font-bold">Create Support Ticket</h1>
          <p className="text-gray-600 mt-2">
            Describe your issue or request and we'll help you as soon as possible.
          </p>
        </div>

        <Card>
          <CardContent className="p-5 md:p-6">
            <CreateTicketForm onSuccess={handleCreateSuccess} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 pb-24 md:pb-12 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Support Tickets</h1>
          <p className="text-gray-600 mt-2">
            View and manage your support requests
          </p>
        </div>

        <Button
          onClick={() => setShowCreateForm(true)}
          className="mt-4 md:mt-0 bg-primary hover:bg-primary/90"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Ticket
        </Button>
      </div>

      {/* Filters */}
      <Card className="mb-8">
        <CardContent className="p-5 md:p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search tickets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={(value) => {
                setStatusFilter(value);
                setSafePage(1);
              }}>
                <SelectTrigger className="w-40">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="dismissed">Dismissed</SelectItem>
                </SelectContent>
              </Select>

              <Select value={typeFilter} onValueChange={(value) => {
                setTypeFilter(value);
                setSafePage(1);
              }}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="general_feedback">General Feedback</SelectItem>
                  <SelectItem value="bug_report">Bug Report</SelectItem>
                  <SelectItem value="feature_request">Feature Request</SelectItem>
                  <SelectItem value="help_request">Help Request</SelectItem>
                  <SelectItem value="billing_issue">Billing Issue</SelectItem>
                  <SelectItem value="account_issue">Account Issue</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tickets List */}
      {isLoading ? (
        <div className="flex justify-center items-center py-16">
          <LoadingSpinner size="medium" />
        </div>
      ) : isError ? (
        <Card>
          <CardContent className="p-6 md:p-8 text-center">
            <p className="text-red-900 mb-4">Failed to load tickets. Please try again.</p>
            <Button onClick={() => refetch()} variant="outline">
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : !ticketsData?.tickets?.length ? (
        <Card>
          <CardContent className="p-6 md:p-8 text-center">
            <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No tickets found</h3>
            <p className="text-gray-500 mb-5">
              {debouncedSearchQuery.trim() || statusFilter !== 'all' || typeFilter !== 'all'
                ? 'Try adjusting your filters or search query to see more results.'
                : 'You haven\'t created any support tickets yet.'}
            </p>
            <Button onClick={() => setShowCreateForm(true)}>
              Create your first ticket
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-5">
          {ticketsData.tickets.map((ticket) => (
            <Link key={ticket.id} href={`/crm/requests/${ticket.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-5 md:p-6">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex-1">
                      {/* Title */}
                      <div className="mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 hover:text-primary mb-2">
                          {ticket.title || 'Untitled'}
                        </h3>

                        {/* Badges below title for mobile, inline for desktop */}
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={getStatusColor(ticket.status || 'open')}>
                            {ticket.status?.replace('_', ' ') || 'Unknown'}
                          </Badge>
                          <Badge className={getPriorityColor(ticket.priority || 'medium')}>
                            {ticket.priority || 'medium'}
                          </Badge>
                          <Badge variant="outline">
                            {ticket.ticketType?.replace('_', ' ') || 'Unknown'}
                          </Badge>
                          {ticket.images && ticket.images.length > 0 && (
                            <Badge variant="outline" className="text-blue-600">
                              {ticket.images.length} image{ticket.images.length !== 1 ? 's' : ''}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* User details - responsive layout */}
                      <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <User className="h-4 w-4" />
                          {isAdmin && ticket.userInfo ? ticket.userInfo.fullName : ticket.userName}
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


                        {ticket.responses && ticket.responses.length > 0 && (
                          <div className="flex items-center gap-1">
                            <MessageCircle className="h-4 w-4" />
                            {ticket.responses.length} response{ticket.responses.length !== 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}

          {/* Pagination */}
          {ticketsData && ticketsData.totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8">
              {/* Page info */}
              <div className="text-sm text-gray-700">
                Showing page {currentPage || 1} of {ticketsData?.totalPages || 1} ({ticketsData?.totalCount || 0} total tickets)
              </div>
              
              {/* Pagination controls */}
              <div className="flex items-center gap-1">
                {/* First page button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSafePage(1)}
                  disabled={(currentPage || 1) === 1}
                  className="hidden sm:flex"
                >
                  First
                </Button>
                
                {/* Previous button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSafePage(prev => Math.max(1, (prev || 1) - 1))}
                  disabled={(currentPage || 1) === 1}
                >
                  Previous
                </Button>
                
                {/* Page numbers */}
                <div className="flex items-center gap-1 mx-2">
                  {(() => {
                    const totalPages = ticketsData?.totalPages || 1;
                    const current = currentPage || 1;
                    const pages = [];
                    
                    // Safety check
                    if (!totalPages || totalPages < 1) return null;
                    
                    // Always show first page
                    if (current > 3) {
                      pages.push(
                        <Button
                          key={1}
                          variant={1 === current ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSafePage(1)}
                          className="w-8 h-8 p-0"
                        >
                          1
                        </Button>
                      );
                      
                      if (current > 4) {
                        pages.push(
                          <span key="ellipsis1" className="px-2 text-gray-500">
                            ...
                          </span>
                        );
                      }
                    }
                    
                    // Show pages around current page
                    const start = Math.max(1, current - 1);
                    const end = Math.min(totalPages, current + 1);
                    
                    for (let i = start; i <= end; i++) {
                      pages.push(
                        <Button
                          key={i}
                          variant={i === current ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSafePage(i)}
                          className="w-8 h-8 p-0"
                        >
                          {i}
                        </Button>
                      );
                    }
                    
                    // Always show last page
                    if (current < totalPages - 2) {
                      if (current < totalPages - 3) {
                        pages.push(
                          <span key="ellipsis2" className="px-2 text-gray-500">
                            ...
                          </span>
                        );
                      }
                      
                      pages.push(
                        <Button
                          key={totalPages}
                          variant={totalPages === current ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSafePage(totalPages)}
                          className="w-8 h-8 p-0"
                        >
                          {totalPages}
                        </Button>
                      );
                    }
                    
                    return pages;
                  })()}
                </div>
                
                {/* Next button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSafePage(prev => Math.min(ticketsData?.totalPages || 1, (prev || 1) + 1))}
                  disabled={currentPage >= (ticketsData?.totalPages || 1)}
                >
                  Next
                </Button>
                
                {/* Last page button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSafePage(ticketsData?.totalPages || 1)}
                  disabled={currentPage >= (ticketsData?.totalPages || 1)}
                  className="hidden sm:flex"
                >
                  Last
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
