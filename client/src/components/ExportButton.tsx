import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface ExportButtonProps {
  disabled?: boolean;
  avatarIds: string[];
  tokenMint?: string;
  burnAmount?: number;
}

export function ExportButton({ 
  disabled, 
  avatarIds,
  tokenMint,
  burnAmount = 1 
}: ExportButtonProps) {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [isBlindMint, setIsBlindMint] = useState(true);

  const exportMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/export-to-candy-machine", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          avatarIds,
          tokenConfig: tokenMint ? {
            mint: tokenMint,
            amount: burnAmount
          } : undefined,
          isBlindMint
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Export Successful",
        description: `Files generated successfully for ${isBlindMint ? 'blind mint' : 'regular mint'} in the assets directory`,
      });
    },
    onError: (error) => {
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Switch
          id="blind-mint"
          checked={isBlindMint}
          onCheckedChange={setIsBlindMint}
        />
        <Label htmlFor="blind-mint">Enable Blind Mint</Label>
      </div>

      <Button
        variant="outline"
        size="sm"
        disabled={disabled || isExporting || exportMutation.isPending}
        onClick={() => exportMutation.mutate()}
        className="w-full"
      >
        <Upload className="w-4 h-4 mr-2" />
        Export to {isBlindMint ? 'Blind Mint' : 'Regular Mint'}
      </Button>
    </div>
  );
}