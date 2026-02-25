// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.28;

import {IHub} from "./interfaces/IHub.sol";

/// @title FaucetXDAI
/// @notice Pays out xDAI to human Circles avatars in exchange for depositing trusted CRC via the Circles Hub.
/// @dev
/// - The faucet MUST be funded with xDAI (native token) via `receive()`.
/// - Claims happen through ERC-1155 callbacks invoked by the Circles Hub (`onlyHub`).
/// - Only avatars recognized as humans by the Hub can claim (`onlyHuman`).
/// - Per-avatar payouts are capped to `CAP` xDAI, tracked in `accountXDAIClaimed`.
/// - Only CRC token ids trusted by this organization are accepted (`_requireTrustedId`).
/// - Excess CRC above the remaining allowance is returned to the sender.
/// - Uses a transient-storage reentrancy guard (EIP-1153); requires chain support.
contract FaucetXDAI {
    /*//////////////////////////////////////////////////////////////
                             Events
    //////////////////////////////////////////////////////////////*/

    /// @notice Emitted when an avatar claims xDAI by depositing trusted CRC.
    /// @param avatar The human avatar that initiated the claim (the `from` in the Hub callback).
    /// @param recipient The address that received the xDAI payout (defaults to `avatar` if `data` is empty).
    /// @param amount The amount of xDAI paid out, in wei.
    event Claimed(address indexed avatar, address indexed recipient, uint256 indexed amount);

    /*//////////////////////////////////////////////////////////////
                             Errors
    //////////////////////////////////////////////////////////////*/

    /// @notice Reverted when a Hub-only function is called by any address other than the Circles Hub.
    error OnlyHub();

    /// @notice Reverted when the claimant avatar is not recognized as a human by the Circles Hub.
    error OnlyHuman();

    /// @notice Reverted when an owner-only function is called by any address other than `OWNER`.
    error OnlyOwner();

    /// @notice Reverted when the avatar has reached the maximum cumulative xDAI payout (`CAP`).
    /// @param avatar The avatar whose claim cap has been reached.
    error CapReached(address avatar);

    /// @notice Reverted when the received ERC-1155 token id is not trusted by this organization in the Hub.
    /// @dev The id is interpreted as an avatar address via `address(uint160(id))` (Circles CRC convention).
    /// @param Id The ERC-1155 token id supplied by the Hub callback.
    error InvalidTokenId(uint256 Id);

    /// @notice Reverted when the faucet does not have enough xDAI balance to pay the computed payout amount.
    error InsufficientLiquidity();

    /// @notice Reverted when sending xDAI via low-level call fails.
    error TransferFailed();

    /*//////////////////////////////////////////////////////////////
                           Constants
    //////////////////////////////////////////////////////////////*/

    /// @notice Circles Hub V2 contract address.
    /// @dev Hardcoded for the target deployment network.
    IHub public constant HUB = IHub(address(0xc12C1E50ABB450d6205Ea2C3Fa861b3B834d13e8));

    /// @notice Administrative owner of the faucet.
    /// @dev Receives accepted CRC proceeds and is the only account allowed to configure trust and withdraw xDAI.
    address public immutable OWNER;

    /// @notice Maximum cumulative xDAI payout per avatar.
    /// @dev Denominated in wei (1 ether == 1 xDAI at 18 decimals).
    uint256 internal constant CAP = 1 ether;

    /// @notice Exchange-rate parameter used to convert deposited CRC units into xDAI payout.
    /// @dev Payout is computed as `acceptedCRC * PRICE / CAP`.
    uint256 internal constant PRICE = 0.01 ether;

    /*//////////////////////////////////////////////////////////////
                            Storage
    //////////////////////////////////////////////////////////////*/

    /// @notice Cumulative xDAI paid out per avatar.
    /// @dev Keyed by claimant avatar (`from` in Hub callbacks), independent of the chosen payout recipient.
    mapping(address avatar => uint256 amount) public accountXDAIClaimed;

    /*//////////////////////////////////////////////////////////////
                            Modifiers
    //////////////////////////////////////////////////////////////*/

    /// @notice Restricts execution to the designated `OWNER`.
    /// @dev Reverts with {OnlyOwner} when called by any other address.
    modifier onlyOwner() {
        if (msg.sender != OWNER) revert OnlyOwner();
        _;
    }

    /// @notice Restricts execution to calls coming from the Circles Hub.
    /// @dev Intended for ERC-1155 receiver callbacks invoked by the Hub.
    modifier onlyHub() {
        if (msg.sender != address(HUB)) revert OnlyHub();
        _;
    }

    /// @notice Restricts execution to avatars recognized as human by the Hub.
    /// @param avatar The avatar address to check.
    /// @dev Reverts with {OnlyHuman} if `HUB.isHuman(avatar)` is false.
    modifier onlyHuman(address avatar) {
        if (!HUB.isHuman(avatar)) revert OnlyHuman();
        _;
    }

    /**
     * @dev A minimal non-reentrancy guard using transient storage.
     *      Prevents nested (reentrant) calls within any function marked `nonReentrant`.
     */
    modifier nonReentrant() {
        assembly {
            if tload(0) { revert(0, 0) }
            tstore(0, 1)
        }
        _;
        assembly {
            tstore(0, 0)
        }
    }

    /// @notice Deploys the faucet and registers it as an organization in the Circles Hub.
    /// @param owner The administrative owner address.
    /// @dev
    /// - Sets `OWNER` immutably.
    /// - Calls `HUB.registerOrganization("Circles-Faucet-XDAI", bytes32(0))`.
    constructor(address owner) {
        OWNER = owner;
        HUB.registerOrganization("Circles-Faucet-XDAI", bytes32(0));
    }

    /// @notice Sets Hub trust relationships for this organization.
    /// @param accounts The avatar addresses to trust.
    /// @param expiry The UNIX timestamp (uint96) at which the trust expires.
    /// @dev
    /// - Only callable by `OWNER`.
    /// - Iterates `accounts` and calls `HUB.trust(accounts[i], expiry)`.
    function setTrust(address[] calldata accounts, uint96 expiry) external onlyOwner {
        for (uint256 i; i < accounts.length;) {
            HUB.trust(accounts[i], expiry);
            unchecked {
                ++i;
            }
        }
    }

    /// @notice Withdraws all xDAI held by the faucet to `OWNER`.
    /// @dev Only callable by `OWNER`.
    function withdrawXDAI() external onlyOwner {
        _sendXDAI(OWNER, address(this).balance);
    }

    /*//////////////////////////////////////////////////////////////
                         INTERNAL
    //////////////////////////////////////////////////////////////*/

    /// @notice Requires that the CRC token id is trusted by this organization in the Hub.
    /// @param id The ERC-1155 token id supplied by the Hub callback.
    /// @dev Interprets `id` as an avatar address via `address(uint160(id))`.
    /// @custom:reverts InvalidTokenId If the derived avatar is not trusted by this organization in the Hub.
    function _requireTrustedId(uint256 id) internal view {
        if (!HUB.isTrusted(address(this), address(uint160(id)))) revert InvalidTokenId(id);
    }

    /// @notice Returns the avatar’s cumulative claimed xDAI amount and enforces the cap.
    /// @param avatar The claimant avatar.
    /// @return claimedAmount The amount of xDAI already paid out to `avatar`, in wei.
    /// @custom:reverts CapReached If `claimedAmount >= CAP`.
    function _claimedAmount(address avatar) internal view returns (uint256 claimedAmount) {
        claimedAmount = accountXDAIClaimed[avatar];
        if (claimedAmount >= CAP) revert CapReached(avatar);
    }

    /// @notice Resolves the xDAI payout recipient.
    /// @param avatar The default recipient (used when `data` is empty).
    /// @param data Optional ABI-encoded `(address)` specifying an alternate recipient.
    /// @return recipient The resolved recipient address.
    /// @dev If `data.length == 0`, returns `avatar`; otherwise decodes `data` as `(address)`.
    function _recipient(address avatar, bytes memory data) internal pure returns (address recipient) {
        recipient = data.length == 0 ? avatar : abi.decode(data, (address));
    }

    /// @notice Sends xDAI to `to`.
    /// @param to The recipient address.
    /// @param amount The amount of xDAI to send, in wei.
    /// @custom:reverts InsufficientLiquidity If `address(this).balance < amount`.
    /// @custom:reverts TransferFailed If the low-level call fails.
    function _sendXDAI(address to, uint256 amount) internal {
        if (address(this).balance < amount) revert InsufficientLiquidity();
        (bool success,) = to.call{value: amount}("");
        if (!success) revert TransferFailed();
    }

    /*//////////////////////////////////////////////////////////////
                         ERC-1155 CALLBACKS
    //////////////////////////////////////////////////////////////*/

    /// @notice Handles a single ERC-1155 CRC deposit from the Hub and pays out xDAI.
    /// @dev
    /// Flow:
    /// - Verifies caller is the Hub (`onlyHub`) and claimant is human (`onlyHuman(from)`).
    /// - Verifies `id` is trusted by this organization (`_requireTrustedId`).
    /// - Enforces per-avatar cap (`_claimedAmount`).
    /// - Computes the maximum acceptable CRC units given remaining cap:
    ///   `maxValue = (CAP - claimedAmount) * CAP / PRICE`.
    /// - Accepts at most `maxValue` CRC units; any excess is returned to `from`.
    /// - Computes payout:
    ///   `amount = acceptedValue * PRICE / CAP`.
    /// - Transfers accepted CRC to `OWNER`, returns excess CRC to `from` (if any).
    /// - Sends xDAI to `recipient` (decoded from `data`, or `from` if empty).
    /// - Emits {Claimed}.
    /// @param from The claimant avatar (ERC-1155 sender in Hub terms).
    /// @param id The CRC token id being deposited (must be trusted by this organization).
    /// @param value The CRC amount (ERC-1155 `value`) deposited.
    /// @param data Optional ABI-encoded `(address)` specifying an alternate xDAI recipient.
    /// @return selector The ERC-1155 receiver magic value.
    /// @custom:reverts OnlyHub If called by any address other than the Hub.
    /// @custom:reverts OnlyHuman If `from` is not a human in the Hub.
    /// @custom:reverts InvalidTokenId If `id` is not trusted by this organization.
    /// @custom:reverts CapReached If `from` has already claimed at least `CAP`.
    /// @custom:reverts InsufficientLiquidity If the faucet cannot pay the computed `amount`.
    /// @custom:reverts TransferFailed If the xDAI transfer fails.
    function onERC1155Received(address, address from, uint256 id, uint256 value, bytes memory data)
        external
        onlyHub
        onlyHuman(from)
        nonReentrant
        returns (bytes4)
    {
        _requireTrustedId(id);

        uint256 claimedAmount = _claimedAmount(from);

        uint256 maxValue = (CAP - claimedAmount) * CAP / PRICE;
        uint256 excessValue;
        if (value > maxValue) excessValue = value - maxValue;
        uint256 amount = value;
        if (excessValue != 0) amount = maxValue;
        // normalize in crc
        amount = amount * PRICE / CAP;
        accountXDAIClaimed[from] += amount;

        HUB.safeTransferFrom(address(this), OWNER, id, value - excessValue, "");
        if (excessValue > 0) HUB.safeTransferFrom(address(this), from, id, excessValue, "");

        address recipient = _recipient(from, data);
        _sendXDAI(recipient, amount);

        emit Claimed(from, recipient, amount);

        return this.onERC1155Received.selector;
    }

    /// @notice Handles a batch ERC-1155 CRC deposit from the Hub and pays out xDAI.
    /// @dev
    /// Flow:
    /// - Verifies caller is the Hub (`onlyHub`) and claimant is human (`onlyHuman(from)`).
    /// - Verifies each `ids[i]` is trusted by this organization (`_requireTrustedId`), reverting on the first untrusted id.
    /// - Enforces per-avatar cap (`_claimedAmount`).
    /// - Computes the maximum acceptable total CRC units given remaining cap:
    ///   `maxValue = (CAP - claimedAmount) * CAP / PRICE`.
    /// - Accumulates `totalValue` across the batch until it exceeds `maxValue`.
    /// - If it exceeds, splits transfers:
    ///   1) Sends an adjusted prefix of the batch to `OWNER` such that accepted total equals `maxValue`.
    ///   2) Returns the excess (and any remaining ids/values) to `from`.
    /// - If it does not exceed, sends the whole batch to `OWNER`.
    /// - Computes payout:
    ///   `amount = totalValue * PRICE / CAP`.
    /// - Sends xDAI to `recipient` (decoded from `data`, or `from` if empty).
    /// - Emits {Claimed}.
    /// @param from The claimant avatar (ERC-1155 sender in Hub terms).
    /// @param ids The CRC token ids being deposited (each must be trusted by this organization).
    /// @param values The CRC amounts (ERC-1155 `values`) per id.
    /// @param data Optional ABI-encoded `(address)` specifying an alternate xDAI recipient.
    /// @return selector The ERC-1155 receiver magic value.
    /// @custom:reverts OnlyHub If called by any address other than the Hub.
    /// @custom:reverts OnlyHuman If `from` is not a human in the Hub.
    /// @custom:reverts InvalidTokenId If any `ids[i]` is not trusted by this organization.
    /// @custom:reverts CapReached If `from` has already claimed at least `CAP`.
    /// @custom:reverts InsufficientLiquidity If the faucet cannot pay the computed `amount`.
    /// @custom:reverts TransferFailed If the xDAI transfer fails.
    function onERC1155BatchReceived(
        address,
        address from,
        uint256[] memory ids,
        uint256[] memory values,
        bytes memory data
    ) external onlyHub onlyHuman(from) nonReentrant returns (bytes4) {
        uint256 claimedAmount = _claimedAmount(from);
        uint256 maxValue = (CAP - claimedAmount) * CAP / PRICE;

        uint256 totalValue;
        uint256 excessValue;

        for (uint256 i; i < ids.length;) {
            // The tx will revert if any of the ids is not trusted by this org
            _requireTrustedId(ids[i]);

            totalValue += values[i];

            if (totalValue > maxValue) {
                excessValue = totalValue - maxValue;
                {
                    // action 1 - transfer to owner
                    uint256[] memory inIds = new uint256[](i + 1);
                    uint256[] memory inValues = new uint256[](i + 1);
                    for (uint256 k; k < i + 1;) {
                        inIds[k] = ids[k];
                        inValues[k] = values[k];
                        unchecked {
                            ++k;
                        }
                    }
                    inValues[i] -= excessValue;
                    HUB.safeBatchTransferFrom(address(this), OWNER, inIds, inValues, "");
                }

                {
                    // action 2 - return excess
                    uint256[] memory outIds = new uint256[](ids.length - i);
                    uint256[] memory outValues = new uint256[](ids.length - i);
                    for (uint256 l; l < ids.length - i;) {
                        outIds[l] = ids[i + l];
                        outValues[l] = values[i + l];
                        unchecked {
                            ++l;
                        }
                    }
                    outValues[0] = excessValue;

                    HUB.safeBatchTransferFrom(address(this), from, outIds, outValues, "");
                }

                totalValue -= excessValue;
                break;
            }

            unchecked {
                ++i;
            }
        }

        uint256 amount = totalValue * PRICE / CAP;
        accountXDAIClaimed[from] += amount;

        if (excessValue == 0) HUB.safeBatchTransferFrom(address(this), OWNER, ids, values, "");

        address recipient = _recipient(from, data);
        _sendXDAI(recipient, amount);

        emit Claimed(from, recipient, amount);
        return this.onERC1155BatchReceived.selector;
    }

    /// @notice Accepts xDAI funding transfers to the faucet.
    /// @dev The faucet must be funded for claims to succeed; otherwise claims revert with {InsufficientLiquidity}.
    receive() external payable {}
}
