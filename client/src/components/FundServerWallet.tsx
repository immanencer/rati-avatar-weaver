import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useArConnect } from "./ArConnectProvider";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { arweave } from "@/lib/arweave";

const PRESET_AMOUNTS = [
  { value: "0.1", label: "1 Avatar", description: "0.1 AR" },
  { value: "0.5", label: "5 Avatars", description: "0.5 AR" },
  { value: "1.0", label: "10 Avatars", description: "1.0 AR" },
] as const;

export function FundServerWallet() {
  const [amount, setAmount] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<'idle' | 'preparing' | 'submitting' | 'confirming' | 'error'>('idle');
  const { connected, arweaveWallet } = useArConnect();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch server balance
  const { data: serverBalance, isError: isBalanceError } = useQuery<{ balance: string; address: string }>({
    queryKey: ["/api/avatars/server-balance"],
    queryFn: async () => {
      const res = await fetch("/api/avatars/server-balance");
      if (!res.ok) {
        throw new Error("Failed to fetch server balance");
      }
      return res.json();
    },
    retry: 1,
  });

  const fundMutation = useMutation({
    mutationFn: async () => {
      if (!window.arweaveWallet) {
        throw new Error("Please install ArConnect to fund the server wallet");
      }

      if (!connected || !arweaveWallet) {
        throw new Error("Please connect your ArConnect wallet first");
      }

      if (!serverBalance?.address) {
        throw new Error("Server wallet address not available");
      }

      const parsedAmount = parseFloat(amount);
      if (!amount || parsedAmount <= 0) {
        throw new Error("Please enter a valid amount greater than 0");
      }

      setTransactionStatus('preparing');

      // Convert AR to Winston before validation
      const amountWinston = arweave.ar.arToWinston(amount);
      if (amountWinston === "0") {
        throw new Error("Amount is too small");
      }

      try {
        // Request permissions if not already granted
        await window.arweaveWallet.connect([
          "ACCESS_ADDRESS",
          "SIGNATURE",
          "SIGN_TRANSACTION",
          "DISPATCH"
        ]);

        setTransactionStatus('submitting');
        console.log("Creating transaction...");

        // Create transaction using arweave
        const transaction = await arweave.createTransaction({
          target: serverBalance.address,
          quantity: amountWinston.toString(), // Ensure quantity is string
        });

        // Get transaction fee
        const fee = await arweave.transactions.getPrice(0); // 0 bytes since no data
        console.log("Transaction fee:", arweave.ar.winstonToAr(fee));

        // Check if the fee is affordable
        const walletAddress = await window.arweaveWallet.getActiveAddress();
        const balance = await arweave.wallets.getBalance(walletAddress);
        if (parseFloat(balance) < parseFloat(amountWinston) + parseFloat(fee)) {
          throw new Error("Insufficient balance to cover the transaction fee");
        }

        // Add tags
        [
          { name: "App-Name", value: "RATi-Avatar-Platform" },
          { name: "Type", value: "Funding" },
          { name: "Version", value: "1.0" },
          { name: "Unix-Time", value: String(Date.now()) },
          { name: "Service", value: "Avatar-Funding" },
          { name: "Content-Type", value: "application/x-funding" },
        ].forEach((tag) => transaction.addTag(tag.name, tag.value));

        // Sign transaction
        const signedTx = await window.arweaveWallet.sign(transaction);
        console.log("Transaction signed:", {
          id: signedTx.id,
          quantity: signedTx.quantity,
          reward: signedTx.reward,
        });

        // Post transaction
        try {
          const response = await arweave.transactions.post(signedTx);
          console.log("Transaction post response:", response);
          
          if (response.status !== 200) {
            const responseText = await response.data;
            throw new Error(`Failed to post transaction: ${responseText}`);
          }
        } catch (postError) {
          console.error("Transaction post error:", postError);
          throw new Error(
            postError instanceof Error 
              ? postError.message 
              : "Failed to post transaction to Arweave network"
          );
        }

        const txId = signedTx.id;
        if (!txId) {
          throw new Error("Transaction ID is missing");
        }
        console.log("Transaction dispatched:", txId);
        setTransactionStatus('confirming');

        // Notify server about the transaction with timeout
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

        try {
          const serverResponse = await fetch("/api/avatars/fund", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ txId }),
            signal: controller.signal
          });

          clearTimeout(timeout);

          if (!serverResponse.ok) {
            const errorData = await serverResponse.text();
            throw new Error(errorData || "Failed to notify server about transaction");
          }

          const responseData = await serverResponse.json();
          return {
            txId,
            newBalance: responseData.balance,
            status: 'confirmed'
          };
        } catch (error) {
          // If it's a timeout error, we still consider the transaction successful
          // since it was dispatched to the network
          if (error instanceof Error && error.name === 'AbortError') {
            console.log("Server notification timed out, but transaction was submitted");
            return { 
              txId, 
              newBalance: null,
              status: 'pending_confirmation'
            };
          }
          console.error("Server notification error:", error);
          throw error;
        }
      } catch (error) {
        console.error("Transaction error:", error);
        setTransactionStatus('error');
        throw error instanceof Error 
          ? error 
          : new Error("Failed to fund server wallet. Please try again.");
      }
    },
    onSuccess: ({ txId, newBalance, status }) => {
      setTransactionStatus('idle');
      toast({
        title: "Transaction Submitted Successfully",
        description: status === 'pending_confirmation' 
          ? `Transaction ${txId.slice(0, 8)}... has been submitted. Please wait for network confirmation.`
          : `Transaction ${txId.slice(0, 8)}... has been confirmed.`,
      });
      setIsOpen(false);
      setAmount("");
      // Only invalidate if we got a new balance
      if (newBalance) {
        queryClient.invalidateQueries({ queryKey: ["/api/avatars/server-balance"] });
      }
    },
    onError: (error) => {
      setTransactionStatus('error');
      toast({
        title: "Transaction Failed",
        description: error instanceof Error ? error.message : "Failed to fund server wallet",
        variant: "destructive",
      });
    },
  });

  const handleFund = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount greater than 0 AR",
        variant: "destructive",
      });
      return;
    }

    try {
      await fundMutation.mutateAsync();
    } catch (error) {
      console.error("Funding error:", error);
      // Error is handled in mutation's onError
    }
  };

  if (!connected) return null;

  // Show error state if balance query fails
  if (isBalanceError) {
    return (
      <Button variant="outline" size="sm" disabled>
        Unable to load server wallet
      </Button>
    );
  }

  const getButtonText = () => {
    switch (transactionStatus) {
      case 'preparing':
        return (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Preparing Transaction...
          </>
        );
      case 'submitting':
        return (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Submitting Transaction...
          </>
        );
      case 'confirming':
        return (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Awaiting Confirmation...
          </>
        );
      case 'error':
        return 'Try Again';
      default:
        return 'Send AR';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      // Don't allow closing during active transaction
      if (transactionStatus !== 'idle' && transactionStatus !== 'error') return;
      setIsOpen(open);
      if (!open) {
        setAmount("");
        setTransactionStatus('idle');
      }
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Fund Server
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fund Server Wallet</DialogTitle>
          <DialogDescription>
            Choose a preset amount or enter a custom amount to fund the server wallet.
            This helps cover transaction costs for publishing avatars to Arweave.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Preset amount buttons */}
          <div className="grid grid-cols-3 gap-2">
            {PRESET_AMOUNTS.map((preset) => (
              <Button
                key={preset.value}
                variant={amount === preset.value ? "default" : "outline"}
                className="w-full flex-col h-auto py-4"
                onClick={() => setAmount(preset.value)}
                disabled={transactionStatus !== 'idle'}
              >
                <span className="text-lg font-bold">{preset.label}</span>
                <span className="text-xs text-muted-foreground">{preset.description}</span>
              </Button>
            ))}
          </div>

          {/* Custom amount input */}
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Or enter a custom amount:</div>
            <Input
              type="number"
              step="0.000000000001"
              min="0.000000000001"
              placeholder="Custom amount in AR"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={transactionStatus !== 'idle'}
            />
            <p className="text-xs text-muted-foreground break-all">
              Server address: {serverBalance?.address}
            </p>
          </div>
          <Button
            className="w-full"
            onClick={handleFund}
            disabled={transactionStatus !== 'idle' || !serverBalance?.address}
          >
            {getButtonText()}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}