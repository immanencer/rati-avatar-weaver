import { useArConnect } from "@/components/ArConnectProvider";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Avatar } from "@/lib/types";
import { AvatarCard } from "@/components/AvatarCard";
import { WalletConnect } from "@/components/WalletConnect";
import { useEffect, useRef } from "react";

interface PaginatedResponse {
  items: Avatar[];
  total: number;
  page: number;
  totalPages: number;
  hasMore: boolean;
}

export function Collection() {
  const { connected, address } = useArConnect();
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // Fetch only imprinted avatars for the connected wallet
  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<PaginatedResponse>({
    queryKey: ["/api/avatars", { address, filter: "imprinted" }],
    enabled: !!address,
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.page + 1 : undefined,
    queryFn: async ({ pageParam = 1 }) => {
      const response = await fetch(`/api/avatars?page=${pageParam}&address=${address}&filter=imprinted`);
      if (!response.ok) {
        throw new Error("Failed to fetch avatars");
      }
      return response.json();
    },
  });

  useEffect(() => {
    if (!loadMoreRef.current || !hasNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchNextPage();
        }
      },
      { threshold: 1.0 }
    );

    observer.observe(loadMoreRef.current);

    return () => {
      if (loadMoreRef.current) {
        observer.unobserve(loadMoreRef.current);
      }
    };
  }, [fetchNextPage, hasNextPage]);

  if (!connected) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Connect Your Wallet</h1>
          <p className="text-gray-600">
            Connect your wallet to view your imprinted avatars
          </p>
          <WalletConnect />
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  const avatars = data?.pages.flatMap((page) => page.items) || [];

  return (
    <div className="space-y-6 py-4 px-4 sm:px-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
          Your Imprinted Avatars
        </h1>
      </div>

      {/* Avatar Grid */}
      <div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {avatars.map((avatar: Avatar) => (
            <div key={avatar._id} className="relative">
              <AvatarCard avatar={avatar} />
            </div>
          ))}
          {!avatars.length && (
            <div className="col-span-full text-center py-8 text-gray-500">
              No imprinted avatars found in your collection.
            </div>
          )}
        </div>
        {isFetchingNextPage && (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-900"></div>
          </div>
        )}
        <div ref={loadMoreRef} />
      </div>
    </div>
  );
}
