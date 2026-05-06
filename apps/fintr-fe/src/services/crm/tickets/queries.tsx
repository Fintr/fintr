import { AxiosInstance } from 'axios';

export interface TicketResponse {
  id: string;
  message: string; // Backend field name is 'message'
  responseType: 'user_reply' | 'admin_response' | 'system_update'; // Transformed to camelCase
  responderName: string | null; // Transformed to camelCase
  createdAt: string; // Transformed to camelCase
  images?: any[]; // Backend sends image objects with url, filename, etc.
}

export interface UserInfo {
  id: string;
  fullName: string;
  email: string;
  spaceId?: string;
  createdAt: string;
}

export interface Ticket {
  id: string;
  title?: string;
  description?: string;
  status?: 'open' | 'in_progress' | 'resolved' | 'dismissed';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  ticketType?: 'bug_report' | 'feature_request' | 'general_feedback' | 'help_request' | 'billing_issue' | 'account_issue' | 'other'; // Transformed to camelCase
  userName?: string; // Regular user endpoint field
  userInfo?: UserInfo; // Admin endpoint field with full user details
  createdAt?: string; // Transformed to camelCase
  updatedAt?: string; // Transformed to camelCase
  images?: any[]; // Backend sends object with url, filename, etc.
  responses?: TicketResponse[];
}

export interface TicketsPage {
  tickets: Ticket[];
  currentPage: number;
  totalPages: number;
  totalCount: number;
}

/**
 * Fetches tickets for the current user with pagination and filtering
 * 
 * @param api - The authenticated Axios instance
 * @param page - Page number (default: 1)
 * @param status - Filter by status (optional)
 * @param type - Filter by type (optional)
 * @returns Promise resolving to TicketsPage
 */
export const fetchTicketsPage = async (
  api: AxiosInstance,
  {
    page = 1,
    status,
    type,
    searchQuery,
  }: {
    page?: number;
    status?: string;
    type?: string;
    searchQuery?: string;
  } = {}
): Promise<TicketsPage> => {
  try {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    
    if (status && status !== 'all') {
      params.append('status', status);
    }
    
    if (type && type !== 'all') {
      params.append('ticketType', type);
    }
    
    if (searchQuery && searchQuery.trim() !== '') {
      params.append('search_query', searchQuery.trim());
    }

    const response = await api.get(`/crm/tickets?${params.toString()}`);
    
    // Backend returns: { success: true, data: { tickets: [...], pagination: {...} } }
    const responseData = response.data.data;
    
    return {
      tickets: responseData.tickets,
      currentPage: responseData.pagination.currentPage,
      totalPages: responseData.pagination.totalPages,
      totalCount: responseData.pagination.totalCount,
    };
  } catch (error) {
    console.error('Error fetching tickets:', error);
    throw error;
  }
};

/**
 * Fetches ALL tickets for admin users with pagination and filtering
 * 
 * @param api - The authenticated Axios instance
 * @param page - Page number (default: 1)
 * @param status - Filter by status (optional)
 * @param type - Filter by type (optional)
 * @returns Promise resolving to TicketsPage
 */
export const fetchAdminTicketsPage = async (
  api: AxiosInstance,
  {
    page = 1,
    status,
    type,
    searchQuery,
  }: {
    page?: number;
    status?: string;
    type?: string;
    searchQuery?: string;
  } = {}
): Promise<TicketsPage> => {
  try {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    
    if (status && status !== 'all') {
      params.append('status', status);
    }
    
    if (type && type !== 'all') {
      params.append('ticketType', type);
    }
    
    if (searchQuery && searchQuery.trim() !== '') {
      params.append('search_query', searchQuery.trim());
    }

    const response = await api.get(`/crm/admin/tickets?${params.toString()}`);
    
    // Backend returns: { success: true, data: { tickets: [...], pagination: {...} } }
    const responseData = response.data.data;
    
    return {
      tickets: responseData.tickets,
      currentPage: responseData.pagination.currentPage,
      totalPages: responseData.pagination.totalPages,
      totalCount: responseData.pagination.totalCount,
    };
  } catch (error) {
    console.error('Error fetching admin tickets:', error);
    throw error;
  }
};

/**
 * Fetches a single ticket by ID with its responses
 * 
 * @param api - The authenticated Axios instance
 * @param ticketId - The ID of the ticket to fetch
 * @returns Promise resolving to Ticket
 */
export const fetchTicketById = async (
  api: AxiosInstance,
  ticketId: string
): Promise<Ticket> => {
  try {
    const response = await api.get(`/crm/tickets/${ticketId}`);
    return response.data.data; // Backend returns ticket data directly in 'data', not 'data.ticket'
  } catch (error) {
    console.error('Error fetching ticket by ID:', error);
    throw error;
  }
};

/**
 * Fetches a single ticket by ID for admin users with its responses
 * 
 * @param api - The authenticated Axios instance
 * @param ticketId - The ID of the ticket to fetch
 * @returns Promise resolving to Ticket
 */
export const fetchAdminTicketById = async (
  api: AxiosInstance,
  ticketId: string
): Promise<Ticket> => {
  try {
    const response = await api.get(`/crm/admin/tickets/${ticketId}`);
    return response.data.data; // Backend returns ticket data directly in 'data', not 'data.ticket'
  } catch (error) {
    console.error('Error fetching admin ticket by ID:', error);
    throw error;
  }
};
