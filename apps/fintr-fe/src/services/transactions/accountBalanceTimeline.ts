import { AxiosInstance } from "axios";

export type AccountBalanceTimelinePoint = {
  date: string;
  occurredAt?: string;
  balance: number;
  change: number | null;
};

export type AccountBalanceTimeline = {
  points: AccountBalanceTimelinePoint[];
  currency: string;
};

export type FetchAccountBalanceTimelineParams = {
  accountId: string;
  startDate: string;
  endDate: string;
  maxPoints?: number;
};

export const fetchAccountBalanceTimeline = async (
  api: AxiosInstance,
  params: FetchAccountBalanceTimelineParams,
): Promise<AccountBalanceTimeline> => {
  const { accountId, startDate, endDate, maxPoints } = params;

  const response = await api.get(
    `/transactions/accounts/${accountId}/balance_timeline`,
    {
      params: {
        startDate,
        endDate,
        ...(maxPoints !== undefined ? { maxPoints } : {}),
      },
    },
  );

  const data = response?.data?.data;
  const rawPoints = data?.points ?? [];

  return {
    points: rawPoints.map((point: AccountBalanceTimelinePoint) => ({
      date: point.date,
      occurredAt: point.occurredAt,
      balance: point.balance,
      change: point.change,
    })),
    currency: data?.currency ?? "PHP",
  };
};
