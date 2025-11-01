// This script should be able to create offer daily to mimic the experience
// Check the Setup offer script
// 0. Withdraw from the previous offer by calling cycle.withdraw
// 1. cycle.createNextOffer
// 2. cycle.setNextOfferAccountWeights
// 3. At the offerStart timestamp, call cycle.depositnextOfferTokens

import {
  createWalletClient,
  http,
  parseAbi,
  parseAbiItem,
  parseEther,
  publicActions,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { gnosis } from "viem/chains";
import "dotenv/config";

import { CirclesData, CirclesRpc } from "@circles-sdk/data";

async function main() {
  const cycleAddress = "0x5c746355cff9b438635370f431669e73e3896576";
  // Cycle address is predeployed
  const factory = "0x81DAdfE2E8EcAa8941bf9133E1c521C75D76d52a";
  const account = privateKeyToAccount(process.env.PRIVATE_KEY);

  const gnoClient = createWalletClient({
    chain: gnosis,
    transport: http(),
    account,
  }).extend(publicActions);

  //   await createNextOffer(
  //     gnoClient,
  //     cycleAddress,
  //     parseEther("480"),
  //     parseEther("24"),
  //     account
  //   );
  //   await withdrawUnclaimOfferToken(
  //     "0xbda71ea85c423a7bac81983248d0d68eed3c3065",
  //     gnoClient,
  //     2
  //   );

  await callSetNextAccountWeight(cycleAddress, gnoClient);
}

async function withdrawUnclaimOfferToken(cycleAddress, client, offerId) {
  const { request } = await client.simulateContract({
    address: cycleAddress,
    abi: [
      parseAbiItem("function withdrawUnclaimedOfferTokens(uint256 offerId)"),
    ],
    functionName: "withdrawUnclaimedOfferTokens",
    args: [offerId],
  });

  const txHash = await client.writeContract(request);
  console.log("Withdraw unclaim token ", txHash);
}

async function createNewTokenOffer(
  client,
  factory,
  cycleOwner,
  offerToken,
  offerStart,
  offerDuration,
  offerName,
  cycleName
) {
  // call createERC20TokenOfferCycle on factory contract

  const { request, result } = await client.simulateContract({
    address: factory,
    abi: [
      parseAbiItem(
        "function createERC20TokenOfferCycle(address cycleOwner, address offerToken,uint256 offersStart,uint256 offerDuration,bool enableSoftLock,string memory offerName,string memory cycleName) external returns (address offerCycle)"
      ),
    ],
    functionName: "createERC20TokenOfferCycle",
    args: [
      cycleOwner,
      offerToken,
      offerStart,
      offerDuration,
      false,
      offerName,
      cycleName,
    ],
  });

  console.log("Cycle contract address ", result);

  const txHash = await client.writeContract(request);

  console.log("Create TokenOfferCycle txHash ", txHash);
  // Approve token cycle
  // TODO
}

async function createNextOffer(
  client,
  cycleAddress,
  tokenPriceInCRC,
  offerLimitInCRC,
  account
) {
  // read
  // Impossible to use all the personal CRC as trusted CRC because it exceeds the gas limit of a single block
  // Alternative: use groupCRC, but user need to have to group CRC instead
  // Solution: on contract level, trust the personal CRC, don't use groupCRC

  const { request, result } = await client.simulateContract({
    address: cycleAddress,
    abi: [
      parseAbiItem(
        "function createNextOffer(uint256 tokenPriceInCRC, uint256 offerLimitInCRC, address[] memory _acceptedCRC) returns (address nextOffer)"
      ),
    ],
    functionName: "createNextOffer",
    args: [tokenPriceInCRC, offerLimitInCRC, []],
    account,
  });

  console.log("Offer contract address ", result);
  const txHash = await client.writeContract(request);

  console.log("createNextOffer Tx Hash", txHash);
}

async function callSetNextAccountWeight(cycleAddress, client) {
  //   const { addressArray, weightArray } = await fetchAddressesAndWeight();
  //   let newAddressArray = [];
  //   let newWeightArray = [];
  //   let j = 1;
  //   for (let i = 0; i < addressArray.length; i++) {
  //     newAddressArray.push(addressArray[i]);
  //     newWeightArray.push(weightArray[i]);
  //     if (newAddressArray.length == 300 || i == addressArray.length - 1) {
  //       // call function
  //       console.log("Batch collected", j);
  //       j++;

  /// /This is needed
  //   const { request } = await client.simulateContract({
  //     address: cycleAddress,
  //     abi: [
  //       parseAbiItem(
  //         "function setNextOfferAccountWeightsWithTrust(address[] memory accounts, uint256[] memory weights) external"
  //       ),
  //     ],
  //     functionName: "setNextOfferAccountWeightsWithTrust",
  //     args: [[""], []],
  //   });

  //   const txHash = await client.writeContract(request);

  //   console.log(
  //     "Write setNextOfferAccountWeigths tx hash ",
  //     txHash,
  //     " for batch ",
  //     j
  //   );

  //   // wait for 2 blocks (10 s)
  //   await new Promise((resolve) => setTimeout(resolve, 10 * 1000));

  //   // clear to empty
  //   newAddressArray = [];
  //   newWeightArray = [];
  // }
  //   }

  // call depositNextOfferToken

  const { request: depositRequest } = await client.simulateContract({
    address: cycleAddress,
    abi: [parseAbiItem("function depositNextOfferTokens(uint256 amount)")],
    functionName: "depositNextOfferTokens",
    args: [parseEther("0.01")],
  });

  const depositTxHash = await client.writeContract(depositRequest);

  console.log("Deposit txHash ", depositTxHash);
}
async function fetchAddressesAndWeight() {
  // Read from file ./riskScore/filteredRiskScore.csv
  const fs = await import("fs");
  const path = await import("path");

  const csvPath = path.join(
    process.cwd(),
    "src",
    "riskScore",
    "filteredRiskScore.csv"
  );
  const csvData = fs.readFileSync(csvPath, "utf8");

  let addressArray = [];
  let weightArray = [];

  // push the first element of each row in addressArray
  // push the third element of each row in weightArray
  const rows = csvData.trim().split("\n");
  for (const row of rows) {
    const columns = row.split(",");
    addressArray.push(columns[0]);
    weightArray.push(parseInt(columns[2]));
  }

  // console.log the last 2 element from both array
  console.log("Last 2 addresses:", addressArray.slice(-2));
  console.log("Last 2 weights:", weightArray.slice(-2));

  // show the length of both array
  console.log("Address array length:", addressArray.length);
  console.log("Weight array length:", weightArray.length);
  return { addressArray, weightArray };
}

async function grpToMintHandler(groupAddress) {
  if (groupAddress == "0x86533d1ada8ffbe7b6f7244f9a1b707f7f3e239b") {
    return "0xB621C895C44C88cBCE3d243925fF9755FBf21408";
  }

  // redirect to https://app.metri.xyz/transfer/0xB621C895C44C88cBCE3d243925fF9755FBf21408/crc/24
  // send 24 personal CRC
}
main();
