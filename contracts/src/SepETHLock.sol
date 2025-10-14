// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

// Lock and unlock on Sepolia
contract SepETHLock {
    address public immutable OWNER;

    error OnlyOwner();

    event TokenBridgingInitiated(address indexed from, address indexed recipient, uint256 indexed amount);
    event ETHUnlocked(address indexed to, uint256 indexed amount);

    mapping(address => uint256) balanceOf;

    modifier onlyOwner() {
        if (msg.sender != OWNER) revert OnlyOwner();
        _;
    }

    constructor(address owner) {
        OWNER = owner;
    }

    function unlock(address to, uint256 amount) external onlyOwner {
        require(address(this).balance >= amount);
        payable(to).transfer(amount);
        emit ETHUnlocked(to, amount);
    }

    // lock ETH into this contract
    receive() external payable {
        emit TokenBridgingInitiated(msg.sender, msg.sender, msg.value);
    }
}
