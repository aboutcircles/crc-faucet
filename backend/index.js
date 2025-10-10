import {
  parseAbiItem,
  createWalletClient,
  createPublicClient,
  http,
  parseEther,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { gnosis, sepolia } from "viem/chains";
import fs from "fs";
import path from "path";
import express from "express";
import cors from "cors";
import "dotenv/config";
let lastProcessedBlock = 0n;
const STATE_FILE = path.join(process.cwd(), "last_block.json");

// Store transaction hashes in memory
const transactionHashes = new Map();

// Express server setup
const app = express();
app.use(cors());
app.use(express.json());

const publicClient = createPublicClient({
  chain: gnosis,
  transport: http(),
});

const walletClient = createWalletClient({
  chain: sepolia,
  transport: http(process.env.SEPOLIA_RPC),
  account: privateKeyToAccount(process.env.PRIVATE_KEY),
});

function loadLastProcessedBlock() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
      return BigInt(data.lastProcessedBlock || 0);
    }
  } catch (error) {
    console.error("Error loading last processed block:", error);
  }
  return 0n;
}

function saveLastProcessedBlock(blockNumber) {
  try {
    fs.writeFileSync(
      STATE_FILE,
      JSON.stringify({ lastProcessedBlock: blockNumber.toString() })
    );
  } catch (error) {
    console.error("Error saving last processed block:", error);
  }
}

async function monitorEvents() {
  try {
    const latestBlock = await publicClient.getBlockNumber();
    const toBlock = latestBlock;
    const fromBlock =
      lastProcessedBlock === 0n ? latestBlock - 20n : lastProcessedBlock + 1n;

    console.log(`Checking blocks from ${fromBlock} to ${toBlock}`);

    const logs = await publicClient.getContractEvents({
      abi: [
        parseAbiItem(
          "event CRCReceived(uint256 indexed id, uint256 indexed value,address indexed recipient, bytes data)"
        ),
      ],
      address: "0x62088049Ba680e5EaA729860BD7cf5DB99d593B2",
      eventName: "CRCReceived",
      fromBlock,
      toBlock,
    });

    if (logs && logs.length > 0) {
      console.log(`Found ${logs.length} CRCReceived events`);

      for (const log of logs) {
        console.log("Processing event:", {
          id: log.args.id,
          value: log.args.value,
          recipient: log.args.recipient,
          blockNumber: log.blockNumber,
        });

        const hash = await walletClient.sendTransaction({
          to: log.args.recipient,
          value: parseEther(process.env.SEND_VALUE),
        });

        // Store transaction hash with recipient address and timestamp
        transactionHashes.set(log.args.recipient.toLowerCase(), {
          transactionHash: hash,
          timestamp: new Date().toISOString(),
          amount: process.env.SEND_VALUE,
          blockNumber: log.blockNumber.toString(),
        });

        console.log(`Sent transaction: ${hash}`);
      }
    }

    lastProcessedBlock = toBlock;
    saveLastProcessedBlock(lastProcessedBlock);
  } catch (error) {
    console.error("Error in monitorEvents:", error);
  }
}

// API Routes
app.get("/api/transaction/:address", (req, res) => {
  const address = req.params.address.toLowerCase();
  const txData = transactionHashes.get(address);

  if (txData) {
    res.json({
      success: true,
      data: txData,
    });
  } else {
    res.json({
      success: false,
      message: "No transaction found for this address",
    });
  }
});

app.get("/api/transactions", (req, res) => {
  const allTransactions = Array.from(transactionHashes.entries()).map(
    ([address, data]) => ({
      address,
      ...data,
    })
  );

  res.json({
    success: true,
    data: allTransactions,
  });
});

async function start() {
  console.log("Starting Circles Faucet Backend...");
  lastProcessedBlock = loadLastProcessedBlock();
  console.log(`Last processed block: ${lastProcessedBlock}`);

  // Start Express server
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`API server running on port ${PORT}`);
  });

  await monitorEvents();

  setInterval(async () => {
    await monitorEvents();
  }, 10000); // Check every 10 s
}

start().catch(console.error);
