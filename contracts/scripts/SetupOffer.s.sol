// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {ERC20TokenOfferCycle} from "circles-token-offer/src/ERC20TokenOfferCycle.sol";
import {ERC20TokenOfferFactory} from "circles-token-offer/src/ERC20TokenOfferFactory.sol";
import {ERC20TokenOffer} from "circles-token-offer/src/ERC20TokenOffer.sol";
import {SepETH} from "../src/SepETH.sol";
import {IHubV2} from "circles-contracts-v2/hub/IHub.sol";

contract SetupOfferScript is Script {
    // Arrays to store the final, filtered data
    address[] public addressesArray_1;
    uint256[] public valuesArray_1;
    address[] public addressesArray_2;
    uint256[] public valuesArray_2;
    address[] public addressesArray_3;
    uint256[] public valuesArray_3;
    address[] public addressesArray;
    uint256[] public valuesArray;
    IHubV2 hub = IHubV2(0xc12C1E50ABB450d6205Ea2C3Fa861b3B834d13e8);
    ERC20TokenOfferFactory factory = ERC20TokenOfferFactory(0x43C8e7cb2fea3A55B52867bb521EBf8cb072fECa);
    ERC20TokenOfferCycle cycle;
    ERC20TokenOffer offer;
    SepETH sepETH;
    // List of accepted group CRC
    address[] acceptedGroupCRC = [
        0x08e67f0f22C67DabfA7876CE78908eB448336B45,
        0x09543432cC631BB52a9b65AC0f19F031bFd2aB18,
        0x1557376109ca7564b124e7AC9e96978B21806AE3,
        0x1ACA75e38263c79d9D4F10dF0635cc6FCfe6F026,
        0x1c43a8bE1EEA4875b9bFe096a8714Ca38b78304b,
        0x2b5E4045936ef12250a8c01e4Cbf71E9bEE69e00,
        0x401C07F1b1296EF9b9fC137B54468875E1919a96,
        0x43322ADF67D969219d014D60C860966269F4F93E,
        0x44057a3Af7F746BD4f957fE0b22b1f82423c2B4a,
        0x4E2564e5df6C1Fb10C1A018538de36E4D5844DE5,
        0x4f21a0724C1AbC3Df4f157E245D5272c6D9C4735,
        0x59075e386576D770083748A5b474b1C5E7f99Af2,
        0x6Db96207aB21c908F7c66C3A14f7e5faFCa7aF15,
        0x86533d1aDA8Ffbe7b6F7244F9A1b707f7f3e239b,
        0x8ef24265D591c674e222c5A27332DbAE5929eD74,
        0x9032b9dA21eAf98B78F675576E81dA847B94E21C,
        0x928D086Ffe4506bd1e0f9d5F11676afe9081d5Fd,
        0x9D4b8617988921D5a36aC605d83DF7395bF57De3,
        0xA90a9b3e6F0c5eDBcBaeda11BF630a652BC77518,
        0xBB09Fb833D5fA0A210fef144A9592E74a6e198df,
        0xbfCE3136DBE261E4DBd757bB9a718BeD8a9993d5,
        0xc3E12D39BE3e5fF9f7bd5cA17636301ee0598730,
        0xC64Df4a72c62DEBbb46664303f5EEBE749AE2C52,
        0xEb614eF61367687704CD4628a68A02F3B10ce68C,
        0xf1091ED8a6f72a27f97969818bA29031Aa6E58bf
    ];

    uint256 deployer = vm.envUint("PRIVATE_KEY");
    address cycleOwner = vm.addr(deployer);
    uint256 offerStart = block.timestamp;
    uint256 offerDuration = 10; // 10 blocks
    string offerName = "CRC-SepETH offer";
    string cycleName = "CRC-SepETH offer cycle";

    function setUp() public {
        vm.startBroadcast(deployer);
  
        uint256 initialTotalSupply = 1e40 ether;
        sepETH = new SepETH(cycleOwner);
        sepETH.mint(cycleOwner, initialTotalSupply);

        sepETH = SepETH(0x886AB8111209BE56e59A814b3b8A58d66eC4C3c3);

        address offerToken = address(sepETH);
        

        cycle = ERC20TokenOfferCycle(
            factory.createERC20TokenOfferCycle(
                cycleOwner, offerToken, offerStart, offerDuration, false, offerName, cycleName
            )
        );

        sepETH.approve(address(cycle), type(uint256).max);
        vm.stopBroadcast();
    }

    function run() public {
        uint256 tokenPriceInCRC = 480 ether;
        uint256 offerLimitInCRC = 24 ether;

        // Start the script transaction
        vm.startBroadcast(deployer);

        string memory csvContent = vm.readFile("scripts/filtered_riskscore.csv");
        parseCsvContent(csvContent);

        require(addressesArray.length == valuesArray.length, "Array lengths must match");
        console.log("Total entries read:", addressesArray.length);

        if (addressesArray.length > 0) {
            console.log("First Address:");
            console.log(addressesArray[0]);
            console.log("First Value:");
            console.log(valuesArray[0]);
        }

        createNextCycle(cycleOwner, tokenPriceInCRC, offerLimitInCRC, addressesArray, valuesArray);
        vm.stopBroadcast();
    }

    function createNextCycle(
        address cycleOwner,
        uint256 tokenPriceInCRC,
        uint256 offerLimitInCRC,
        address[] memory trustedAccs,
        uint256[] memory weights
    ) public {
        // offer = ERC20TokenOffer(cycle.createNextOffer(tokenPriceInCRC, offerLimitInCRC, acceptedGroupCRC));
        // cycle.setNextOfferAccountWeights(addressesArray_1, valuesArray_1);
        // cycle.setNextOfferAccountWeights(addressesArray_2, valuesArray_2);
        // cycle.setNextOfferAccountWeights(addressesArray_3, valuesArray_3);
    cycle = ERC20TokenOfferCycle(0x53a69f8A6570848f4918def201f81E34a4A4B54a);
        cycle.depositNextOfferTokens();
    // TODO: fix
    // ├─ [5690] 0x53a69f8A6570848f4918def201f81E34a4A4B54a::depositNextOfferTokens()
    // │   ├─ [0] 0x0000000000000000000000000000000000000000::getRequiredOfferTokenAmount() [staticcall]
    // │   │   └─ ← [Stop]
    // │   └─ ← [Revert] call to non-contract address 0x0000000000000000000000000000000000000000
    // └─ ← [Revert] call to non-contract address 0x0000000000000000000000000000000000000000
        // cycle.syncOfferTrust();


    }

    /// @notice Parse CSV content and populate arrays
    /// @param csvContent The full CSV file content as a string
    function parseCsvContent(string memory csvContent) internal {
        // Split by newlines (handle both \n and \r\n)
        string[] memory lines = splitString(csvContent, "\n");

        for (uint256 i = 0; i < lines.length; i++) {
            // Trim the line to remove any \r or whitespace
            string memory line = trim(lines[i]);

            if (bytes(line).length == 0) continue; // Skip empty lines

            // Split the line by commas
            string[] memory columns = splitString(line, ",");

            if (columns.length >= 3) {
                // Parse address (column 0)
                address addr = vm.parseAddress(trim(columns[0]));

                // Parse uint256 value (column 2) - trim to remove any \r or whitespace
                uint256 value = vm.parseUint(trim(columns[2]));

                // Filter out zero addresses (optional)
                if (addr != address(0)) {
                    if (i < 1000) {
                        addressesArray_1.push(addr);
                        valuesArray_1.push(value);
                        addressesArray.push(addr);
                        valuesArray.push(value);
                    } else if (i >= 1000 && i < 2000) {
                        addressesArray_2.push(addr);
                        valuesArray_2.push(value);
                        addressesArray.push(addr);
                        valuesArray.push(value);
                    } else {
                        addressesArray_3.push(addr);
                        valuesArray_3.push(value);
                        addressesArray.push(addr);
                        valuesArray.push(value);
                    }
                }
            }
        }
    }

    /// @notice Trim whitespace and carriage returns from a string
    /// @param str The string to trim
    /// @return The trimmed string
    function trim(string memory str) internal pure returns (string memory) {
        bytes memory strBytes = bytes(str);

        if (strBytes.length == 0) {
            return str;
        }

        uint256 start = 0;
        uint256 end = strBytes.length;

        // Trim from the end (remove \r, \n, spaces, tabs)
        while (
            end > start
                && (
                    strBytes[end - 1] == 0x0d // \r
                        || strBytes[end - 1] == 0x0a // \n
                        || strBytes[end - 1] == 0x20 // space
                        || strBytes[end - 1] == 0x09
                ) // tab
        ) {
            end--;
        }

        // Trim from the start
        while (
            start < end
                && (
                    strBytes[start] == 0x0d || strBytes[start] == 0x0a || strBytes[start] == 0x20 || strBytes[start] == 0x09
                )
        ) {
            start++;
        }

        // Extract trimmed portion
        bytes memory result = new bytes(end - start);
        for (uint256 i = 0; i < end - start; i++) {
            result[i] = strBytes[start + i];
        }

        return string(result);
    }

    /// @notice Split a string by a delimiter
    /// @param str The string to split
    /// @param delimiter The delimiter character
    /// @return An array of substrings
    function splitString(string memory str, string memory delimiter) internal pure returns (string[] memory) {
        bytes memory strBytes = bytes(str);
        bytes memory delimBytes = bytes(delimiter);

        if (strBytes.length == 0) {
            return new string[](0);
        }

        // Count occurrences of delimiter
        uint256 count = 1;
        for (uint256 i = 0; i < strBytes.length; i++) {
            if (strBytes[i] == delimBytes[0]) {
                count++;
            }
        }

        // Split the string
        string[] memory result = new string[](count);
        uint256 resultIndex = 0;
        uint256 startIndex = 0;

        for (uint256 i = 0; i < strBytes.length; i++) {
            if (strBytes[i] == delimBytes[0]) {
                result[resultIndex] = substring(str, startIndex, i);
                resultIndex++;
                startIndex = i + 1;
            }
        }

        // Add the last part
        result[resultIndex] = substring(str, startIndex, strBytes.length);

        return result;
    }

    /// @notice Extract a substring
    /// @param str The source string
    /// @param startIndex Starting index (inclusive)
    /// @param endIndex Ending index (exclusive)
    /// @return The substring
    function substring(string memory str, uint256 startIndex, uint256 endIndex) internal pure returns (string memory) {
        bytes memory strBytes = bytes(str);
        bytes memory result = new bytes(endIndex - startIndex);

        for (uint256 i = startIndex; i < endIndex; i++) {
            result[i - startIndex] = strBytes[i];
        }

        return string(result);
    }
}
