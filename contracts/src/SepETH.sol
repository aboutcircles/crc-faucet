// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import {SafeTransferLib} from "solady/utils/SafeTransferLib.sol";
import {ERC20} from "solady/tokens/ERC20.sol";

// mint and burn on Gnosis
contract SepETH is ERC20 {
    using SafeTransferLib for address;

    error OnlyOwner();
    error IncorrectTransferFunction();
    error InvalidAddress();

    event TokenBridgingInitiated(address indexed from, address indexed recipient, uint256 indexed amount);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    address public OWNER;

    modifier onlyOwner() {
        if (msg.sender != OWNER) revert OnlyOwner();
        _;
    }

    constructor(address owner) {
        OWNER = owner;
        emit OwnershipTransferred(address(0), OWNER);
    }

    /// Mint new token when ETH is deposited on source chain
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    // Transfer to this address
    function transfer(address to, address recipient, uint256 amount) public returns (bool) {
        if (to == address(0)) {
            revert InvalidAddress();
        }
        if (to == address(this)) {
            _burn(msg.sender, amount);
            emit TokenBridgingInitiated(msg.sender, recipient, amount);
        } else {
            // Should call normal transfer function
            revert IncorrectTransferFunction();
        }
        return true;
    }

    function transferFrom(address from, address to, address recipient, uint256 amount) public returns (bool) {
        if (to == address(0)) {
            revert InvalidAddress();
        }
        if (to == address(this)) {
            transferFrom(from, to, amount);
            _burn(address(this), amount);
            emit TokenBridgingInitiated(from, recipient, amount);
        } else {
            // Should call normal transferFrom function
            revert IncorrectTransferFunction();
        }
        return true;
    }

    /// @dev Hook that is called before any transfer of tokens.
    /// This includes minting and burning.
    function _beforeTokenTransfer(address from, address to, uint256 amount) internal override {}

    /// @dev Hook that is called after any transfer of tokens.
    /// This includes minting and burning.
    function _afterTokenTransfer(address from, address to, uint256 amount) internal override {}

    /// @dev Returns the name of the token.
    function name() public pure override returns (string memory) {
        return "SepETH";
    }

    /// @dev Returns the symbol of the token.
    function symbol() public pure override returns (string memory) {
        return "SETH";
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) {
            revert InvalidAddress();
        }
        emit OwnershipTransferred(OWNER, newOwner);
        OWNER = newOwner;
    }
}
