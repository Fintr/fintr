import type { AxiosInstance } from "axios";

import type { IndexTransaction } from "@/types/transactionTypes";
import { ScheduleTypeEnum } from "@/constants/transactionConstants";
import {
  cacheTransactionDetail,
  loadCachedTransactionDetail,
  normalizeTransactionEditDetail,
} from "@/services/transactions/detail-local";
import { loadLocalIndexTransactionById } from "@/services/transactions/local-cache";
import { fetchTransactionById } from "@/services/transactions/queries";
import { fetchTransferById } from "@/services/transactions/transfers/queries";
import { resolveRootParentId } from "@/utils/recurringSchedule";

const isRecurringScheduleType = (scheduleType?: string | null): boolean =>
  scheduleType === ScheduleTypeEnum.REPEAT
  || scheduleType === ScheduleTypeEnum.INSTALLMENT
  || scheduleType === "repeat"
  || scheduleType === "installment";

export const enrichTransactionsWithSeriesSchedule = async (
  spaceId: string,
  rows: IndexTransaction[],
  api?: AxiosInstance | null,
): Promise<IndexTransaction[]> => {
  if (!spaceId || rows.length === 0) {
    return rows;
  }

  const rootIds = new Set<string>();
  rows.forEach((row) => {
    const rootId = resolveRootParentId(row);
    if (rootId) {
      rootIds.add(rootId);
    }
  });

  const scheduleByRoot = new Map<
    string,
    {
      repeatInterval?: string;
      scheduleType?: string;
      installmentPeriod?: number;
    }
  >();

  for (const rootId of rootIds) {
    let repeatInterval = "";
    let scheduleType: string | undefined;
    let installmentPeriod: number | undefined;

    const cached = await loadCachedTransactionDetail(spaceId, rootId);
    const normalized = normalizeTransactionEditDetail(cached);
    if (normalized?.repeatInterval?.trim()) {
      repeatInterval = normalized.repeatInterval.trim();
      scheduleType = normalized.scheduleType;
    }
    if (normalized?.installmentPeriod && normalized.installmentPeriod > 0) {
      installmentPeriod = normalized.installmentPeriod;
      scheduleType = normalized.scheduleType ?? scheduleType;
    }

    if (!repeatInterval) {
      const rootRow = await loadLocalIndexTransactionById(spaceId, rootId);
      if (rootRow?.repeatInterval?.trim()) {
        repeatInterval = rootRow.repeatInterval.trim();
      }
      if (rootRow?.scheduleType && isRecurringScheduleType(rootRow.scheduleType)) {
        scheduleType = rootRow.scheduleType;
      }
      if (rootRow?.installmentPeriod && rootRow.installmentPeriod > 0) {
        installmentPeriod = rootRow.installmentPeriod;
      }
    }

    if ((!repeatInterval && !installmentPeriod) && api) {
      try {
        const payload = await fetchTransactionById(api, rootId);
        await cacheTransactionDetail(spaceId, rootId, payload);
        const normalized = normalizeTransactionEditDetail(payload);
        if (normalized?.repeatInterval?.trim()) {
          repeatInterval = normalized.repeatInterval.trim();
          scheduleType = normalized.scheduleType;
        }
        if (normalized?.installmentPeriod && normalized.installmentPeriod > 0) {
          installmentPeriod = normalized.installmentPeriod;
          scheduleType = normalized.scheduleType ?? scheduleType;
        }
      } catch {
        try {
          const payload = await fetchTransferById(api, rootId);
          await cacheTransactionDetail(spaceId, rootId, payload);
          const normalized = normalizeTransactionEditDetail(payload);
          if (normalized?.repeatInterval?.trim()) {
            repeatInterval = normalized.repeatInterval.trim();
            scheduleType = normalized.scheduleType;
          }
          if (normalized?.installmentPeriod && normalized.installmentPeriod > 0) {
            installmentPeriod = normalized.installmentPeriod;
            scheduleType = normalized.scheduleType ?? scheduleType;
          }
        } catch {
          // Root may be unavailable offline.
        }
      }
    }

    if (repeatInterval || scheduleType || installmentPeriod) {
      scheduleByRoot.set(rootId, {
        repeatInterval: repeatInterval || undefined,
        scheduleType,
        installmentPeriod,
      });
    }
  }

  return rows.map((row) => {
    const rootId = resolveRootParentId(row);
    if (!rootId) {
      return row;
    }

    const schedule = scheduleByRoot.get(rootId);
    if (!schedule) {
      return {
        ...row,
        rootParentId: row.rootParentId ?? rootId,
      };
    }

    return {
      ...row,
      rootParentId: row.rootParentId ?? rootId,
      repeatInterval:
        row.repeatInterval?.trim()
          ? row.repeatInterval
          : schedule.repeatInterval,
      scheduleType: row.scheduleType ?? schedule.scheduleType,
      installmentPeriod:
        row.installmentPeriod && row.installmentPeriod > 0
          ? row.installmentPeriod
          : schedule.installmentPeriod,
    };
  });
};
