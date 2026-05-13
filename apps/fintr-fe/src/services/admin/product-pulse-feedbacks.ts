import { AxiosInstance } from "axios";

export type ProductPulseFeedbackRow = {
  id: string;
  periodKey: string;
  likedAreas: string[];
  improveAreas: string[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string | null;
    fullName: string | null;
  };
  space: {
    id: string;
    name: string;
    code: string;
  };
};

export type ProductPulseFeedbacksListResponse = {
  success: boolean;
  data: {
    productPulseFeedbacks: ProductPulseFeedbackRow[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalCount: number;
    };
  };
};

/** Normalizes API payloads where jsonb arrays may arrive as objects or JSON strings. */
export function coerceFeedbackAreaIds(value: unknown): string[] {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .map((v) => String(v).trim())
          .filter((s) => s.length > 0),
      ),
    );
  }
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    const keys = Object.keys(o);
    if (keys.length > 0 && keys.every((k) => /^\d+$/.test(k))) {
      return Array.from(
        new Set(
          keys
            .sort((a, b) => Number(a) - Number(b))
            .map((k) => String(o[k]).trim())
            .filter((s) => s.length > 0),
        ),
      );
    }
    return coerceFeedbackAreaIds(Object.values(o));
  }
  if (typeof value === "string") {
    const t = value.trim();
    if (!t) {
      return [];
    }
    try {
      return coerceFeedbackAreaIds(JSON.parse(t) as unknown);
    } catch {
      return [t];
    }
  }
  return [];
}

function readField(raw: Record<string, unknown>, camelKey: string, snakeKey: string): unknown {
  const camel = raw[camelKey];
  if (camel != null) {
    return camel;
  }
  return raw[snakeKey];
}

export function normalizeProductPulseFeedbackRow(raw: Record<string, unknown>): ProductPulseFeedbackRow {
  const userRaw = (readField(raw, "user", "user") ?? {}) as Record<string, unknown>;
  const spaceRaw = (readField(raw, "space", "space") ?? {}) as Record<string, unknown>;
  return {
    id: String(readField(raw, "id", "id") ?? ""),
    periodKey: String(readField(raw, "periodKey", "period_key") ?? ""),
    likedAreas: coerceFeedbackAreaIds(readField(raw, "likedAreas", "liked_areas")),
    improveAreas: coerceFeedbackAreaIds(readField(raw, "improveAreas", "improve_areas")),
    notes: (readField(raw, "notes", "notes") as string | null | undefined) ?? null,
    createdAt: String(readField(raw, "createdAt", "created_at") ?? ""),
    updatedAt: String(readField(raw, "updatedAt", "updated_at") ?? ""),
    user: {
      id: String(readField(userRaw, "id", "id") ?? ""),
      email: (readField(userRaw, "email", "email") as string | null) ?? null,
      fullName: (readField(userRaw, "fullName", "full_name") as string | null) ?? null,
    },
    space: {
      id: String(readField(spaceRaw, "id", "id") ?? ""),
      name: (readField(spaceRaw, "name", "name") as string | null) ?? "",
      code: (readField(spaceRaw, "code", "code") as string | null) ?? "",
    },
  };
}

export const fetchAdminProductPulseFeedbacks = async (
  api: AxiosInstance,
  params?: {
    spaceName?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    perPage?: number;
  },
): Promise<ProductPulseFeedbacksListResponse> => {
  const search = new URLSearchParams();
  if (params?.spaceName?.trim()) {
    search.set("space_name", params.spaceName.trim());
  }
  if (params?.startDate) {
    search.set("start_date", params.startDate);
  }
  if (params?.endDate) {
    search.set("end_date", params.endDate);
  }
  if (params?.page != null) {
    search.set("page", String(params.page));
  }
  if (params?.perPage != null) {
    search.set("per_page", String(params.perPage));
  }
  const q = search.toString();
  const url = q ? `/admin/product_pulse_feedbacks?${q}` : "/admin/product_pulse_feedbacks";
  const response = await api.get<ProductPulseFeedbacksListResponse>(url);
  const body = response.data;
  const rows = body.data.productPulseFeedbacks.map((r) =>
    normalizeProductPulseFeedbackRow(r as unknown as Record<string, unknown>),
  );
  return {
    ...body,
    data: {
      ...body.data,
      productPulseFeedbacks: rows,
    },
  };
};
