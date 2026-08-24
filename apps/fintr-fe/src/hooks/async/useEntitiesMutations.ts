import { useQueryClient } from "@tanstack/react-query";

import { useAuthApi } from "@/hooks/useAuthApi";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { createEntityLocalFirst } from "@/services/entities/create-local-first";
import {
  createEntity,
  updateEntity,
  type CreateEntityType,
  type UpdateEntityType,
} from "@/services/entities/mutation";
import { updateEntityLocalFirst } from "@/services/entities/update-local-first";

export const useEntitiesMutations = () => {
  const { api } = useAuthApi();
  const queryClient = useQueryClient();
  const [spaceCode] = useLocalStorage("spaceCode", "");

  const createEntityMutation = async (entityData: CreateEntityType) => {
    if (entityData.photo) {
      return createEntity(api, entityData);
    }

    const result = await createEntityLocalFirst(
      api,
      {
        spaceCode,
        data: entityData,
      },
      { queryClient, waitForSync: false },
    );

    return { data: result.data };
  };

  const updateEntityMutation = async (entityData: UpdateEntityType) => {
    if (entityData.photo || entityData.removePhoto) {
      return updateEntity(api, entityData);
    }

    const trimmedName = entityData.fullName?.trim();
    if (!trimmedName) {
      throw new Error("fullName is required to update an entity");
    }

    const result = await updateEntityLocalFirst(
      api,
      {
        spaceCode,
        entityId: entityData.id,
        fullName: trimmedName,
      },
      { queryClient, waitForSync: false },
    );

    return { data: result.data };
  };

  return {
    createEntity: createEntityMutation,
    updateEntity: updateEntityMutation,
  };
};
