// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import {Script} from "forge-std/Script.sol";
import {SepETH} from "../src/SepETH.sol";

contract NativeTokenEscrowScript is Script {
    uint256 deployer = vm.envUint("PRIVATE_KEY");

    function setUp() public {}

    function run() public {
        vm.startBroadcast(deployer);

        SepETH sepETH = new SepETH(vm.addr(deployer));

        vm.stopBroadcast();
    }
}
