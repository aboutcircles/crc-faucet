import { createWalletClient, http, parseAbiItem, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { gnosis } from "viem/chains";
import "dotenv/config";
import fs from "fs";
import csv from "csv-parser";

async function readCsvAddresses() {
  return new Promise((resolve, reject) => {
    const avatarAddresses = [];

    fs.createReadStream("./src/riskScore/filteredRiskScore.csv")
      .pipe(csv({ headers: false }))
      .on("data", (row) => {
        const address = Object.values(row)[0];
        if (address && address.startsWith("0x")) {
          avatarAddresses.push(address);
        }
      })
      .on("end", () => {
        resolve(avatarAddresses);
      })
      .on("error", (error) => {
        reject(error);
      });
  });
}

async function processBatch(gnoClient, addresses, startIndex, endIndex) {
  const batchAddresses = addresses.slice(startIndex, endIndex);
  const expiredArray = new Array(batchAddresses.length).fill(1774908000n); // Timestamp for 2026/03/31

  console.log(
    `Processing batch ${startIndex} to ${endIndex - 1} (${
      batchAddresses.length
    } addresses)`
  );

  const { request } = await gnoClient.simulateContract({
    address: process.env.FAUCET_ORG_CONTRACT,
    abi: [
      parseAbiItem(
        "function setTrust(address[] calldata accounts, expired) public"
      ),
    ],
    functionName: "setTrust",
    args: [batchAddresses, 1774908000n],
  });

  const txHash = await gnoClient.writeContract(request);
  console.log(
    `Set trust Tx hash from index ${startIndex} to ${endIndex - 1}:`,
    txHash
  );

  return txHash;
}

async function main() {
  const account = privateKeyToAccount(process.env.PRIVATE_KEY);
  const gnoClient = createWalletClient({
    chain: gnosis,
    transport: http(),
    account,
  }).extend(publicActions);

  try {
    const avatarAddresses = await readCsvAddresses();
    console.log(`Loaded ${avatarAddresses.length} addresses from CSV`);

    const batchSize = 200;
    for (let i = 0; i < avatarAddresses.length; i += batchSize) {
      const endIndex = Math.min(i + batchSize, avatarAddresses.length);
      await processBatch(gnoClient, avatarAddresses, i, endIndex);

      console.log("Waiting 6 seconds before processing next batch...");
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }

    console.log("Completed processing all addresses");
  } catch (error) {
    console.error("Error processing addresses:", error);
  }
}

main();
