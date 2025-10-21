import { fetchMessagesPage } from "@/services/conversations/api";
import useAuthApi from "../useAuthApi";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { parseContentWithInlineCharts } from "@/utils/chartParser";

export const useInfiniteMessages = ({
  conversationId,
  loadMoreRef,
}: {
  conversationId: string | null;
  loadMoreRef: React.RefObject<HTMLDivElement | null>;
}) => {
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions read:ai_usage",
  });

  const [hasUserScrolled, setHasUserScrolled] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);


  // Debug when hasUserScrolled changes
  useEffect(() => {
    console.log("hasUserScrolled changed to:", hasUserScrolled);
  }, [hasUserScrolled]);



  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    status,
    isError,
    isSuccess,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["messages", conversationId],
    queryFn: ({ pageParam = 1, queryKey }) => {
      if (pageParam === 2) { setHasInitialized(true); }
      return fetchMessagesPage(api, { pageParam, queryKey })
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled: !!conversationId && !!api && (hasUserScrolled || !hasInitialized),
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 30000, // 30 seconds
    cacheTime: 300000, // 5 minutes
  });


  useEffect(() => {
    // Only set up intersection observer after user has scrolled
    if (!hasUserScrolled) {
      console.log("Waiting for user scroll before setting up intersection observer");
      return;
    }

    console.log("Setting up intersection observer, hasUserScrolled:", hasUserScrolled);
    const observer = new IntersectionObserver(
      (entries) => {
        console.log("Messages intersection observer triggered:", {
          isIntersecting: entries[0].isIntersecting,
          hasNextPage,
          isFetchingNextPage,
          hasUserScrolled
        });
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          console.log("Fetching next page for messages...");
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    const currentRef = loadMoreRef.current;
    console.log("Load more ref found:", !!currentRef);
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, loadMoreRef, hasUserScrolled]);

  // Flatten all messages from all pages and process them
  const allMessages = data?.pages.flatMap((page: any) => 
    page.messages.map((msg: any) => {
      // Process messages to handle chart parsing
      if (msg.openaiRole === 'assistant' && msg.content) {
        const segments = parseContentWithInlineCharts(msg.content);
        const hasCharts = segments.some(segment => segment.type === 'chart');
        
        return {
          id: msg.id,
          content: msg.content,
          openaiRole: msg.openaiRole,
          createdAt: msg.createdAt,
          metadata: msg.metadata,
          segments: hasCharts ? segments : undefined,
        };
      }
      return {
        id: msg.id,
        content: msg.content,
        openaiRole: msg.openaiRole,
        createdAt: msg.createdAt,
        metadata: msg.metadata,
      };
    })
  ) || [];


  return {
    messages: allMessages,
    error,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    status,
    isError,
    isSuccess,
    refetch,
    setHasUserScrolled,
    setHasInitialized
  };
};
  