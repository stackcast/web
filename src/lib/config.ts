import type { StacksNetwork } from "@stacks/network";
import { STACKS_DEVNET, STACKS_MAINNET, STACKS_TESTNET } from "@stacks/network";

const DEFAULT_API_BASE_URL = "http://localhost:3000";

export const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || DEFAULT_API_BASE_URL;

// Network configuration - can be changed via environment variable
const NETWORK_TYPE = import.meta.env.VITE_STACKS_NETWORK || "devnet";

// Stacks API URL (the blockchain node)
const STACKS_API_URL =
  import.meta.env.VITE_STACKS_API_URL || "http://localhost:3999";

// StacksNetwork object for transactions package
export const stacksNetwork: StacksNetwork =
  NETWORK_TYPE === "mainnet"
    ? STACKS_MAINNET
    : NETWORK_TYPE === "testnet"
    ? STACKS_TESTNET
    : { ...STACKS_DEVNET, client: { baseUrl: STACKS_API_URL } };

// Network identifier string for Connect API (must be 'mainnet', 'testnet', or 'devnet')
export const networkIdentifier = NETWORK_TYPE as
  | "mainnet"
  | "testnet"
  | "devnet";

// Contract addresses (these would be set after deployment)
export const CONTRACT_ADDRESSES = {
  MESSAGE: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.message", // Test message board contract
  ORACLE_ADAPTER: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.oracle-adapter", // deployer address from devnet
  CONDITIONAL_TOKENS:
    "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.conditional-tokens",
  CTF_EXCHANGE: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.ctf-exchange",
  OPTIMISTIC_ORACLE:
    "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.optimistic-oracle",
} as const;
