import { AxiosInstance } from "axios";

export type CreateProductPulseFeedbackPayload = {
  likedAreas: string[];
  improveAreas: string[];
  notes?: string;
};

export const createProductPulseFeedback = async (
  api: AxiosInstance,
  payload: CreateProductPulseFeedbackPayload
): Promise<void> => {
  await api.post("/product_pulse_feedbacks", {
    liked_areas: payload.likedAreas,
    improve_areas: payload.improveAreas,
    notes: payload.notes?.trim() || undefined,
  });
};
