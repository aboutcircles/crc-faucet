import {
  createPublicClient,
  createWalletClient,
  parseAbiItem,
  parseEventLogs,
  publicActions,
  http,
} from "viem";
import { gnosis, sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import "dotenv/config";
import { CONTRACT_ADDRESS } from "../utils/constants.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("NativeTokenWorker");

export async function nativeTokenWorker(fromBlock, toBlock) {
  logger.info(
    `Checking TokenDeposited from ${fromBlock} to ${toBlock} on Sepolia contract ${CONTRACT_ADDRESS.SEP_NATIVE_TOKEN_DEPOSIT}`
  );
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(process.env.SEPOLIA_RPC),
  });

  // Listen to event from contract with block range
  const logs = await publicClient.getContractEvents({
    address: CONTRACT_ADDRESS.SEP_NATIVE_TOKEN_DEPOSIT,
    abi: [
      parseAbiItem(
        "event TokenDeposited(address indexed from, address indexed recipient, uint256 indexed amount)"
      ),
    ],
    eventName: "TokenDeposited",
    fromBlock,
    toBlock,
  });
  if (logs.length != 0) {
    logger.info(`Found ${logs.length} TokenDeposited event on Sepolia`);
    await callMintOnSepETH(logs);
  }
}

async function callMintOnSepETH(logs) {
  const parsedLog = parseEventLogs({
    abi: [
      parseAbiItem(
        "event TokenDeposited(address indexed from, address indexed recipient, uint256 indexed amount)"
      ),
    ],
    eventName: "TokenDeposited",
    logs,
  });
  // call SepETH.mint
  const walletClient = createWalletClient({
    chain: gnosis,
    transport: http(process.env.GNOSIS_RPC),
    account: privateKeyToAccount(process.env.PRIVATE_KEY),
  }).extend(publicActions);

  parsedLog.forEach(async (log) => {
    logger.info("Calling mint on Gnosis Chain...");

    const { request } = await walletClient.simulateContract({
      address: CONTRACT_ADDRESS.GNO_SEP_ETH,
      abi: [parseAbiItem("function mint(address to, uint256 amount)")],
      functionName: "mint",
      args: [log.args.recipient, log.args.amount],
    });

    const mintTxHash = await walletClient.writeContract(request);

    logger.info(`Mint Transaction on Gnosis Chain: ${mintTxHash}`);
  });
}
