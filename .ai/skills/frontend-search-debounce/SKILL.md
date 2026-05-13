# Frontend search debouncing

Use when adding or changing search inputs, filters that hit the API, or any text field where each keystroke would trigger a network request or expensive refetch.

## Rules

1. **Delay:** Use **300ms** (`SEARCH_DEBOUNCE_MS` from `@/hooks/useDebouncedValue`) unless product explicitly asks otherwise.
2. **Hook:** Prefer `useDebouncedValue(rawSearch, SEARCH_DEBOUNCE_MS)` and pass the debounced string into React Query params, `fetch` calls, or `useCallback` dependencies that load data. Keep the raw string bound to the `<Input />` for responsive typing.
3. **Immediate clear / flush:** On “Clear”, update both the input and the value used for queries immediately (do not wait for debounce). Optionally flush on **Enter** or **blur** by setting the query value from the raw input so users do not wait 300ms when leaving the field.
4. **Client-only lists:** Debouncing is optional but still useful for large in-memory lists to avoid filtering on every frame; same 300ms constant is fine.
5. **Combobox / backend `ComboBox`:** Default debounce is already 300ms in `components/ui/combobox.tsx`; pass `debounceTime={SEARCH_DEBOUNCE_MS}` if you override props for consistency.

## Anti-pattern

Driving `queryKey` or `useEffect` fetch deps directly from `onChange` state without debouncing (one request per character).

## Reference implementations

- `apps/fintr-fe/src/hooks/useDebouncedValue.ts`
- Admin weekly check-in space name filter, CRM tickets search, admin users search, transactions tab search, admin AI interactions (status still refetches immediately; search is client filter on debounced text).
