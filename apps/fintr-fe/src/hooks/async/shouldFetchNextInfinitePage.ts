/**
 * Gate for IntersectionObserver-driven infinite scroll.
 * Without `isFetchNextPageError`, a visible sentinel + hasNextPage will
 * re-fire fetchNextPage in a tight loop after network failures.
 */
export const shouldFetchNextInfinitePage = (params: {
  isIntersecting: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
}): boolean => {
  const {
    isIntersecting,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
  } = params;

  return (
    isIntersecting &&
    hasNextPage &&
    !isFetchingNextPage &&
    !isFetchNextPageError
  );
};
