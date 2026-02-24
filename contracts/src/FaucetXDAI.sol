// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.28;

import {IHub} from "./interfaces/IHub.sol";

contract FaucetXDAI {
    /*//////////////////////////////////////////////////////////////
                             Events
    //////////////////////////////////////////////////////////////*/

    /// @notice Emit when the org receives trusted CRC
    /// @param avatar initial sender of the transaction
    /// @param recipient recipient for the faucet token
    /// @param amount faucet token received amount
    event Claimed(address indexed avatar, address indexed recipient, uint256 indexed amount);

    /*//////////////////////////////////////////////////////////////
                             Errors
    //////////////////////////////////////////////////////////////*/

    /// @notice Thrown when a function that must be called by the Hub is called by another address.
    error OnlyHub();

    error OnlyHuman();

    /// @notice Thrown when a non-owner calls an owner-only function.
    error OnlyOwner();

    error CapReached(address from);

    /// @notice Throw when recieved token ID is not trusted by org
    error InvalidTokenId(uint256 Id);

    error InsufficientLiquidity();

    error TransferFailed();

    /*//////////////////////////////////////////////////////////////
                           Constants
    //////////////////////////////////////////////////////////////*/
    /// @notice Hub V2 contract adress
    IHub public constant HUB = IHub(address(0xc12C1E50ABB450d6205Ea2C3Fa861b3B834d13e8));

    address public immutable OWNER;

    uint256 internal constant CAP = 1 ether;

    uint256 internal constant PRICE = 0.01 ether;

    /*//////////////////////////////////////////////////////////////
                            Storage
    //////////////////////////////////////////////////////////////*/

    mapping(address avatar => uint256 amount) public accountXDAIClaimed;

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

    constructor(address owner) {
        OWNER = owner;
        HUB.registerOrganization("Circles-Faucet-XDAI", bytes32(0));
    }

    /// @notice set trust for this org
    /// @dev set accounts and expired trust timestamp
    /// @param accounts an array of trusted account
    /// @param expiry an expiry timestamp
    function setTrust(address[] calldata accounts, uint96 expiry) external onlyOwner {
        for (uint256 i; i < accounts.length;) {
            HUB.trust(accounts[i], expiry);
            unchecked {
                ++i;
            }
        }
    }

    /*//////////////////////////////////////////////////////////////
                         INTERNAL
    //////////////////////////////////////////////////////////////*/

    function withdrawXDAI() external onlyOwner {
        _sendXDAI(OWNER, address(this).balance);
    }

    function _requireTrustedId(uint256 id) internal view {
        if (!HUB.isTrusted(address(this), address(uint160(id)))) revert InvalidTokenId(id);
    }

    function _claimedAmount(address avatar) internal view returns (uint256 claimedAmount) {
        claimedAmount = accountXDAIClaimed[avatar];
        if (claimedAmount >= CAP) revert CapReached(avatar);
    }

    function _recipient(address avatar, bytes memory data) internal pure returns (address recipient) {
        recipient = data.length == 0 ? avatar : abi.decode(data, (address));
    }

    function _sendXDAI(address to, uint256 amount) internal {
        if (address(this).balance < amount) revert InsufficientLiquidity();
        (bool success,) = to.call{value: amount}("");
        if (!success) revert TransferFailed();
    }

    /*//////////////////////////////////////////////////////////////
                         ERC-1155 CALLBACKS
    //////////////////////////////////////////////////////////////*/

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

    receive() external payable {}
}
