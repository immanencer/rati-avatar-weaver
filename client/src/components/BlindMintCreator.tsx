import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";

interface BlindMintCreatorProps {
  disabled?: boolean;
  avatarIds: string[];
  tokenMint?: string;
  burnAmount?: number;
}

interface CreateCollectionResponse {
  candyMachineAddress: string;
  collectionAddress: string;
  message: string;
}

export function BlindMintCreator({ 
  disabled = false, 
  avatarIds,
  tokenMint,
  burnAmount = 1 
}: BlindMintCreatorProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string>("");

  const createMutation = useMutation({
    mutationFn: async () => {
      setError(""); // Clear any previous errors

      const response = await fetch("/api/create-blind-mint", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          avatarIds,
          tokenConfig: tokenMint ? {
            mint: tokenMint.trim(),
            amount: burnAmount
          } : undefined
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to create collection");
      }

      return response.json() as Promise<CreateCollectionResponse>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/collections"] });
      toast({
        title: "Collection Created",
        description: `Collection created successfully! Candy Machine Address: ${data.candyMachineAddress}`,
      });
      setLocation(`/mint`);
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      setError(errorMessage);
      toast({
        title: "Creation Failed",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-4">
      {error && (
        <div className="text-sm text-red-500">
          {error}
        </div>
      )}
      <Button
        variant="outline"
        size="sm"
        disabled={disabled || createMutation.isPending}
        onClick={() => createMutation.mutate()}
        className="w-full"
      >
        {createMutation.isPending ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Creating Collection...
          </>
        ) : (
          <>
            <Upload className="w-4 h-4 mr-2" />
            Create Blind Mint Collection
          </>
        )}
      </Button>
    </div>
  );
}