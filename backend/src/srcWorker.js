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
export async function srcWorker(fromBlock = "latest", toBlock = "latest") {
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(),
  });

  // Listen to event from contract with block range
  const unwatch = publicClient.watchContractEvent({
    address: CONTRACT_ADDRESS.SEP_NATIVE_TOKEN_DEPOSIT,
    abi: [
      parseAbiItem(
        "event TokenDeposited(address indexed from, address indexed recipient, uint256 indexed amount)"
      ),
    ],
    eventName: "TokenDeposited",
    fromBlock,
    toBlock,
    onLogs: (logs) => callMintOnSepETH(logs),
  });

  return unwatch;
}

async function callMintOnSepETH(logs) {
  // Parse logs
  logs.array.forEach(async (log) => {
    const parsedLog = parseEventLogs({
      abi: [
        parseAbiItem(
          "event TokenDeposited(address indexed from, address indexed recipient, uint256 indexed amount)"
        ),
      ],
      eventName: "TokenDeposited",
      logs: log,
    });

    // call SepETH.mint
    const walletClient = createWalletClient({
      chain: gnosis,
      transport: http(),
      account: privateKeyToAccount(process.env.PRIVATE_KEY),
    }).extend(publicActions);

    const { request } = await walletClient.simulateContract({
      address: CONTRACT_ADDRESS.GNO_SEP_ETH,
      abi: [parseAbiItem("function  mint(address to, uint256 amount)")],
      functionName: "mint",
      args: [parsedLog[0].args.recipient, parsedLog[0].args.amount],
    });

    const mintTxHash = await walletClient.writeContract(request);

    console.log("Mint Transaction on Gnosis Chain ", mintTxHash);
  });
}
