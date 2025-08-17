import { AxiosInstance } from 'axios';
import { Ticket, TicketResponse } from './queries';

export interface CreateTicketPayload {
  title: string;
  description: string;
  ticketType: 'bug_report' | 'feature_request' | 'general_feedback' | 'help_request' | 'billing_issue' | 'account_issue' | 'other';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  images?: File[];
}

export interface CreateResponsePayload {
  message: string;
  images?: File[];
}

export interface UpdateTicketPayload {
  status?: 'open' | 'in_progress' | 'resolved' | 'dismissed';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
}

/**
 * Creates a new support ticket with optional image attachments
 * 
 * @param api - The authenticated Axios instance
 * @param payload - The ticket data including images
 * @returns Promise resolving to the created Ticket
 */
export const createTicket = async (
  api: AxiosInstance,
  payload: CreateTicketPayload
): Promise<Ticket> => {
  try {
    const formData = new FormData();
    
    // Add text fields
    formData.append('title', payload.title);
    formData.append('description', payload.description);
    formData.append('ticketType', payload.ticketType);
    formData.append('priority', payload.priority);
    
    // Add image files if present
    if (payload.images && payload.images.length > 0) {
      payload.images.forEach((image, index) => {
        formData.append('images[]', image);
      });
    }

    const response = await api.post('/crm/tickets', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data.data.ticket;
  } catch (error) {
    console.error('Error creating ticket:', error);
    throw error;
  }
};

/**
 * Creates a response to an existing ticket
 * 
 * @param api - The authenticated Axios instance
 * @param ticketId - The ID of the ticket to respond to
 * @param payload - The response content
 * @returns Promise resolving to the created TicketResponse
 */
export const createTicketResponse = async (
  api: AxiosInstance,
  ticketId: string,
  payload: CreateResponsePayload
): Promise<TicketResponse> => {
  try {
    // Use FormData if images are included
    if (payload.images && payload.images.length > 0) {
      const formData = new FormData();
      formData.append('message', payload.message);
      
      payload.images.forEach((image, index) => {
        formData.append('images[]', image);
      });

      const response = await api.post(`/crm/tickets/${ticketId}/responses`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data.data.response;
    } else {
      // Use JSON for text-only responses
      const response = await api.post(`/crm/tickets/${ticketId}/responses`, payload);
      return response.data.data.response;
    }
  } catch (error) {
    console.error('Error creating ticket response:', error);
    throw error;
  }
};

/**
 * Creates an admin response to an existing ticket
 * 
 * @param api - The authenticated Axios instance
 * @param ticketId - The ID of the ticket to respond to
 * @param payload - The response content
 * @returns Promise resolving to the created TicketResponse
 */
export const createAdminTicketResponse = async (
  api: AxiosInstance,
  ticketId: string,
  payload: CreateResponsePayload
): Promise<TicketResponse> => {
  try {
    // Use FormData if images are included
    if (payload.images && payload.images.length > 0) {
      const formData = new FormData();
      formData.append('message', payload.message);
      
      payload.images.forEach((image, index) => {
        formData.append('images[]', image);
      });

      const response = await api.post(`/crm/admin/tickets/${ticketId}/respond`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data.data.response;
    } else {
      // Use JSON for text-only responses
      const response = await api.post(`/crm/admin/tickets/${ticketId}/respond`, payload);
      return response.data.data.response;
    }
  } catch (error) {
    console.error('Error creating admin ticket response:', error);
    throw error;
  }
};

/**
 * Updates a ticket's status and/or priority (admin only)
 * 
 * @param api - The authenticated Axios instance
 * @param ticketId - The ID of the ticket to update
 * @param payload - The update data (status and/or priority)
 * @returns Promise resolving to the updated ticket
 */
export const updateAdminTicket = async (
  api: AxiosInstance,
  ticketId: string,
  payload: UpdateTicketPayload
): Promise<{ id: string }> => {
  try {
    const response = await api.patch(`/crm/admin/tickets/${ticketId}`, payload);
    return response.data.data;
  } catch (error) {
    console.error('Error updating admin ticket:', error);
    throw error;
  }
};
