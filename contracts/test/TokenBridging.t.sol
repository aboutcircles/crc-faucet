// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import {Test, console} from "forge-std/Test.sol";
import {SepETH} from "../src/SepETH.sol";
import {NativeTokenDeposit} from "../src/NativeTokenDeposit.sol";

contract TokenBridgingTest is Test {
    address owner = makeAddr("owner");
    address alice = makeAddr("alice");

    SepETH sepETH;
    NativeTokenDeposit sepETHDeposit;

    event TokenBridgingInitiated(address indexed from, address indexed recipient, uint256 indexed amount);
    event TokenDeposited(address indexed from, address indexed recipient, uint256 indexed amount);
    event TokenWithdrawn(address indexed to, uint256 indexed amount);
    event Transfer(address indexed from, address indexed to, uint256 indexed amount);

    function setUp() public {
        sepETH = new SepETH(owner);
        sepETHDeposit = new NativeTokenDeposit(owner);
        deal(owner, 1_000 ether);
    }

    function testLockAndMint(uint256 amount) public {
        vm.assume(amount < owner.balance);
        uint256 balanceBefore = owner.balance;
        // lock on Sepolia
        vm.prank(owner);
        vm.expectEmit();
        emit TokenDeposited(owner, owner, amount);

        payable(address(sepETHDeposit)).transfer(amount);
        assertEq(address(sepETHDeposit).balance, amount); // gas fee
        assertEq(owner.balance, balanceBefore - amount); // gas fee

        vm.prank(alice);
        vm.expectRevert();
        sepETH.mint(owner, amount);

        vm.prank(owner);
        sepETH.mint(owner, amount);
        assertEq(sepETH.balanceOf(owner), amount);
    }

    function testBurnAndUnlock(uint256 amount) public {
        // get owner certain amount of sepETH

        deal(address(sepETHDeposit), amount);

        vm.prank(owner);
        sepETH.mint(owner, amount);
        assertEq(sepETH.balanceOf(owner), amount);
        assertEq(sepETH.totalSupply(), amount);

        vm.prank(owner);
        sepETH.transfer(alice, amount);
        assertEq(sepETH.balanceOf(owner), 0);
        assertEq(sepETH.balanceOf(alice), amount);

        vm.prank(alice);
        vm.expectEmit();
        emit TokenBridgingInitiated(alice, alice, amount);
        sepETH.transfer(address(sepETH), alice, amount);
        assertEq(sepETH.totalSupply(), 0);
        assertEq(sepETH.balanceOf(alice), 0);

        vm.prank(alice);
        vm.expectRevert();
        sepETHDeposit.withdraw(alice, amount);

        vm.prank(owner);
        vm.expectEmit();
        emit TokenWithdrawn(alice, amount);
        sepETHDeposit.withdraw(alice, amount);
        assertEq(alice.balance, amount);
        assertEq(address(sepETHDeposit).balance, 0);
    }
}
