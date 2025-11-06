// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {FaucetOrg} from "../src/FaucetOrg.sol";

contract FaucetOrgScript is Script {
    FaucetOrg public faucetOrg; // 0xb225E9d8A67363F7759dbeBF63bDF9B151aB2e02.

    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        address beneficiary = 0x1ba1594906461AeBA65b52A914E1545B5F928cCc;
        faucetOrg = new FaucetOrg("Sepolia ETH", 24, 1 ether, beneficiary);

        vm.stopBroadcast();
    }
}
