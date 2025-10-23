// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import {Script} from "forge-std/Script.sol";
import {NativeTokenDeposit} from "../src/NativeTokenDeposit.sol";

contract NativeTokenEscrowScript is Script {
    uint256 deployer = vm.envUint("PRIVATE_KEY");

    function setUp() public {}

    function run() public {
        vm.startBroadcast(deployer);

        NativeTokenDeposit nativeTokenDeposit = new NativeTokenDeposit(vm.addr(deployer));

        vm.stopBroadcast();
    }
}
