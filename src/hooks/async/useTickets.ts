import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthApi } from '@/hooks/useAuthApi';
import { fetchTicketsPage, fetchTicketById, fetchAdminTicketsPage, fetchAdminTicketById } from '@/services/crm/tickets/queries';
import { createTicket, createTicketResponse, createAdminTicketResponse, updateAdminTicket, CreateTicketPayload, CreateResponsePayload, UpdateTicketPayload } from '@/services/crm/tickets/mutations';
import { toast } from 'sonner';
import { useAtomValue } from 'jotai';
import { isAdminAtom } from '@/atoms/dashboardAtoms';

/**
 * Hook for fetching paginated tickets with filtering
 * For admin users, fetches all tickets. For regular users, fetches only their tickets.
 */
export const useTickets = ({
  page = 1,
  status,
  type,
  searchQuery,
}: {
  page?: number;
  status?: string;
  type?: string;
  searchQuery?: string;
} = {}) => {
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user",
  });
  
  const isAdmin = useAtomValue(isAdminAtom);

  return useQuery({
    queryKey: ['tickets', page, status, type, searchQuery, isAdmin ? 'admin' : 'user'],
    queryFn: () => {
      if (isAdmin) {
        return fetchAdminTicketsPage(api, { page, status, type, searchQuery });
      }
      return fetchTicketsPage(api, { page, status, type, searchQuery });
    },
    staleTime: 30000, // Consider data fresh for 30 seconds
  });
};

/**
 * Hook for fetching a single ticket by ID
 * For admin users, uses admin endpoint. For regular users, uses user endpoint.
 */
export const useTicket = (ticketId: string) => {
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user",
  });

  const isAdmin = useAtomValue(isAdminAtom);

  return useQuery({
    queryKey: ['ticket', ticketId, isAdmin ? 'admin' : 'user'],
    queryFn: () => {
      if (isAdmin) {
        return fetchAdminTicketById(api, ticketId);
      }
      return fetchTicketById(api, ticketId);
    },
    enabled: !!ticketId,
    staleTime: 30000,
  });
};

/**
 * Hook for creating a new ticket
 */
export const useCreateTicket = () => {
  const queryClient = useQueryClient();
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user",
  });

  return useMutation({
    mutationFn: (payload: CreateTicketPayload) => createTicket(api, payload),
    onSuccess: (data) => {
      // Invalidate tickets list to refresh the data
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      toast.success('Support ticket created successfully!');
      return data;
    },
    onError: (error: any) => {
      console.error('Error creating ticket:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to create ticket';
      toast.error(errorMessage);
    },
  });
};

/**
 * Hook for creating a response to a ticket
 */
export const useCreateTicketResponse = (ticketId: string) => {
  const queryClient = useQueryClient();
  const isAdmin = useAtomValue(isAdminAtom);
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user",
  });

  return useMutation({
    mutationFn: (payload: CreateResponsePayload) => {
      // Use admin endpoint if user is admin, otherwise use regular endpoint
      if (isAdmin) {
        return createAdminTicketResponse(api, ticketId, payload);
      } else {
        return createTicketResponse(api, ticketId, payload);
      }
    },
    onSuccess: (data) => {
      // Invalidate the specific ticket to refresh its responses
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] });
      // Also invalidate tickets list in case status changed
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      toast.success('Response sent successfully!');
      return data;
    },
    onError: (error: any) => {
      console.error('Error creating response:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to send response';
      toast.error(errorMessage);
    },
  });
};

/**
 * Hook for updating a ticket's status/priority (admin only)
 */
export const useUpdateAdminTicket = (ticketId: string) => {
  const queryClient = useQueryClient();
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user",
  });

  return useMutation({
    mutationFn: (payload: UpdateTicketPayload) => updateAdminTicket(api, ticketId, payload),
    onSuccess: (data) => {
      // Invalidate the specific ticket to refresh its data
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] });
      // Also invalidate tickets list in case status changed
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      toast.success('Ticket updated successfully!');
      return data;
    },
    onError: (error: any) => {
      console.error('Error updating ticket:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to update ticket';
      toast.error(errorMessage);
    },
  });
};
