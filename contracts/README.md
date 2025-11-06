# Faucet Org

This is a Foundry project for the `FaucetOrg.sol` smart contract.

Deployment on Gnosis Chain: `0xb225E9d8A67363F7759dbeBF63bDF9B151aB2e02`

## Getting Started

### Prerequisites

- [Foundry](https://getfoundry.sh/)

### Compiling the Contracts

To compile the contracts, run the following command:

```bash
forge build
```

### Running Tests

To run the tests, run the following command:

```bash
forge test
```

### Deployment

To deploy the contracts, you can use the `Deploy.s.sol` script. Make sure to set up your `.env` file with your RPC URL and private key.

```bash
forge script script/Deploy.s.sol --rpc-url <your_rpc_url> --private-key <your_private_key>
```
