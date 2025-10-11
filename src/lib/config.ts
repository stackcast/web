import { STACKS_DEVNET } from '@stacks/network';

const DEFAULT_API_BASE_URL = 'http://localhost:3000';

export const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || DEFAULT_API_BASE_URL;

// Network configuration for devnet
export const stacksNetwork = STACKS_DEVNET;

// Contract addresses (these would be set after deployment)
export const CONTRACT_ADDRESSES = {
  MESSAGE: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.message', // Test message board contract
  ORACLE_ADAPTER: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.oracle-adapter', // deployer address from devnet
  CONDITIONAL_TOKENS: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.conditional-tokens',
  CTF_EXCHANGE: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.ctf-exchange',
  OPTIMISTIC_ORACLE: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.optimistic-oracle',
} as const;
