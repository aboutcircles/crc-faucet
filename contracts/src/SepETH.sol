// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import {SafeTransferLib} from "solady/utils/SafeTransferLib.sol";
import {ERC20} from "solady/tokens/ERC20.sol";

// mint and burn on Gnosis
contract SepETH is ERC20 {
    using SafeTransferLib for address;

    error OnlyOwner();
    error IncorrectTransferFunction();

    event TokenBridgingInitiated(address indexed from, address indexed recipient, uint256 indexed amount);

    address public immutable OWNER;

    modifier onlyOwner() {
        if (msg.sender != OWNER) revert OnlyOwner();
        _;
    }

    constructor(address owner) {
        OWNER = owner;
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    // Transfer to this address
    function transfer(address to, address recipient, uint256 amount) public returns (bool) {
        if (to == address(this)) {
            _burn(msg.sender, amount);
            emit TokenBridgingInitiated(msg.sender, recipient, amount);
        } else {
            // Should call transfer(address to, uint256 amount) instead
            revert IncorrectTransferFunction();
        }
    }

    /// @dev Hook that is called before any transfer of tokens.
    /// This includes minting and burning.
    function _beforeTokenTransfer(address from, address to, uint256 amount) internal override {}

    /// @dev Hook that is called after any transfer of tokens.
    /// This includes minting and burning.
    function _afterTokenTransfer(address from, address to, uint256 amount) internal override {}

    /// @dev Returns the name of the token.
    function name() public view override returns (string memory) {
        return "SepETH";
    }

    /// @dev Returns the symbol of the token.
    function symbol() public view override returns (string memory) {
        return "SETH";
    }
}
