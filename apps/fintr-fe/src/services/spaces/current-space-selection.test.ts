import { describe, expect, it } from "vitest";

import type { Space } from "@/types/spaceTypes";

import {
  resolveCachedSpacesList,
  resolveCurrentSpace,
  shouldSkipSpacesNetworkFetch,
} from "./current-space-selection";

const space = (overrides: Partial<Space> & Pick<Space, "code" | "name">): Space =>
  ({
    id: overrides.code,
    type: "Spaces::PersonalSpace",
    currency: "PHP",
    isPersonal: true,
    isOrganization: false,
    userRole: "member",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    hasNewInvitation: false,
    isOwner: true,
    ownerId: "user-1",
    ...overrides,
  }) as Space;

describe("shouldSkipSpacesNetworkFetch", () => {
  it("still fetches when offline sync is ready but the cached membership list is empty", () => {
    expect(
      shouldSkipSpacesNetworkFetch({
        skipCachedNetwork: true,
        cachedSpaceCount: 0,
      }),
    ).toBe(false);
  });

  it("keeps the cached membership list when offline sync is ready and spaces are stored", () => {
    expect(
      shouldSkipSpacesNetworkFetch({
        skipCachedNetwork: true,
        cachedSpaceCount: 2,
      }),
    ).toBe(true);
  });

  it("fetches while the device still needs a network refresh", () => {
    expect(
      shouldSkipSpacesNetworkFetch({
        skipCachedNetwork: false,
        cachedSpaceCount: 2,
      }),
    ).toBe(false);
  });
});

describe("resolveCachedSpacesList", () => {
  it("keeps a published list when the IndexedDB read is still empty", () => {
    const published = [space({ code: "personal", name: "Miko & Ella Dagatan" })];

    expect(
      resolveCachedSpacesList({
        loaded: null,
        published,
      }),
    ).toEqual(published);
  });

  it("prefers the IndexedDB snapshot once it has spaces", () => {
    const loaded = [space({ code: "personal", name: "From disk" })];
    const published = [space({ code: "personal", name: "From memory" })];

    expect(
      resolveCachedSpacesList({
        loaded,
        published,
      }),
    ).toEqual(loaded);
  });
});

describe("resolveCurrentSpace", () => {
  const personal = space({
    code: "miguel-dagatan-gmail-com-personal-space",
    name: "Miko & Ella Dagatan",
    isPersonal: true,
    isOrganization: false,
  });
  const organization = space({
    code: "fintr",
    name: "Fintr",
    isPersonal: false,
    isOrganization: true,
    userRole: "admin",
  });

  it("selects the saved workspace once the membership list arrives", () => {
    expect(
      resolveCurrentSpace({
        spaces: [organization, personal],
        currentSpace: null,
        savedSpaceCode: personal.code,
      }),
    ).toEqual(personal);
  });

  it("replaces a saved code that does not exist after a database restore", () => {
    expect(
      resolveCurrentSpace({
        spaces: [organization, personal],
        currentSpace: null,
        savedSpaceCode: "old-local-space",
      }),
    ).toEqual(personal);
  });

  it("refreshes the current workspace when the list has a name and the atom does not", () => {
    expect(
      resolveCurrentSpace({
        spaces: [personal],
        currentSpace: { ...personal, name: "" },
        savedSpaceCode: personal.code,
      })?.name,
    ).toBe("Miko & Ella Dagatan");
  });
});
