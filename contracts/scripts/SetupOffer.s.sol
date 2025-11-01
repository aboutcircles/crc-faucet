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
    address[] public addressesArray_4;
    uint256[] public valuesArray_4;
    address[] public addressesArray_5;
    uint256[] public valuesArray_5;
    address[] public addressesArray_6;
    uint256[] public valuesArray_6;
    address[] public addressesArray_7;
    uint256[] public valuesArray_7;
    address[] public addressesArray_8;
    uint256[] public valuesArray_8;
    address[] public addressesArray_9;
    uint256[] public valuesArray_9;
    address[] public addressesArray_10;
    uint256[] public valuesArray_10;
    address[] public addressesArray_11;
    uint256[] public valuesArray_11;

    address[] public addressesArray;
    uint256[] public valuesArray;
    IHubV2 hub = IHubV2(0xc12C1E50ABB450d6205Ea2C3Fa861b3B834d13e8);

    // https://gnosisscan.io/address/0x81DAdfE2E8EcAa8941bf9133E1c521C75D76d52a
    ERC20TokenOfferFactory factory = ERC20TokenOfferFactory(0x81DAdfE2E8EcAa8941bf9133E1c521C75D76d52a);
    ERC20TokenOfferCycle cycle;
    ERC20TokenOffer offer;
    SepETH sepETH;
    address[] acceptedPersonalCRC; // = addressesArray
    // List of accepted group CRC
    // address[] acceptedGroupCRC = [
    //     0x86533d1ada8ffbe7b6f7244f9a1b707f7f3e239b // Metri Core Group
    // ]
    

    uint256 deployer = vm.envUint("PRIVATE_KEY");
    address cycleOwner = vm.addr(deployer);
    uint256 offerStart = block.timestamp + 10; // 1 mins from now
    uint256 offerDuration = 15 minutes; // 10 blocks
    string offerName = "CRC-SepETH offer";
    string cycleName = "CRC-SepETH offer cycle";

    // createNextOffer (offerStart date) |offerId = 0:  offerStart ----- offerEnd | offerId = 1:  offerStart ----- offerEnd | 
    function setUp() public {
        vm.startBroadcast(deployer);

        // uint256 initialTotalSupply = 1e40 ether;
        // sepETH = new SepETH(cycleOwner);
        // sepETH.mint(cycleOwner, initialTotalSupply);

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
        uint256 offerLimitInCRC = 24 ether; // 168 = 7 * 24 for 1 week

        // Start the script transaction
        vm.startBroadcast(deployer);

        // string memory csvContent = vm.readFile("scripts/filtered_riskscore.csv");
        // parseCsvContent(csvContent);

        // require(addressesArray.length == valuesArray.length, "Array lengths must match");
        // console.log("Total entries read:", addressesArray.length);

        // if (addressesArray.length > 0) {
        //     console.log("First Address:");
        //     console.log(addressesArray[0]);
        //     console.log("First Value:");
        //     console.log(valuesArray[0]);
        // }

     //   createNextCycle(cycleOwner, tokenPriceInCRC, offerLimitInCRC, addressesArray, valuesArray);
        vm.stopBroadcast();
    }

    function createNextCycle(
        address cycleOwner,
        uint256 tokenPriceInCRC,
        uint256 offerLimitInCRC,
        address[] memory trustedAccs,
        uint256[] memory weights
    ) public {
    // cycle = ERC20TokenOfferCycle(0x37AE77d08CdCAbec947C2617bfE4F4915122A3d6);
    //  address[] memory acceptedGroupCRC;
    //  offer = ERC20TokenOffer(cycle.createNextOffer(tokenPriceInCRC, offerLimitInCRC, acceptedGroupCRC));

    // //     /// =================== Next batch =============================
    //     address[] memory accounts = new address[](1);
    //     accounts[0] = 0x948F7b1Ff398fA2994e4980ecDBe2c040E7273bc;
    //     uint256[] memory weights = new uint256[](1);
    //     weights[0] = 887899;
    //     cycle.setNextOfferAccountWeights(accounts, weights);


      // cycle.setNextOfferAccountWeights(addressesArray_1, valuesArray_1);
       // cycle.setNextOfferAccountWeights(addressesArray_2, valuesArray_2);
        // cycle.setNextOfferAccountWeights(addressesArray_3, valuesArray_3);
       //  cycle.setNextOfferAccountWeights(addressesArray_4, valuesArray_4);
      //  cycle.setNextOfferAccountWeights(addressesArray_5, valuesArray_5);
        // cycle.setNextOfferAccountWeights(addressesArray_6, valuesArray_6);
        // cycle.setNextOfferAccountWeights(addressesArray_7, valuesArray_7);
         //  cycle.setNextOfferAccountWeights(addressesArray_8, valuesArray_8);
            //cycle.setNextOfferAccountWeights(addressesArray_9, valuesArray_9);
          //     cycle.setNextOfferAccountWeights(addressesArray_10, valuesArray_10);
              //   cycle.setNextOfferAccountWeights(addressesArray_11, valuesArray_11);
        //  cycle.depositNextOfferTokens(0.1 ether);

     //   cycle.syncOfferTrust();
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
                    if (i < 300) {
                        addressesArray_1.push(addr);
                        valuesArray_1.push(value);
                    } else if (i >= 300 && i < 600) {
                        addressesArray_2.push(addr);
                        valuesArray_2.push(value);
                    } else if (i >= 600 && i < 900) {
                        addressesArray_3.push(addr);
                        valuesArray_3.push(value);
                    } else if (i >= 900 && i < 1200) {
                        addressesArray_4.push(addr);
                        valuesArray_4.push(value);
                    } else if (i >= 1200 && i < 1500) {
                        addressesArray_5.push(addr);
                        valuesArray_5.push(value);
                    } else if (i >= 1500 && i < 1800) {
                        addressesArray_6.push(addr);
                        valuesArray_6.push(value);
                    }else if (i >= 1800 && i < 2100){
                         addressesArray_7.push(addr);
                        valuesArray_7.push(value);
                    }else if (i >= 2100 && i < 2400){
                         addressesArray_8.push(addr);
                        valuesArray_8.push(value);
                    }else if (i >= 2400 && i < 2700){
                         addressesArray_9.push(addr);
                        valuesArray_9.push(value);
                    }else if (i >= 2700 && i < 3000){
                         addressesArray_10.push(addr);
                        valuesArray_10.push(value);
                    }else{
                         addressesArray_11.push(addr);
                        valuesArray_11.push(value);
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
