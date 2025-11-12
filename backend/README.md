# Circles Faucet Backend

This is the backend for the Circles Faucet. It is a Node.js application that listens for events on the Gnosis chain and sends Sepolia ETH to users.

## Getting Started

### Prerequisites

- Node.js
- pnpm

### Installation

1.  Navigate to the `backend` directory:

    ```bash
    cd backend
    ```

2.  Install the dependencies:
    ```bash
    pnpm install
    ```

### Running the Worker

1.  Create a `.env` file by copying the `.env.example` file:

    ```bash
    cp .env.example .env
    ```

2.  Fill in the required environment variables in the `.env` file. You will need a private key with Sepolia ETH to send to users.

3.  Start the worker:
    ```bash
    pnpm start:faucetWorker
    ```

The worker will start listening for `FaucetRequested` events on the Gnosis chain.
