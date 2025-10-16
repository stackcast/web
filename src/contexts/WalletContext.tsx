import {
  connect,
  disconnect,
  getLocalStorage,
  isConnected,
  openContractCall,
  request,
} from "@stacks/connect";
import {
  AnchorMode,
  fetchCallReadOnlyFunction,
  PostConditionMode,
  type ClarityValue,
} from "@stacks/transactions";
import type { ReactNode } from "react";
import React, { createContext, useContext, useEffect, useState } from "react";
import { stacksNetwork } from "../lib/config";

interface UserData {
  addresses: {
    stx: Array<{ address: string }>;
    btc: Array<{ address: string }>;
  };
}

interface SignMessageResponse {
  signature: string;
  publicKey: string;
}

interface ContractCallResponse {
  txid: string;
}

interface ContractCallOptions {
  postConditionMode?: "allow" | "deny";
  onFinish?: (data: { txId: string }) => void;
  onCancel?: () => void;
}

interface WalletContextType {
  isConnected: boolean;
  userData: UserData | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  getAccount: () => Promise<Awaited<ReturnType<typeof request>>>;
  signMessage: (message: string) => Promise<SignMessageResponse>;
  callContract: (
    contractAddress: string,
    contractName: string,
    functionName: string,
    functionArgs?: ClarityValue[],
    options?: ContractCallOptions
  ) => Promise<ContractCallResponse>;
  readContract: (
    contractAddress: string,
    contractName: string,
    functionName: string,
    functionArgs?: ClarityValue[]
  ) => Promise<ClarityValue>;
  isLoading: boolean;
  error: string | null;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

interface WalletProviderProps {
  children: ReactNode;
}

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const [isConnectedState, setIsConnectedState] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize wallet state on mount
  useEffect(() => {
    const initializeWallet = () => {
      const connected = isConnected();
      setIsConnectedState(connected);

      if (connected) {
        const storedData = getLocalStorage();
        if (storedData?.addresses) {
          setUserData(storedData as UserData);
        }
      }
    };

    initializeWallet();
  }, []);

  const connectWallet = async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (isConnected()) {
        console.log("Already connected");
        setIsLoading(false);
        return;
      }

      // connect() is an alias for request({forceWalletSelect: true}, 'getAddresses')
      // It automatically stores the address in local storage
      const response = await connect();

      console.log("Connected:", response);
      setIsConnectedState(true);
      setUserData(response as unknown as UserData);
    } catch (err) {
      console.error("Connection error:", err);
      setError(err instanceof Error ? err.message : "Failed to connect wallet");
    } finally {
      setIsLoading(false);
    }
  };

  const disconnectWallet = () => {
    disconnect();
    setIsConnectedState(false);
    setUserData(null);
    setError(null);
    console.log("Wallet disconnected");
  };

  const getAccount = async () => {
    if (!isConnectedState) {
      throw new Error("Wallet not connected");
    }

    try {
      const accounts = await request("stx_getAccounts");
      return accounts;
    } catch (err) {
      console.error("Error getting account:", err);
      throw err;
    }
  };

  const signMessage = async (message: string) => {
    if (!isConnectedState) {
      throw new Error("Wallet not connected");
    }

    try {
      // Use request for message signing
      // Returns both signature and publicKey for verification
      const response = (await request("stx_signMessage", {
        message,
      })) as SignMessageResponse;

      console.log("Message signed:", response);
      return response; // Return both signature and publicKey
    } catch (err) {
      console.error("Error signing message:", err);
      throw err;
    }
  };

  const callContract = async (
    contractAddress: string,
    contractName: string,
    functionName: string,
    functionArgs: ClarityValue[] = [],
    options: ContractCallOptions = {}
  ) => {
    if (!isConnectedState) {
      throw new Error("Wallet not connected");
    }

    setIsLoading(true);
    setError(null);

    return new Promise<ContractCallResponse>((resolve, reject) => {
      try {
        openContractCall({
          network: stacksNetwork,
          anchorMode: AnchorMode.Any,
          contractAddress,
          contractName,
          functionName,
          functionArgs,
          postConditionMode: PostConditionMode.Allow,
          postConditions: [],
          onFinish: (data) => {
            console.log("Contract call successful:", data);
            setIsLoading(false);
            const response = { txid: data.txId };
            if (options.onFinish) {
              options.onFinish(data);
            }
            resolve(response);
          },
          onCancel: () => {
            console.log("Contract call cancelled");
            setIsLoading(false);
            if (options.onCancel) {
              options.onCancel();
            }
            reject(new Error("User cancelled transaction"));
          },
        });
      } catch (err) {
        console.error("Contract call error:", err);
        const errorMessage =
          err instanceof Error ? err.message : "Contract call failed";
        setError(errorMessage);
        setIsLoading(false);
        reject(err);
      }
    });
  };

  const readContract = async (
    contractAddress: string,
    contractName: string,
    functionName: string,
    functionArgs: ClarityValue[] = []
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchCallReadOnlyFunction({
        contractAddress,
        contractName,
        functionName,
        functionArgs,
        network: stacksNetwork,
        senderAddress: contractAddress, // Use contract address as sender for read-only calls
      });

      console.log("Read contract result:", result);
      return result;
    } catch (err) {
      console.error("Read contract error:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Read contract failed";
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const value: WalletContextType = {
    isConnected: isConnectedState,
    userData,
    connectWallet,
    disconnectWallet,
    getAccount,
    signMessage,
    callContract,
    readContract,
    isLoading,
    error,
  };

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
};

export const useWallet = (): WalletContextType => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
};
