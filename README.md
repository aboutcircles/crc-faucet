# Circles Faucet

This project is a faucet that allows Circles users to exchange their Circles tokens (CRC) for Sepolia ETH. It consists of three main components: a smart contract, a backend worker, and a frontend application.

## For Users: How to get Sepolia ETH

To receive Sepolia ETH, you need to have a Circles account, be a registered human and with trust score > 50. You can then use the faucet to exchange your CRC for Sepolia ETH.

### Prerequisites

1.  **Circles Account**: You need a Circles account. If you don't have one, you can create one at [app.metri.xyz](https://app.metri.xyz/).
2.  **Registered Human**: Your Circles account must be registered as a human.
3.  **Trust Score**: Your Circles account must have a trust score of at least 50.
4.  **Wallet**: You need a web3 wallet like MetaMask to interact with the faucet.

### Steps to get Sepolia ETH

1.  **Go to the Faucet Website**: Open the faucet website in your browser.
2.  **Connect Your Wallet**: Connect your wallet to the website.
3.  **Check Eligibility**: The website will check if you are eligible to use the faucet.
4.  **Enter Recipient Address**: Enter the Sepolia address where you want to receive the ETH.
5.  **Select Amount**: Choose the amount of ETH you want to receive.
6.  **Transfer CRC**: You will be redirected to Metri to transfer the corresponding amount of CRC to the faucet.
7.  **Receive ETH**: Once the CRC transfer is confirmed, you will receive the Sepolia ETH in your wallet.

## For Developers: How it Works

The project is a monorepo containing three packages: `contracts`, `backend`, and `app`.

### Architecture

1.  **`contracts`**: A Foundry project with the `FaucetOrg.sol` smart contract. This contract is deployed on the Gnosis chain and is registered as an organization on the Circles Hub. It receives CRC from users and emits a `FaucetRequested` event.
2.  **`backend`**: A Node.js application that listens for `FaucetRequested` events from the `FaucetOrg` contract on the Gnosis chain. When an event is received, it sends the corresponding amount of Sepolia ETH to the user's address.
3.  **`app`**: A React application that provides a user interface for the faucet. It allows users to connect their wallet, check their eligibility, and initiate the process of exchanging CRC for Sepolia ETH.

### Workflow

1.  A user visits the faucet web application (`app`).
2.  The user connects their wallet. The application checks if the user's Circles account is eligible for the faucet (registered as human, trust score > 50).
3.  The user specifies a recipient address on the Sepolia network and the amount of ETH they want to claim.
4.  The application generates a link or QR code that directs the user to Metri to transfer CRC to the `FaucetOrg` smart contract on the Gnosis chain. The recipient address and CRC amount are encoded in the transaction data.
5.  The `FaucetOrg` contract receives the CRC, verifies the user's eligibility, and emits a `FaucetRequested` event with the recipient address and the amount of ETH to be sent.
6.  The `backend` worker, listening for events on the Gnosis chain, catches the `FaucetRequested` event.
7.  The `backend` worker sends the specified amount of Sepolia ETH to the recipient address.

### Development Setup

To set up the development environment, you need to have Node.js and Foundry installed.

1.  **Clone the repository**:

    ```bash
    git clone <repository-url>
    cd circles-faucet
    ```

2.  **Install dependencies**:

    ```bash
    pnpm install
    ```

3.  **Set up environment variables**:

    - Create a `.env` file in the `app`, `backend`, and `contracts` directories by copying the `.env.example` files.
    - Fill in the required environment variables in each `.env` file.

4.  **Run the applications**:
    - **Contracts**:
      ```bash
      cd contracts
      forge build
      ```
    - **Backend**:
      ```bash
      cd backend
      pnpm start:faucetWorker
      ```
    - **App**:
      ```bash
      cd app
      pnpm dev
      ```
