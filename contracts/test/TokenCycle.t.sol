// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import {Test, console} from "forge-std/Test.sol";
import {ERC20TokenOfferFactory} from "circles-token-offer/src/ERC20TokenOfferFactory.sol";
import {CirclesV2Setup} from "./helper/CirclesV2Setup.sol";
import {ERC20TokenOfferCycle} from "circles-token-offer/src/ERC20TokenOfferCycle.sol";
import {ERC20TokenOffer} from "circles-token-offer/src/ERC20TokenOffer.sol";
import {SepETH} from "../src/SepETH.sol";
import {HubStorageWrites} from "./helper/HubStorageWrites.sol";

contract TokenCycleTest is CirclesV2Setup, HubStorageWrites {
    // Skip using Group CRC for testing for now in CirclesV2Setup environment

    address cycleOwner = makeAddr("owner");
    address offerToken;
    uint256 offerStart;
    uint256 offerDuration = 1 weeks;

    string offerName = "CRC-SepETH offer";
    string cycleName = "CRC-SepETH offer cycle";
    SepETH sepETH;

    address[] testAccounts = [makeAddr("alice"), makeAddr("bob"), makeAddr("cris")];
    address[] invalidAccounts = [makeAddr("alica"), makeAddr("bobe"), makeAddr("crise")];

    uint64 internal TODAY; // day in HUB
    ERC20TokenOfferCycle cycle;
    ERC20TokenOfferFactory factory;
    ERC20TokenOffer offer;

    error InvalidTokenId(uint256 tokenId);

    function setUp() public override {
        super.setUp();
        vm.warp(INVITATION_ONLY_TIME + 1 days);
        TODAY = HUB_V2.day(block.timestamp);
        // Deploy sepETH
        sepETH = new SepETH(cycleOwner);
        offerToken = address(sepETH);

        deal(offerToken, cycleOwner, 1_000 ether);

        for (uint256 i; i < testAccounts.length; i++) {
            _registerHuman(testAccounts[i]);
            _setCRCBalance(uint256(uint160(testAccounts[i])), testAccounts[i], TODAY, 2000 ether);
            _registerHuman(invalidAccounts[i]);
            _setCRCBalance(uint256(uint160(invalidAccounts[i])), invalidAccounts[i], TODAY, 2000 ether);
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
        uint256 tokenPriceInCRC = 24 ether;
        uint256 offerLimitInCRC = 10 ether;
        uint256[] memory weights = new uint256[](3);
        weights[0] = 5_000;
        weights[1] = 10_000;
        weights[2] = 9_000;

        // acceptedCRC are personal CRC, skip the group CRC
        _createNewOfferCycle(cycleOwner, tokenPriceInCRC, offerLimitInCRC, testAccounts, weights);

        vm.warp(offerStart + 1);
        assertEq(cycle.currentOfferId(), 1);
        assertEq(address(cycle.currentOffer()), address(offer));

        assertTrue(cycle.isOfferAvailable());

        uint256 account1OfferLimit = offer.getAccountOfferLimit(testAccounts[0]);
        vm.startPrank(testAccounts[0]);
        HUB_V2.safeTransferFrom(
            testAccounts[0], address(cycle), uint256(uint160(testAccounts[0])), account1OfferLimit, ""
        );

        vm.stopPrank();
        assertEq(sepETH.balanceOf(testAccounts[0]), account1OfferLimit * (10 ** 18) / tokenPriceInCRC);

        vm.startPrank(testAccounts[1]);
        uint256 account2OfferLimit = offer.getAccountOfferLimit(testAccounts[1]);
        vm.startPrank(testAccounts[1]);
        HUB_V2.safeTransferFrom(
            testAccounts[1], address(cycle), uint256(uint160(testAccounts[1])), account2OfferLimit, ""
        );
        vm.stopPrank();
        assertEq(sepETH.balanceOf(testAccounts[1]), account2OfferLimit * (10 ** 18) / tokenPriceInCRC);

        vm.startPrank(testAccounts[2]);
        uint256 account3OfferLimit = offer.getAccountOfferLimit(testAccounts[2]);
        vm.startPrank(testAccounts[2]);
        HUB_V2.safeTransferFrom(
            testAccounts[2], address(cycle), uint256(uint160(testAccounts[2])), account3OfferLimit, ""
        );
        vm.stopPrank();
        assertEq(sepETH.balanceOf(testAccounts[2]), account3OfferLimit * (10 ** 18) / tokenPriceInCRC);

        assertEq(sepETH.balanceOf(address(offer)), 1); // rounding error with 1 sepETH still left in the offer contract

        vm.startPrank(invalidAccounts[0]);
        vm.expectRevert();
        HUB_V2.safeTransferFrom(
            invalidAccounts[0], address(cycle), uint256(uint160(invalidAccounts[0])), account1OfferLimit, ""
        );
        vm.stopPrank();

        /// Create another offer
        tokenPriceInCRC = 200 ether;
        offerLimitInCRC = 100 ether;
        weights[0] = 20_000;
        weights[1] = 30_000;
        weights[2] = 18_000;

        _createNewOfferCycle(cycleOwner, tokenPriceInCRC, offerLimitInCRC, testAccounts, weights);
        vm.warp(block.timestamp + offerDuration + 1);
        assertTrue(offer.isOfferAvailable());
        assertEq(cycle.currentOfferId(), 2);

        vm.warp(block.timestamp + offerDuration);
        // claim back
        uint256 sepETHBalanceOwner = sepETH.balanceOf(cycleOwner);
        uint256 sepETHBalanceOffer = sepETH.balanceOf(address(offer));
        assertEq(address(cycle), offer.OWNER());
        vm.startPrank(cycleOwner);
        // Claim back offerId 2
        cycle.withdrawUnclaimedOfferTokens(2);
        vm.stopPrank();
        assertEq(sepETH.balanceOf(cycleOwner), sepETHBalanceOwner + sepETHBalanceOffer);
    }

    function _createNewOfferCycle(
        address cycleOwner,
        uint256 tokenPriceInCRC,
        uint256 offerLimitInCRC,
        address[] memory trustedAccs,
        uint256[] memory weights
    ) internal {
        vm.startPrank(cycleOwner);
        // create next offer from cycle contract
        offer = ERC20TokenOffer(cycle.createNextOffer(tokenPriceInCRC, offerLimitInCRC, trustedAccs));
        // write eligible accounts weights
        cycle.setNextOfferAccountWeights(trustedAccs, weights);

        cycle.depositNextOfferTokens();

        cycle.syncOfferTrust();

        vm.stopPrank();
    }
}
