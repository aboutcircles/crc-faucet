// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {FaucetOrg} from "../src/FaucetOrg.sol";

contract FaucetOrgScript is Script {
    FaucetOrg public faucetOrg; 

    function setUp() public {}

    function run() public {
        vm.startBroadcast("");

        faucetOrg = new FaucetOrg("Sepolia ETH", 24, 1 ether);

        vm.stopBroadcast();
    }
}
