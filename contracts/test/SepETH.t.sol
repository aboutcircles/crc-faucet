// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test} from "forge-std/Test.sol";
import {SepETH} from "../src/SepETH.sol";

contract SepETHTest is Test {
    SepETH sepETH;
    address owner = makeAddr("owner");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address cris = makeAddr("cris");

    event TokenBridgingInitiated(address indexed from, address indexed recipient, uint256 indexed amount);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    function setUp() public {
        sepETH = new SepETH(owner);
    }

    function testMint(uint256 amount) public {
        vm.assume(amount < type(uint256).max);
        uint256 balanceBefore = sepETH.balanceOf(alice);

        vm.prank(owner);
        sepETH.mint(alice, amount);

        assertEq(sepETH.balanceOf(alice), balanceBefore + amount);
    }

    function testTransfer(uint256 amount) public {
        vm.assume(amount < type(uint256).max);
        deal(address(sepETH), alice, amount);

        vm.prank(alice);
        vm.expectEmit();
        emit TokenBridgingInitiated(alice, bob, amount);
        sepETH.transfer(address(sepETH), bob, amount);
        assertEq(sepETH.balanceOf(alice), 0);
        assertEq(sepETH.balanceOf(bob), 0);

        vm.prank(alice);
        vm.expectRevert();
        sepETH.transfer(cris, bob, amount);

        deal(address(sepETH), alice, amount);
        vm.prank(alice);
        sepETH.approve(cris, amount);

        vm.prank(cris);
        emit TokenBridgingInitiated(alice, bob, amount);
        sepETH.transferFrom(alice, address(sepETH), bob, amount);
        assertEq(sepETH.balanceOf(alice), 0);
        assertEq(sepETH.balanceOf(bob), 0);
    }

    function testMetadata() public {
        assertEq(sepETH.name(), "SepETH");
        assertEq(sepETH.symbol(), "SETH");
    }

    function testTransferOwnership(address newOwner) public {
        if (newOwner == address(0)) {
            vm.prank(owner);
            vm.expectRevert();
            sepETH.transferOwnership(newOwner);
        } else {
            vm.prank(owner);
            vm.expectEmit();
            emit OwnershipTransferred(owner, newOwner);
            sepETH.transferOwnership(newOwner);
        }
    }
}
