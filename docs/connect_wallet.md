Learn how to integrate wallet connections into your Stacks application. Connecting a wallet authenticates users and enables blockchain interactions like transfers and contract calls.

## What you'll learn

:::objectives
- Install the `@stacks/connect` package
- Connect to a wallet and authenticate users
- Manage authentication state
- Access user account data
:::

## Prerequisites

:::prerequisites
- Node.js installed on your machine
- A web application setup (React, Vue, or vanilla JS)
- Basic understanding of async/await
:::

## Quickstart

<Steps>
  <Step>
    ### Install package

    Add the Stacks Connect package to your project.

    ```package-install
    @stacks/connect
    ```

    This package provides all the functions needed for wallet connections and user authentication.

  </Step>
  <Step>
    ### Connect and authenticate

    The `connect` function initiates wallet connection and stores user data in local storage for session persistence.

    ```ts

    async function connectWallet() {
      // Check if already connected
      if (isConnected()) {
        console.log('Already authenticated');
        return;
      }

      // Connect to wallet
      const response = await connect();
      console.log('Connected:', response.addresses);
    }
    ```

    Manage the authentication state throughout your app.

    ```ts

    // Check authentication status
    const authenticated = isConnected();

    // Logout function
    function logout() {
      disconnect(); // Clears storage and wallet selection
      console.log('User disconnected');
    }
    ```

  </Step>
  <Step>
    ### Access user data

    Retrieve stored addresses and request detailed account information.

    ```ts

    // Get stored addresses from local storage
    const userData = getLocalStorage();
    if (userData?.addresses) {
      const stxAddress = userData.addresses.stx[0].address;
      const btcAddress = userData.addresses.btc[0].address;
      console.log('STX:', stxAddress);
      console.log('BTC:', btcAddress);
    }
    ```

    Get detailed account information including public keys.

    ```ts
    // Request full account details
    const accounts = await request('stx_getAccounts');
    const account = accounts.addresses[0];

    console.log('Address:', account.address);
    console.log('Public key:', account.publicKey);
    console.log('Gaia URL:', account.gaiaHubUrl);
    ```

  </Step>
  <Step>
    ### Make your first transaction

    Use the authenticated connection to send STX tokens.

    ```ts

    async function sendTransaction() {
      const response = await request('stx_transferStx', {
        amount: '1000000', // 1 STX in micro-STX
        recipient: 'SP2MF04VAGYHGAZWGTEDW5VYCPDWWSY08Z1QFNDSN',
        memo: 'First transfer', // optional
      });
      
      console.log('Transaction ID:', response.txid);
    }
    ```

    The wallet will prompt the user to approve the transaction before broadcasting.

  </Step>
</Steps>

## Next steps

:::next-steps
- [Sign messages](https://docs.hiro.so/reference/stacks.js/message-signing): Prove address ownership
- [Broadcast transactions](https://docs.hiro.so/reference/stacks.js/broadcast-transactions): Learn about different transaction types
:::

The process of broadcasting transactions is fundamental for interacting with blockchains, whether you're transferring tokens, deploying contracts, or executing contract functions.

In this guide, you will learn how to:

1. [Install the necessary packages](#setup-and-installation)
2. [Connect to a user's wallet](#connect-to-a-users-wallet)
3. [Sign and broadcast transactions](#sign-and-broadcast-transactions)
4. [Handle transaction results](#handle-transaction-results)

---

## Setup and installation

Install the required packages to start building and broadcasting transactions:

```package-install
@stacks/connect @stacks/transactions
```

## Connect to a user's wallet

Before signing transactions, users need to connect their wallet to your application. Use the `connect` function to initiate a wallet connection:

```ts

async function connectWallet() {
  if (!isConnected()) {
    const response = await connect();
    console.log('Connected with addresses:', response);
  }
}
```

## Sign and broadcast transactions

There are three types of transactions you can create: STX transfers, contract deployments, and contract calls.

<Tabs defaultValue="transfer">
  <TabsList className='flex flex-wrap md:w-max'>
    <TabsTrigger value="transfer" className='tab group'>
      <Badge className='badge transition-colors'>STX transfer</Badge>
    </TabsTrigger>
    <TabsTrigger value="deploy" className='tab group'>
      <Badge className='badge transition-colors'>Contract deployment</Badge>
    </TabsTrigger>
    <TabsTrigger value="execute" className='tab group'>
      <Badge className='badge transition-colors'>Contract execution</Badge>
    </TabsTrigger>
  </TabsList>
  <TabsContent value="transfer">
    To transfer STX tokens, use the `request` method with `stx_transferStx`:

    ```ts

    async function transferStx() {
      const response = await request('stx_transferStx', {
        recipient: 'ST2EB9WEQNR9P0K28D2DC352TM75YG3K0GT7V13CV',
        amount: '100', // in micro-STX (1 STX = 1,000,000 micro-STX)
        memo: 'Reimbursement', // optional
      });
      
      console.log('Transaction ID:', response.txId);
    }
    ```
  </TabsContent>
  <TabsContent value="deploy">
    To deploy a smart contract, use the `request` method with `stx_deployContract`:

    ```ts

    async function deployContract() {
      const codeBody = '(define-public (say-hi) (ok "hello world"))';
      
      const response = await request('stx_deployContract', {
        name: 'my-contract',
        code: codeBody,
        clarityVersion: 3, // optional, defaults to latest version
      });
      
      console.log('Transaction ID:', response.txId);
    }
    ```

    <Callout>Contracts will deploy to the Stacks address of the connected wallet.</Callout>
  </TabsContent>
  <TabsContent value="execute">
    To call a contract function, use the `request` method with 'stx_callContract'. Here's an example using a simple contract:

    ```clarity
    (define-public (say-hi)
      (print "hi")
      (ok u0)
    )
    ```

    Here's how to call this function:

    ```ts

    async function callContract() {
      const response = await request('stx_callContract', {
        contractAddress: 'ST22T6ZS7HVWEMZHHFK77H4GTNDTWNPQAX8WZAKHJ',
        contractName: 'my-contract',
        functionName: 'say-hi',
        functionArgs: [], // array of Clarity values
      });
      
      console.log('Transaction ID:', response.txId);
    }
    ```

    For functions that take arguments, you can use the `Cl` namespace to construct Clarity values:

    ```ts
    const functionArgs = [
      Cl.uint(123),
      Cl.stringAscii("hello"),
      Cl.standardPrincipalCV("ST1X.."),
    ];
    ```
  </TabsContent>
</Tabs>

## Handle transaction results

When a transaction is signed and broadcast, the `request` method returns a response object containing information about the transaction:

```ts
interface TransactionResponse {
  txId: string;        // The transaction ID
  txRaw: string;       // The raw transaction hex
}
```

You can use the transaction ID to create a link to view the transaction in the explorer:

```ts
async function handleTransaction() {
  const response = await request('stx_transferStx', {
    recipient: 'ST2EB9WEQNR9P0K28D2DC352TM75YG3K0GT7V13CV',
    amount: '100',
  });
  
  const explorerUrl = `https://explorer.stacks.co/txid/${response.txId}`;
  console.log('View transaction in explorer:', explorerUrl);
}
```