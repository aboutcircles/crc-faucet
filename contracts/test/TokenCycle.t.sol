// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import {Test, console} from "forge-std/Test.sol";
import {ERC20TokenOfferFactory} from "circles-token-offer/src/ERC20TokenOfferFactory.sol";
import {CirclesV2Setup} from "./helper/CirclesV2Setup.sol";
import {ERC20TokenOfferCycle} from "circles-token-offer/src/ERC20TokenOfferCycle.sol";
import {ERC20TokenOffer} from "circles-token-offer/src/ERC20TokenOffer.sol";
import {SepETH} from "../src/SepETH.sol";
import {HubStorageWrites} from "./helper/HubStorageWrites.sol";

interface IERC1155 {
    function isApprovedForAll(address _owner, address _operator) external view returns (bool);
}

contract TokenCycleTest is CirclesV2Setup, HubStorageWrites {
    // Skip using Group CRC for testing for now in this environment

    address cycleOwner = makeAddr("owner");
    address offerToken;
    uint256 offerStart;
    uint256 offerDuration = 1 weeks;

    string offerName = "CRC-SepETH offer";
    string cycleName = "CRC-SepETH offer cycle";
    SepETH sepETH;

    address[] testAccounts = [
        address(0xF7bD3d83df90B4682725ADf668791D4D1499207f),
        address(0xDE374ece6fA50e781E81Aac78e811b33D16912c7),
        address(0x13285C44F9B70C807085621b9e1dd66C9daF23A8)
    ];

    uint64 internal TODAY; // day in HUB
    ERC20TokenOfferCycle cycle;
    ERC20TokenOfferFactory factory;
    ERC20TokenOffer offer;

    function setUp() public override {
        super.setUp();
        vm.warp(INVITATION_ONLY_TIME + 1 days);
        TODAY = HUB_V2.day(block.timestamp);
        // Deploy sepETH
        sepETH = new SepETH(cycleOwner);
        offerToken = address(sepETH);

        deal(offerToken, cycleOwner, 1_000 ether);
        // make from test addresses circles users and fund with accepted crc balances

        for (uint256 i; i < testAccounts.length; i++) {
            _registerHuman(testAccounts[i]);
            _setCRCBalance(uint256(uint160(testAccounts[i])), testAccounts[i], TODAY, 2000 ether);
        }

        offerStart = block.timestamp + 1 days;

        factory = new ERC20TokenOfferFactory();
        cycle = ERC20TokenOfferCycle(
            factory.createERC20TokenOfferCycle(
                cycleOwner, offerToken, offerStart, offerDuration, false, offerName, cycleName
            )
        );

        // make owner approve cycle to spend all sepETH
        vm.prank(cycleOwner);
        sepETH.approve(address(cycle), type(uint256).max);
    }

    function test_CreateNextCycle() public {
        uint256 tokenPriceInCRC = 480 ether; // 480 CRC / ETH
        uint256 offerLimitInCRC = 1 ether;

        // acceptedCRC are personal CRC, skip the group CRC for now
        // first create next offer
        vm.prank(cycleOwner);
        offer = ERC20TokenOffer(cycle.createNextOffer(tokenPriceInCRC, offerLimitInCRC, testAccounts));

        uint256[] memory weights = new uint256[](3);
        weights[0] = 500_000; // 50%
        weights[1] = 10_00_000; // 100%
        weights[2] = 2_800_000; // 280%

        // second write eligible accounts weights
        vm.prank(cycleOwner);
        cycle.setNextOfferAccountWeights(testAccounts, weights);

        // third deposit tokens
        vm.prank(cycleOwner);
        cycle.depositNextOfferTokens();

        // move in time

        vm.warp(offerStart + 1);
        assertEq(cycle.currentOfferId(), 1);
        assertEq(address(cycle.currentOffer()), address(offer));
        // last sync cycle/offer trust
        cycle.syncOfferTrust();

        // Transfer CRC into the offer

        assertTrue(cycle.isOfferAvailable());

        uint256 accountOfferLimit = offer.getAccountOfferLimit(testAccounts[1]);
        vm.startPrank(testAccounts[1]);
        HUB_V2.safeTransferFrom(
            testAccounts[1], address(cycle), uint256(uint160(testAccounts[1])), accountOfferLimit, ""
        );

        vm.stopPrank();
        uint256 sepETHAmount = accountOfferLimit * (10 ** 18) / tokenPriceInCRC;
        assertEq(sepETH.balanceOf(testAccounts[1]), sepETHAmount);
    }
}
