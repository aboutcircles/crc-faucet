import { createPublicClient, http } from "viem";
import { gnosis, sepolia } from "viem/chains";
import "dotenv/config";

import { nativeTokenWorker } from "./workers/nativeTokenWorker.js";
import { erc20TokenWorker } from "./workers/erc20TokenWorker.js";

const INTERVAL = process.env.INTERVAL || 10; // Default 10 seconds

const gnoPublicClient = createPublicClient({
  chain: gnosis,
  transport: http(process.env.GNOSIS_RPC),
});

const sepPublicClient = createPublicClient({
  chain: sepolia,
  transport: http(process.env.SEPOLIA_RPC),
});

let lastWatchGnoBlock = 0n;
let lastWatchSepBlock = 0n;

async function initialize() {
  // Initialize block numbers
  if (lastWatchGnoBlock == 0n)
    lastWatchGnoBlock = await gnoPublicClient.getBlockNumber();
  if (lastWatchSepBlock == 0n)
    lastWatchSepBlock = await sepPublicClient.getBlockNumber();

  console.log(
    `Initialized - GNO block: ${lastWatchGnoBlock}, SEP block: ${lastWatchSepBlock}`
  );
  console.log(`Workers will run every ${INTERVAL} seconds`);
}

async function runWorkers() {
  try {
    const currentSepBlock = await sepPublicClient.getBlockNumber();
    const currentGnoBlock = await gnoPublicClient.getBlockNumber();

    await Promise.all([
      nativeTokenWorker(lastWatchSepBlock, currentSepBlock),
      erc20TokenWorker(lastWatchGnoBlock, currentGnoBlock),
    ]);

    // Update last watched blocks
    lastWatchSepBlock = currentSepBlock;
    lastWatchGnoBlock = currentGnoBlock;
  } catch (error) {
    console.error("Error running workers:", error);
  }
}

async function main() {
  await initialize();
  await runWorkers();

  // Set up periodic execution
  setInterval(runWorkers, INTERVAL * 1000);
}

main().catch(console.error);
