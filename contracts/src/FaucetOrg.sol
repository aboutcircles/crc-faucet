// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import {IHub} from "./interfaces/IHub.sol";

/// @title FaucetOrg
/// @notice This Faucet Organization receives trusted CRC and emit FaucetRequested event
contract FaucetOrg {
    /*//////////////////////////////////////////////////////////////
                             Events
    //////////////////////////////////////////////////////////////*/

    /// @notice Emit when the org receives trusted CRC
    /// @param from initial sender of the transaction
    /// @param recipient reciepint for the faucet token
    event FaucetRequested(address indexed from, address indexed recipient);

    /*//////////////////////////////////////////////////////////////
                             Errors
    //////////////////////////////////////////////////////////////*/

    /// @notice Throw when avatar claims less than 24 hrs
    error LastClaimLessThan24Hrs();

    /// @notice Thrown when a function that must be called by the Hub is called by another address.
    error OnlyHub();

    /// @notice Thrown when a non-owner calls an owner-only function.
    error OnlyOwner();

    /// @notice Throw when recieved CRC value is less than MINIMUM_CRC_VALUE
    error InsufficientCRCValue(uint256 receivedCRC);

    /// @notice Throw when recieved token ID is not trusted by org
    error InvalidTokenId(uint256 Id);

    /// @notice Throw when the account and expired array's length mismatch
    error InvalidArrayLength();

    /*//////////////////////////////////////////////////////////////
                           Constants
    //////////////////////////////////////////////////////////////*/
    /// @notice minimum amount of CRC should transfer in order to receive faucet token
    uint256 public constant MINIMUM_CRC_VALUE = 2 ether;

    /// @notice Hub V2 contract adress
    IHub public constant HUB = IHub(address(0xc12C1E50ABB450d6205Ea2C3Fa861b3B834d13e8));

    /*//////////////////////////////////////////////////////////////
                            Storage
    //////////////////////////////////////////////////////////////*/

    /// @notice Tracks each avatar's last claim time stamp
    /// @dev store the block.timestamp when a valid onERC1155Received is called
    mapping(address avatar => uint256 lastClaim) public lastClaimTimestamp;

    /// @notice the role of owner is to set trusted avatar address
    address public OWNER;

    /*//////////////////////////////////////////////////////////////
                            Modifiers
    //////////////////////////////////////////////////////////////*/

    /// @notice Restricts execution to the designated `OWNER`.
    /// @dev Reverts with {onlyOwner} when called by any other address.
    modifier onlyOwner() {
        if (msg.sender != OWNER) revert OnlyOwner();
        _;
    }

    /// @notice Restricts execution to calls coming from the Circles Hub.
    /// @dev Used by ERC-1155 receiver callbacks.
    modifier onlyHub() {
        if (msg.sender != address(HUB)) revert OnlyHub();
        _;
    }

    constructor() {
        HUB.registerOrganization("Circles-Faucet", 0);
        OWNER = msg.sender;
    }

    /// @notice set trust for this org
    /// @dev set accounts and expired trust timestamp
    /// @param accounts an array of trusted account
    /// @param expired an expired of expired timestamp w.r.t accounts
    function setTrust(address[] calldata accounts, uint96[] calldata expired) public onlyOwner {
        if (accounts.length != expired.length) revert InvalidArrayLength();
        for (uint256 i = 0; i < accounts.length; i++) {
            HUB.trust(accounts[i], expired[i]);
        }
    }

    /*//////////////////////////////////////////////////////////////
                         ERC-1155 Receiver (Hub)
    //////////////////////////////////////////////////////////////*/
    /// @notice Single-token CRC receipt handler (called by Hub), and emit FaucetRequested event
    /// @dev
    /// - Validates `id` as a trusted CRC for this offer via
    ///   `HUB.isTrusted(address(this), address(uint160(id)))`.
    /// - Validates if `lastClaimTimestamp[from]` is less than 1 days
    /// - Validates if received CRC value is less than MINIMUM_CRC_VALUE
    /// - Returns the ERC-1155 receiver selector.
    /// @param from The original CRC sender reported by Hub (used to update in lastClaimTimestamp).
    /// @param id The CRC id being transferred in.
    /// @param value The CRC amount.
    /// @param data Optional encoded data for faucet recipeint address.
    function onERC1155Received(address, address from, uint256 id, uint256 value, bytes memory data)
        external
        onlyHub
        returns (bytes4)
    {
        if (!HUB.isTrusted(address(this), address(uint160(id)))) {
            revert InvalidTokenId(id);
        } else if ((block.timestamp - lastClaimTimestamp[from]) < 1 days) {
            revert LastClaimLessThan24Hrs();
        } else if (value < MINIMUM_CRC_VALUE) {
            revert InsufficientCRCValue(value);
        } else {
            if (data.length == 0) {
                emit FaucetRequested(from, from);
                lastClaimTimestamp[from] = block.timestamp;
                return this.onERC1155Received.selector;
            } else {
                address recipient = abi.decode(data, (address));
                emit FaucetRequested(from, recipient);
                lastClaimTimestamp[from] = block.timestamp;
                return this.onERC1155Received.selector;
            }
        }
    }

    /// @notice Batch token CRC receipt handler (called by Hub), and emit FaucetRequested event
    /// @dev
    /// - Validates `id` as a trusted CRC for this offer via
    ///   `HUB.isTrusted(address(this), address(uint160(id)))`.
    /// - Validates if `lastClaimTimestamp[from]` is less than 1 days
    /// - Validates if received CRC value is less than MINIMUM_CRC_VALUE
    /// - Returns the ERC-1155 receiver selector.
    /// @param from The original CRC sender reported by Hub (used to update in lastClaimTimestamp).
    /// @param ids The CRC ids being transferred in.
    /// @param values The CRC amounts per id.
    /// @param data Optional encoded data for faucet recipeint address.
    function onERC1155BatchReceived(
        address,
        address from,
        uint256[] memory ids,
        uint256[] memory values,
        bytes memory data
    ) external onlyHub returns (bytes4) {
        if (ids.length != values.length) revert InvalidArrayLength();

        for (uint256 i; i < ids.length;) {
            if (!HUB.isTrusted(address(this), address(uint160(ids[i])))) {
                revert InvalidTokenId(ids[i]);
            } else if ((block.timestamp - lastClaimTimestamp[from]) < 1 days) {
                revert LastClaimLessThan24Hrs();
            } else if (values[i] < MINIMUM_CRC_VALUE) {
                revert InsufficientCRCValue(values[i]);
            } else {
                if (data.length == 0) {
                    emit FaucetRequested(from, from);
                    lastClaimTimestamp[from] = block.timestamp;
                } else {
                    address recipient = abi.decode(data, (address));
                    emit FaucetRequested(from, recipient);
                    lastClaimTimestamp[from] = block.timestamp;
                }
            }
            unchecked {
                ++i;
            }
        }

        return this.onERC1155Received.selector;
    }
}
