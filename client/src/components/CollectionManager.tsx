import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2 } from "lucide-react";
import { useLocation } from "wouter";

interface Collection {
  _id: string;
  candyMachineAddress: string;
  collectionAddress: string;
  name: string;
  itemsAvailable: number;
  itemsRedeemed: number;
  isActive: boolean;
}

export function CollectionManager() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: collections, isLoading } = useQuery<Collection[]>({
    queryKey: ["/api/collections"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (address: string) => {
      const response = await fetch(`/api/collections/${address}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collections"] });
      toast({
        title: "Collection Deleted",
        description: "Collection has been successfully deleted",
      });
    },
    onError: (error) => {
      toast({
        title: "Deletion Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <CardHeader className="px-0">
        <CardTitle>Your Collections</CardTitle>
      </CardHeader>
      <div className="grid gap-4">
        {collections?.map((collection) => (
          <Card key={collection._id} className="relative">
            <CardContent className="pt-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-semibold">{collection.name}</h3>
                  <p className="text-sm text-gray-500">
                    {collection.itemsRedeemed} / {collection.itemsAvailable} minted
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {collection.candyMachineAddress}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLocation(`/mint`)}
                  >
                    View Mint
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteMutation.mutate(collection.candyMachineAddress)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {!collections?.length && (
          <p className="text-center text-gray-500 py-4">
            No collections found. Create one by selecting avatars and clicking "Create Blind Mint Collection".
          </p>
        )}
      </div>
    </div>
  );
}