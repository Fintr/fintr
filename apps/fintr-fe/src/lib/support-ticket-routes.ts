export function supportTicketDetailHref(ticketId: string): string {
  return `/crm/requests/ticket?id=${encodeURIComponent(ticketId)}`;
}
