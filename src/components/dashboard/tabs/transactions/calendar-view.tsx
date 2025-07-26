import { TransactionsPage } from "@/types/transactionTypes";
import LoadingSpinner from "@/components/ui/loading-spinner";

interface CalendarViewProps {
  isPending: boolean;
  isError: boolean;
  error: Error | null;
  isSuccess: boolean;
}

export function CalendarView({
  isPending,
  isError,
  error,
  isSuccess,
}: CalendarViewProps) {
  return (
    <div className="mt-4">
      <div className="grid grid-cols-7 gap-1 mb-2 text-center">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day} className="text-sm font-medium text-primary">
            {day}
          </div>
        ))}
      </div>
      {isPending && (
        <div className="text-center p-4">
          <LoadingSpinner size="medium" />
        </div>
      )}
      {isError && (
        <div className="text-center p-4 text-red-500">
          Error: {error?.message}
        </div>
      )}
      {isSuccess && (
        <div className="text-center p-4 text-gray-500">
          Calendar view needs update for infinite data structure.
        </div>
      )}
    </div>
  );
}
