import React, { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { 
  connect, 
  disconnect, 
  isConnected, 
  getLocalStorage,
  request
} from '@stacks/connect';
import { cvToHex } from '@stacks/transactions';

interface UserData {
  addresses: {
    stx: Array<{ address: string }>;
    btc: Array<{ address: string }>;
  };
}

interface WalletContextType {
  isConnected: boolean;
  userData: UserData | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  getAccount: () => Promise<any>;
  callContract: (contractAddress: string, contractName: string, functionName: string, functionArgs?: any[]) => Promise<any>;
  readContract: (contractAddress: string, contractName: string, functionName: string, functionArgs?: any[]) => Promise<any>;
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
        console.log('Already connected');
        return;
      }

      const response = await connect();

      console.log('Connected:', response);
      setIsConnectedState(true);
      setUserData(response as unknown as UserData);
    } catch (err) {
      console.error('Connection error:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect wallet');
    } finally {
      setIsLoading(false);
    }
  };

  const disconnectWallet = () => {
    disconnect();
    setIsConnectedState(false);
    setUserData(null);
    setError(null);
    console.log('Wallet disconnected');
  };

  const getAccount = async () => {
    if (!isConnectedState) {
      throw new Error('Wallet not connected');
    }

    try {
      const accounts = await request('stx_getAccounts');
      return accounts;
    } catch (err) {
      console.error('Error getting account:', err);
      throw err;
    }
  };

  const callContract = async (
    contractAddress: string, 
    contractName: string, 
    functionName: string, 
    functionArgs: any[] = []
  ) => {
    if (!isConnectedState) {
      throw new Error('Wallet not connected');
    }

    setIsLoading(true);
    setError(null);

    try {
      // Use request for contract calls according to @stacks/connect README
      const response = await request('stx_callContract', {
        contract: `${contractAddress}.${contractName}`,
        functionName,
        functionArgs,
        network: 'devnet',
      });

      console.log('Contract call initiated:', response);
      return response;
    } catch (err) {
      console.error('Contract call error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Contract call failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const readContract = async (
    contractAddress: string, 
    contractName: string, 
    functionName: string, 
    functionArgs: any[] = []
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      // Use direct API call to Stacks node for read-only operations
      const apiUrl = `https://api.testnet.hiro.so/v2/contracts/call-read/${contractAddress}/${contractName}/${functionName}`;
      
      // Convert function arguments to hex-encoded Clarity values
      const hexArgs = functionArgs.map(arg => cvToHex(arg));
      
      const requestBody = {
        sender: contractAddress, // Use contract address as sender for read-only calls
        arguments: hexArgs
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Read contract result:', result);
      return result;
    } catch (err) {
      console.error('Read contract error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Read contract failed';
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
    callContract,
    readContract,
    isLoading,
    error,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = (): WalletContextType => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};
