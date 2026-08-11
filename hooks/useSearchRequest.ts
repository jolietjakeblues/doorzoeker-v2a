import { useCallback, useEffect, useRef, useState } from "react";
import type { Item } from "@/lib/heritage-view-model";

export type RemoteState = "idle" | "loading" | "error" | "success";

export function useSearchRequest() {
  const [remoteResults, setRemoteResults] = useState<Item[] | null>(null);
  const [remoteState, setRemoteState] = useState<RemoteState>("idle");
  const [resultPage, setResultPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const searchController = useRef<AbortController | null>(null);
  const searchSequence = useRef(0);

  const beginRequest = useCallback(() => {
    searchController.current?.abort();
    const controller = new AbortController();
    searchController.current = controller;
    const sequence = ++searchSequence.current;
    return {
      signal: controller.signal,
      isCurrent: () => sequence === searchSequence.current,
      isAborted: () => controller.signal.aborted,
    };
  }, []);

  useEffect(() => () => searchController.current?.abort(), []);

  return {
    remoteResults,
    setRemoteResults,
    remoteState,
    setRemoteState,
    resultPage,
    setResultPage,
    hasMore,
    setHasMore,
    loadingMore,
    setLoadingMore,
    beginRequest,
  };
}
