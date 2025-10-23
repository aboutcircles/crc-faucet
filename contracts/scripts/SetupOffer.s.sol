// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {ERC20TokenOfferCycle} from "circles-token-offer/src/ERC20TokenOfferCycle.sol";
import {ERC20TokenOfferFactory} from "circles-token-offer/src/ERC20TokenOfferFactory.sol";
import {ERC20TokenOffer} from "circles-token-offer/src/ERC20TokenOffer.sol";
import {SepETH} from "../src/SepETH.sol";

contract SetupOfferScript is Script {
    // Arrays to store the final, filtered data
    address[] public addressesArray;
    uint256[] public valuesArray;

    ERC20TokenOfferFactory factory;
    ERC20TokenOfferCycle cycle;
    ERC20TokenOffer offer;
    SepETH sepETH;

    uint256 deployer = vm.envUint("PRIVATE_KEY");
    address cycleOwner = vm.addr(deployer);
    uint256 offerStart = block.timestamp;
    uint256 offerDuration = 1 weeks;
    string offerName = "CRC-SepETH offer";
    string cycleName = "CRC-SepETH offer cycle";

    function setUp() public {
        vm.startBroadcast(deployer);
        uint256 initialTotalSupply = 1e40 ether;
        sepETH = new SepETH(cycleOwner);
        sepETH.mint(cycleOwner, initialTotalSupply);
        address offerToken = address(sepETH);
        factory = new ERC20TokenOfferFactory();

        cycle = ERC20TokenOfferCycle(
            factory.createERC20TokenOfferCycle(
                cycleOwner, offerToken, offerStart, offerDuration, false, offerName, cycleName
            )
        );

        sepETH.approve(address(cycle), type(uint256).max);
        vm.stopBroadcast();
    }

    function run() public {
        uint256 tokenPriceInCRC = 24 ether;
        uint256 offerLimitInCRC = 10 ether;

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
        offer = ERC20TokenOffer(cycle.createNextOffer(tokenPriceInCRC, offerLimitInCRC, trustedAccs));
        cycle.setNextOfferAccountWeights(trustedAccs, weights);

        cycle.depositNextOfferTokens();

        cycle.syncOfferTrust();
    }

    /// @notice Parse CSV content and populate arrays
    /// @param csvContent The full CSV file content as a string
    function parseCsvContent(string memory csvContent) internal {
        // Split by newlines (handle both \n and \r\n)
        string[] memory lines = splitString(csvContent, "\n");

        // Process all data rows
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
                    addressesArray.push(addr);
                    valuesArray.push(value);
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
