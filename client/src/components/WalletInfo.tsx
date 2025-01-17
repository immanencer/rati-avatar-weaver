import { useQuery } from "@tanstack/react-query";
import { Wallet } from "lucide-react";

interface WalletData {
  address: string;
  balance: string;
}

export function WalletInfo() {
  const { data: walletInfo, isLoading } = useQuery<WalletData>({
    queryKey: ["/api/wallet"],
  });

  return (
    <div className="bg-primary/5 border-b p-2">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Wallet className="h-4 w-4" />
          <span className="text-sm font-medium">
            {isLoading ? (
              "Loading wallet..."
            ) : (
              <>
                Balance: <span className="font-bold">{walletInfo?.balance} AR</span>
              </>
            )}
          </span>
        </div>
        {walletInfo?.address && (
          <code className="text-xs text-muted-foreground">
            {walletInfo.address.slice(0, 6)}...{walletInfo.address.slice(-6)}
          </code>
        )}
      </div>
    </div>
  );
}