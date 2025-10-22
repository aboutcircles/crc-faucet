// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

/// @title NativeTokenDeposit
/// @notice Deposit and withdraw native token
contract NativeTokenDeposit {
    address public OWNER;

    error OnlyOwner();
    error InvalidAddress();
    error InsufficientDepositAmount();
    error InsufficientWithdrawAmount();

    event TokenDeposited(address indexed from, address indexed recipient, uint256 indexed amount);
    event TokenWithdrawn(address indexed to, uint256 indexed amount);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    mapping(address => uint256) balanceOf;

    modifier onlyOwner() {
        if (msg.sender != OWNER) revert OnlyOwner();
        _;
    }

    constructor(address owner) {
        OWNER = owner;
        emit OwnershipTransferred(address(0), OWNER);
    }

    function deposit(address recipient, uint256 amount) external payable {
        if (amount > msg.value) {
            revert InsufficientDepositAmount();
        }
        if (recipient == address(0)) {
            revert InvalidAddress();
        }
        emit TokenDeposited(msg.sender, recipient, msg.value);
    }

    function withdraw(address to, uint256 amount) external onlyOwner {
        if (address(this).balance < amount) {
            revert InsufficientWithdrawAmount();
        }
        if (to == address(0)) {
            revert InvalidAddress();
        }
        payable(to).transfer(amount);
        emit TokenWithdrawn(to, amount);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) {
            revert InvalidAddress();
        }
        emit OwnershipTransferred(OWNER, newOwner);
        OWNER = newOwner;
    }

    receive() external payable{
         emit TokenDeposited(msg.sender, msg.sender, msg.value);
    }
}
