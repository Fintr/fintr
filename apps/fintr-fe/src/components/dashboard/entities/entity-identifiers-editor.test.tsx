import "fake-indexeddb/auto";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetLocalDbForTests } from "@/lib/local-db";
import {
  cacheEntitiesResponse,
  loadCachedEntityDetail,
  normalizeEntityRecords,
} from "@/services/entities/local-cache";

import { EntityIdentifiersEditor } from "./entity-identifiers-editor";

const apiPost = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@/hooks/useAuthApi", () => ({
  useAuthApi: () => ({
    api: {
      post: (...args: unknown[]) => apiPost(...args),
      delete: vi.fn(),
    },
  }),
}));

const renderEditor = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  return render(
    <EntityIdentifiersEditor
      entityId="merchant-1"
      entityName="1855"
      identifiers={[]}
    />,
    { wrapper },
  );
};

describe("EntityIdentifiersEditor", () => {
  beforeEach(async () => {
    apiPost.mockReset();
    localStorage.setItem("spaceCode", "SPACE_1");
    await resetLocalDbForTests();
    await cacheEntitiesResponse(
      "SPACE_1",
      normalizeEntityRecords([
        {
          id: "merchant-1",
          full_name: "1855",
          entity_type: "transaction",
        },
      ]),
    );
  });

  afterEach(async () => {
    localStorage.removeItem("spaceCode");
    await resetLocalDbForTests();
  });

  it("shows a saved identifier and keeps it in the local merchant cache", async () => {
    const user = userEvent.setup();
    apiPost.mockResolvedValue({
      data: {
        data: {
          id: "alias-1",
          label: "CORPORATION A",
          scannedName: "corporation a",
        },
      },
    });

    renderEditor();

    await user.type(screen.getByLabelText("Identifier text"), "CORPORATION A");
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(await screen.findByText("CORPORATION A")).toBeInTheDocument();
    expect(screen.queryByText(/No identifiers yet/)).not.toBeInTheDocument();

    const detail = await loadCachedEntityDetail("SPACE_1", "merchant-1");
    expect(detail?.identifiers).toEqual([
      {
        id: "alias-1",
        label: "CORPORATION A",
        scannedName: "corporation a",
      },
    ]);
  });
});
