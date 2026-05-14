import TicketDetailPage from "./ticket-detail-page";

export const dynamicParams = false;

export function generateStaticParams() {
  return [{ id: "__static_export__" }];
}

export default function CrmTicketDetailPage() {
  return <TicketDetailPage />;
}
