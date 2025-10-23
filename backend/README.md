## Sepolia

```solidity
    event TokenDeposited(address indexed from, address indexed recipient, uint256 indexed amount);
    event TokenWithdrawn(address indexed to, uint256 indexed amount);
```

## Gnosis Chain

```solidity
    event TokenBridgingInitiated(address indexed from, address indexed recipient, uint256 indexed amount);

```

1. Deployer / Cycle Owner

# Workflow

Sepolia -> Gnosis Chain

1. Deposit ETH on Sepolia and mint SepETH on Gnosis
   1. `emit TokenDeposited(address indexed from, address indexed recipient, uint256 indexed amount);`
   2. Worker call `SepETH.mint(recipient, amount)`;
2. Create Order: use Scripts
3. Swap CRC with ETH
   1. User transfer CRC (front end to check score and link to URL)
   2. CRC is received and emit transfer to user SepETH token on Gnosis
   3. `Emit TokenBridgingInitiated(address indexed from, address indexed recipient, uint256 indexed amount);`
   4. Worker call `NativeTokenDeposit.withdraw(to, amount)`
