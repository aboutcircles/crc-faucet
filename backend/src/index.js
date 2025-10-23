import { createPublicClient, http } from "viem";
import { gnosis, sepolia } from "viem/chains";

import { srcWorker } from "./srcWorker.js";
import { dstWorker } from "./dstWorker.js";

const INTERVAL = process.env.INTERVAL || 30; // Default 30 seconds

const gnoPublicClient = createPublicClient({
  chain: gnosis,
  transport: http(),
});

const sepPublicClient = createPublicClient({
  chain: sepolia,
  transport: http(),
});

let lastWatchGnoBlock = 0;
let lastWatchSepBlock = 0;

async function initialize() {
  // Initialize block numbers
  lastWatchGnoBlock = await gnoPublicClient.getBlockNumber();
  lastWatchSepBlock = await sepPublicClient.getBlockNumber();
  
  console.log(`Initialized - GNO block: ${lastWatchGnoBlock}, SEP block: ${lastWatchSepBlock}`);
}

async function runWorkers() {
  console.log("Starting workers...");

  try {
    const currentSepBlock = await sepPublicClient.getBlockNumber();
    const currentGnoBlock = await gnoPublicClient.getBlockNumber();
    
    await Promise.all([
      srcWorker(lastWatchSepBlock, currentSepBlock),
      dstWorker(lastWatchGnoBlock, currentGnoBlock),
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
  
  console.log(`Workers will run every ${INTERVAL} seconds`);
}

main().catch(console.error);
