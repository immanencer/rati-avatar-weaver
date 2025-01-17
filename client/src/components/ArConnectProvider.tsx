import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useToast } from "@/hooks/use-toast";

interface ArweaveWallet {
  connect: (permissions: string[]) => Promise<void>;
  disconnect: () => Promise<void>;
  getActiveAddress: () => Promise<string>;
  getPermissions: () => Promise<string[]>;
  sign: (transaction: any, options?: any) => Promise<any>;
  dispatch: (transaction: {
    target: string;
    quantity: string;
    data?: Uint8Array;
    tags?: { name: string; value: string; }[];
  }) => Promise<string>;
}

declare global {
  interface Window {
    arweaveWallet?: ArweaveWallet;
  }
}

interface ArConnectContextType {
  connected: boolean;
  address: string | null;
  arweaveWallet: ArweaveWallet | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

const ArConnectContext = createContext<ArConnectContextType>({
  connected: false,
  address: null,
  arweaveWallet: null,
  connect: async () => {},
  disconnect: async () => {},
});

export const useArConnect = () => useContext(ArConnectContext);

interface ArConnectProviderProps {
  children: ReactNode;
}

export function ArConnectProvider({ children }: ArConnectProviderProps) {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [arweaveWallet, setArweaveWallet] = useState<ArweaveWallet | null>(null);
  const { toast } = useToast();

  // Required permissions for the application
  const REQUIRED_PERMISSIONS = [
    "ACCESS_ADDRESS",
    "SIGN_TRANSACTION",
    "ACCESS_PUBLIC_KEY",
    "SIGNATURE",
    "DISPATCH"
  ] as const;

  useEffect(() => {
    // Check if ArConnect is installed
    if (window.arweaveWallet) {
      setArweaveWallet(window.arweaveWallet);
      checkConnection();
    } else {
      console.log("ArConnect not detected");
    }

    // Listen for ArConnect events
    window.addEventListener("arweaveWalletLoaded", handleWalletLoad);
    window.addEventListener("walletSwitch", handleWalletSwitch);
    window.addEventListener("walletDisconnect", handleDisconnect);

    return () => {
      window.removeEventListener("arweaveWalletLoaded", handleWalletLoad);
      window.removeEventListener("walletSwitch", handleWalletSwitch);
      window.removeEventListener("walletDisconnect", handleDisconnect);
    };
  }, []);

  const handleWalletLoad = () => {
    console.log("ArConnect loaded");
    if (window.arweaveWallet) {
      setArweaveWallet(window.arweaveWallet);
      checkConnection();
    }
  };

  const handleWalletSwitch = async () => {
    console.log("Wallet switched");
    await checkConnection();
  };

  const checkConnection = async () => {
    try {
      if (!window.arweaveWallet) {
        console.log("ArConnect not available");
        return;
      }

      try {
        const activeAddress = await window.arweaveWallet.getActiveAddress();
        if (activeAddress) {
          // Verify we have all required permissions
          const permissions = await window.arweaveWallet.getPermissions();
          const hasAllPermissions = REQUIRED_PERMISSIONS.every(p => permissions.includes(p));

          if (!hasAllPermissions) {
            console.log("Not all permissions granted, requesting permissions");
            await window.arweaveWallet.connect([...REQUIRED_PERMISSIONS]);
          }

          setAddress(activeAddress);
          setConnected(true);
          setArweaveWallet(window.arweaveWallet);
        }
      } catch (error) {
        // Handle permission denied or other wallet errors
        console.error("Error checking wallet connection:", error);
        handleDisconnect();
      }
    } catch (error) {
      console.error("Error during connection check:", error);
      handleDisconnect();
    }
  };

  const connect = async () => {
    try {
      if (!window.arweaveWallet) {
        toast({
          title: "ArConnect Not Found",
          description: "Please install ArConnect wallet extension to continue.",
          variant: "destructive",
        });
        return;
      }

      // Request all necessary permissions
      await window.arweaveWallet.connect([...REQUIRED_PERMISSIONS]);

      const activeAddress = await window.arweaveWallet.getActiveAddress();
      if (!activeAddress) {
        throw new Error("Failed to get wallet address after connection");
      }

      setAddress(activeAddress);
      setConnected(true);
      setArweaveWallet(window.arweaveWallet);

      toast({
        title: "Connected",
        description: "Successfully connected to ArConnect wallet.",
      });
    } catch (error) {
      console.error("Error connecting:", error);
      handleDisconnect();
      toast({
        title: "Connection Failed",
        description: error instanceof Error 
          ? error.message 
          : "Failed to connect to ArConnect wallet. Please ensure all permissions are granted.",
        variant: "destructive",
      });
    }
  };

  const handleDisconnect = () => {
    setAddress(null);
    setConnected(false);
    setArweaveWallet(null);
  };

  const disconnect = async () => {
    try {
      if (window.arweaveWallet) {
        await window.arweaveWallet.disconnect();
      }
      handleDisconnect();
      toast({
        title: "Disconnected",
        description: "Successfully disconnected from ArConnect wallet.",
      });
    } catch (error) {
      console.error("Error disconnecting:", error);
      toast({
        title: "Disconnect Failed",
        description: "Failed to disconnect from ArConnect wallet.",
        variant: "destructive",
      });
    }
  };

  return (
    <ArConnectContext.Provider value={{ 
      connected, 
      address, 
      arweaveWallet, 
      connect, 
      disconnect 
    }}>
      {children}
    </ArConnectContext.Provider>
  );
}