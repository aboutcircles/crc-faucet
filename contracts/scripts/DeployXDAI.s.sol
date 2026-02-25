// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {FaucetXDAI} from "src/FaucetXDAI.sol";

contract XDAIScript is Script {
    FaucetXDAI public faucet; // 0xbBD0173aafB8b52d6910DD3836dCFE85fc25CA8a
    address owner = address(0x76D393823593c919f27a89a202e1c68AC42828af);
    address deployer = address(0xBB59D9a10f6F0a391E690BF2ba95F34fd6C75494);

    function setUp() public {}

    function run() public {
        vm.startBroadcast(deployer);
        
        faucet = new FaucetXDAI(owner);

        vm.stopBroadcast();
    }
}
