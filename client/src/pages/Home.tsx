import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AvatarCard } from "@/components/AvatarCard";
import { Avatar } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useState } from "react";

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
  hasMore: boolean;
}

export function Home() {
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 12;
  const queryClient = useQueryClient();

  const { data, isLoading, isFetching, error } = useQuery<PaginatedResponse<Avatar>>({
    queryKey: ["/api/avatars", { page, limit: PAGE_SIZE }],
    queryFn: async ({ queryKey }) => {
      const [_key, { page, limit }] = queryKey;
      const response = await fetch(`/api/avatars?page=${page}&limit=${limit}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Network response was not ok");
      }
      return response.json();
    },
    keepPreviousData: true,
    staleTime: 5 * 60 * 1000, // 5 minutes
    onSuccess: (data) => {
      if (data.hasMore) {
        queryClient.prefetchQuery({
          queryKey: ["/api/avatars", { page: page + 1, limit: PAGE_SIZE }],
          queryFn: async ({ queryKey }) => {
            const [_key, { page, limit }] = queryKey;
            const response = await fetch(`/api/avatars?page=${page}&limit=${limit}`);
            if (!response.ok) {
              throw new Error("Network response was not ok");
            }
            return response.json();
          }
        });
      }
    }
  });

  const handlePreviousPage = () => {
    setPage((current) => Math.max(1, current - 1));
  };

  const handleNextPage = () => {
    if (data?.hasMore) {
      setPage((current) => current + 1);
    }
  };

  if (isLoading && !data) {
    // Show loader only when there's no data yet
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-900" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="container mx-auto py-8 px-4">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            Avatar Gallery
          </h1>
          {data?.total ? (
            <p className="text-sm text-gray-600 mt-4 md:mt-0">
              Showing {((page - 1) * PAGE_SIZE) + 1}-{Math.min(page * PAGE_SIZE, data.total)} of {data.total} avatars
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {data?.items.map((avatar) => (
            <AvatarCard
              key={avatar._id.toString()} // Ensure key is a string
              avatar={avatar}
            />
          ))}
          {data?.items.length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-500">
              No avatars found.
            </div>
          )}
        </div>

        {/* Pagination Controls */}
        {data && data.total > PAGE_SIZE && (
          <div className="mt-8 flex flex-col items-center justify-center gap-4">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={handlePreviousPage}
                disabled={page === 1 || isFetching}
                className="w-32 flex items-center justify-center"
                aria-label="Previous Page"
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>
              <span className="text-sm text-gray-600">
                Page {page} of {data.totalPages}
              </span>
              <Button
                variant="outline"
                onClick={handleNextPage}
                disabled={!data.hasMore || isFetching}
                className="w-32 flex items-center justify-center"
                aria-label="Next Page"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
            {isFetching && (
              <Loader2 className="h-5 w-5 animate-spin text-gray-600" />
            )}
          </div>
        )}
      </div>
      {/* Error Message */}
      {error && (
        <div className="fixed bottom-4 right-4 bg-red-100 text-red-700 p-4 rounded shadow">
          {error instanceof Error ? error.message : "Error loading avatars. Please try again later."}
        </div>
      )}
    </div>
  );
}
