import {
  createPublicClient,
  createWalletClient,
  parseAbiItem,
  parseEventLogs,
  publicActions,
  http,
} from "viem";
import { gnosis, sepolia } from "viem/chains";
import { CONTRACT_ADDRESS } from "./constants.js";
import { privateKeyToAccount } from "viem/accounts";
export async function dstWorker(fromBlock = "latest", toBlock = "latest") {
  const publicClient = createPublicClient({
    chain: gnosis,
    transport: http(),
  });

  // Listen to event from contract
  const unwatch = publicClient.watchContractEvent({
    address: CONTRACT_ADDRESS.GNO_SEP_ETH, //
    abi: [
      parseAbiItem(
        "event TokenBridgingInitiated(address indexed from, address indexed recipient, uint256 indexed amount)"
      ),
    ],
    eventName: "TokenBridgingInitiated",
    fromBlock,
    toBlock,
    onLogs: (logs) => callWithdrawOnDepositContract(logs),
  });
}

async function callWithdrawOnDepositContract(logs) {
  // Parse logs
  logs.array.forEach(async (log) => {
    const parsedLog = parseEventLogs({
      abi: [
        parseAbiItem(
          "event TokenBridgingInitiated(address indexed from, address indexed recipient, uint256 indexed amount)"
        ),
      ],
      eventName: "TokenBridgingInitiated",
      logs: log,
    });

    // call NativeTokenDeposit.withdraw
    const walletClient = createWalletClient({
      chain: sepolia,
      transport: http(),
      account: privateKeyToAccount(process.env.PRIVATE_KEY),
    }).extend(publicActions);

    const { request } = await walletClient.simulateContract({
      address: CONTRACT_ADDRESS.SEP_NATIVE_TOKEN_DEPOSIT,
      abi: [parseAbiItem("function withdraw(address to, uint256 amount)")],
      functionName: "withdraw",
      args: [parsedLog[0].args.recipient, parsedLog[0].args.amount],
    });

    const withdrawTxHash = await walletClient.writeContract(request);

    console.log("Mint Transaction on Sepolia ", withdrawTxHash);
  });
}
