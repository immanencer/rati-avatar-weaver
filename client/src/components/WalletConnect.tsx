import { Button } from "@/components/ui/button";
import { useArConnect } from "@/components/ArConnectProvider";
import { Wallet, LogOut } from "lucide-react";

export function WalletConnect() {
  const { connected, address, connect, disconnect } = useArConnect();

  return (
    <div className="flex items-center gap-2">
      {connected ? (
        <>
          <span className="text-sm text-gray-600">
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={disconnect}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Disconnect
          </Button>
        </>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={connect}
        >
          <Wallet className="h-4 w-4 mr-2" />
          Connect Wallet
        </Button>
      )}
    </div>
  );
}
