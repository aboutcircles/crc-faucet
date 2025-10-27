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

const logger = createLogger("ERC20TokenWorker");

export async function erc20TokenWorker(fromBlock, toBlock) {
  logger.info(
    `Checking TokenBridgingInitiated event from ${fromBlock} to ${toBlock} on Gnosis Chain contract ${CONTRACT_ADDRESS.GNO_SEP_ETH}`
  );
  const publicClient = createPublicClient({
    chain: gnosis,
    transport: http(process.env.GNOSIS_RPC),
  });

  // Listen to event from contract
  const logs = await publicClient.getContractEvents({
    address: CONTRACT_ADDRESS.GNO_SEP_ETH,
    abi: [
      parseAbiItem(
        "event TokenBridgingInitiated(address indexed from, address indexed recipient, uint256 indexed amount)"
      ),
    ],
    eventName: "TokenBridgingInitiated",
    fromBlock,
    toBlock,
  });
  if (logs.length != 0) {
    logger.info(
      `Found ${logs.length} TokenBridgingInitiated event on Gnosis Chain`
    );
    await callWithdrawOnDepositContract(logs);
  }
}

async function callWithdrawOnDepositContract(logs) {
  const parsedLog = parseEventLogs({
    abi: [
      parseAbiItem(
        "event TokenBridgingInitiated(address indexed from, address indexed recipient, uint256 indexed amount)"
      ),
    ],
    eventName: "TokenBridgingInitiated",
    logs,
  });

  // call NativeTokenDeposit.withdraw
  const walletClient = createWalletClient({
    chain: sepolia,
    transport: http(process.env.SEPOLIA_RPC),
    account: privateKeyToAccount(process.env.PRIVATE_KEY),
  }).extend(publicActions);

  parsedLog.forEach(async (log) => {
    logger.info("Calling withdraw on Sepolia...");
    const { request } = await walletClient.simulateContract({
      address: CONTRACT_ADDRESS.SEP_NATIVE_TOKEN_DEPOSIT,
      abi: [parseAbiItem("function withdraw(address to, uint256 amount)")],
      functionName: "withdraw",
      args: [log.args.recipient, log.args.amount],
    });

    const withdrawTxHash = await walletClient.writeContract(request);

    logger.info(`Withdraw Transaction on Sepolia: ${withdrawTxHash}`);
  });
}
