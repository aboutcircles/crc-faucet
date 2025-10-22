// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test} from "forge-std/Test.sol";
import {NativeTokenDeposit} from "../src/NativeTokenDeposit.sol";

contract NativeTokenDepositTest is Test {
    address owner = makeAddr("owner");
    address alice = makeAddr("alice");
    NativeTokenDeposit nativeTokenDeposit;

    error InvalidAddress();
    error InsufficientDepositAmount();
    error InsufficientWithdrawAmount();

    event TokenDeposited(address indexed from, address indexed recipient, uint256 indexed amount);
    event TokenWithdrawn(address indexed to, uint256 indexed amount);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    function setUp() public {
        nativeTokenDeposit = new NativeTokenDeposit(owner);
    }

    function testReceive(uint256 amount) public {
        vm.assume(amount < type(uint256).max);

        deal(alice, amount);

        vm.prank(alice);
        vm.expectEmit();
        emit TokenDeposited(alice, alice, amount);
        payable(address(nativeTokenDeposit)).transfer(amount);
        assertEq(address(nativeTokenDeposit).balance, amount);
        assertEq(alice.balance, 0);
    }

    function testDeposit(uint256 amount) public {
        vm.assume(amount < type(uint256).max);
        deal(alice, amount);
        vm.prank(alice);
        vm.expectEmit();
        emit TokenDeposited(alice, alice, amount);
        nativeTokenDeposit.deposit{value: amount}(alice, amount);
    }

    function testWithdraw(uint256 amount) public {
        vm.assume(amount < type(uint256).max);

        deal(address(nativeTokenDeposit), amount);

        vm.prank(alice);
        vm.expectRevert();
        nativeTokenDeposit.withdraw(alice, amount);

        vm.prank(owner);
        vm.expectEmit();
        emit TokenWithdrawn(alice, amount);
        nativeTokenDeposit.withdraw(alice, amount);
        assertEq(alice.balance, amount);
    }

    function testTransferOwnership(address newOwner) public {
        if (newOwner == address(0)) {
            vm.prank(owner);
            vm.expectRevert();
            nativeTokenDeposit.transferOwnership(newOwner);
        } else {
            vm.prank(owner);
            vm.expectEmit();
            emit OwnershipTransferred(owner, newOwner);
            nativeTokenDeposit.transferOwnership(newOwner);
        }
    }
}
