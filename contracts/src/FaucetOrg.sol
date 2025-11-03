// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import {IHub} from "./interfaces/IHub.sol";

contract FaucetOrg {
    event FaucetRequested(address indexed from, address indexed recipient);

    error LastClaimLessThanOneDay();
    error OnlyHub();
    error InsufficientCRCValue(uint256 receiveCRC);
    error InvalidTokenId(uint256 Id);

    mapping(address avatar => uint256 lastClaim) lastClaimTimestamp;

    address public OWNER;
    uint256 public constant MINIMUM_CRC_VALUE = 24 ether;
    IHub public constant HUB = IHub(address(0xc12C1E50ABB450d6205Ea2C3Fa861b3B834d13e8));

    modifier onlyOwner() {
        require(msg.sender == OWNER, "Only owner can call this function");
        _;
    }

    modifier onlyHub() {
        if (msg.sender != address(HUB)) revert OnlyHub();
        _;
    }

    constructor() {
        HUB.registerOrganization("circle-facuet", 0);
        OWNER = msg.sender;
    }

    function setTrust(address[] calldata accounts, uint96[] calldata expired) public onlyOwner {
        for (uint256 i = 0; i < accounts.length; i++) {
            HUB.trust(accounts[i], expired[i]);
        }
    }

    // from:  This is the original sender (should be user with personal CRC trusted)
    function onERC1155Received(address, address from, uint256 id, uint256 value, bytes memory data)
        external
        onlyHub
        returns (bytes4)
    {
        if (!HUB.isTrusted(address(this), address(uint160(id)))) {
            revert InvalidTokenId(id);
        } else if (block.timestamp - lastClaimTimestamp[from] < 1 days) {
            revert LastClaimLessThanOneDay();
        } else if (value < 24 ether) {
            revert InsufficientCRCValue(value);
        } else {
            address recipient = abi.decode(data, (address));
            emit FaucetRequested(from, recipient);
            lastClaimTimestamp[from] = block.timestamp;
            return this.onERC1155Received.selector;
        }
    }

    function onERC1155BatchReceived(
        address,
        address from,
        uint256[] memory ids,
        uint256[] memory values,
        bytes memory data
    ) external onlyHub returns (bytes4) {
        revert();
    }
}
