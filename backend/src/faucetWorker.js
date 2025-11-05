import {
  parseAbiItem,
  createWalletClient,
  createPublicClient,
  http,
  formatEther,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { gnosis, sepolia } from "viem/chains";
import "dotenv/config";
let lastProcessedBlock = 0n;

const gnoPublicClient = createPublicClient({
  chain: gnosis,
  transport: http(process.env.GNOSIS_RPC),
});

const sepWalletClient = createWalletClient({
  chain: sepolia,
  transport: http(process.env.SEPOLIA_RPC),
  account: privateKeyToAccount(process.env.PRIVATE_KEY),
});

async function monitorEvents() {
  try {
    const latestBlock = await gnoPublicClient.getBlockNumber();
    const toBlock = latestBlock;
    const fromBlock =
      lastProcessedBlock === 0n ? latestBlock - 20n : lastProcessedBlock + 1n;

    console.log(`Checking blocks from ${fromBlock} to ${toBlock}`);

    const logs = await gnoPublicClient.getContractEvents({
      abi: [
        parseAbiItem(
          "event FaucetRequested(address indexed from, address indexed recipient, uint256 indexed claimTokenAmount)"
        ),
      ],
      address: process.env.FAUCET_ORG_CONTRACT,
      eventName: "FaucetRequested",
      fromBlock,
      toBlock,
    });

    if (logs && logs.length > 0) {
      console.log(`Found ${logs.length} FaucetRequested events`);

      for (const log of logs) {
        console.log("Processing event:", {
          recipient: log.args.recipient,
          claimAmount: log.args.claimTokenAmount,
          blockNumber: log.blockNumber,
        });

        const hash = await sepWalletClient.sendTransaction({
          to: log.args.recipient,
          value: log.args.claimTokenAmount,
        });

        console.log(
          `Transfer 
            ${formatEther(logs.args.claimTokenAmount)} ETH to ${
            log.args.recipient
          }. Transaction hash: ${hash}`
        );
      }
    }

    lastProcessedBlock = toBlock;
  } catch (error) {
    console.error("Error in monitorEvents:", error);
  }
}

async function start() {
  console.log("Starting Circles Faucet Backend...");
  console.log(`Starting from block: ${lastProcessedBlock}`);

  await monitorEvents();

  setInterval(async () => {
    await monitorEvents();
  }, parseInt(process.env.INTERVAL, 10) || 5000); // default every 5 s
}

start().catch(console.error);
