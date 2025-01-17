import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Wallet } from "lucide-react";
import { WalletConnect } from "@/components/WalletConnect";
import { FundServerWallet } from "@/components/FundServerWallet";

interface ServerBalance {
  balance: string;
  address: string;
}

export function Navbar() {
  const [location] = useLocation();

  // Fetch server AR balance
  const { data: serverBalance, isLoading: isLoadingBalance } = useQuery<ServerBalance>({
    queryKey: ["/api/avatars/server-balance"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-[100vw] px-4">
        <div className="flex h-14 items-center justify-between">
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6">
            <Link href="/" className="font-bold">
              RATi Avatar Platform
            </Link>
            <Link 
              href="/collection"
              className={`transition-colors hover:text-foreground/80 ${
                location === "/collection" ? "text-foreground" : "text-foreground/60"
              }`}
            >
              Collection
            </Link>
          </div>

          {/* Mobile Navigation */}
          <div className="flex md:hidden items-center w-full">
            <Link href="/" className="font-bold">
              RATi
            </Link>
            <div className="flex items-center gap-2 ml-auto">
              {location !== "/collection" && (
                <Link href="/collection">
                  <button className="px-2 py-1 text-sm font-medium bg-primary/10 text-primary rounded-md">
                    Collection
                  </button>
                </Link>
              )}
            </div>
          </div>

          {/* Wallet Section (Mobile & Desktop) */}
          <div className="flex items-center gap-2">
            {!isLoadingBalance && serverBalance && (
              <div className="hidden sm:flex items-center text-sm text-muted-foreground">
                <Wallet className="w-4 h-4 mr-1" />
                <span>{serverBalance.balance} AR</span>
              </div>
            )}
            <FundServerWallet />
            <WalletConnect />
          </div>
        </div>
      </div>
    </nav>
  );
}