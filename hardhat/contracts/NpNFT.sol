// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155URIStorage.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

//All revenue will be sent to the pre-defined beneficiary, NFT holders will NOT receive any profit by selling the NFT.

//Transfer of NFT ownership can be executed by anyone as long as the purchase price is higher than the current price.

//Keep track of the NFT's historical owners and the price at which they were purchased.

//NFT owner can update its name and message in the OwnershipRecord

//Track total amount transferred to the beneficiary
    
contract NpNFT is ERC1155URIStorage {
    // Add library methods
    using Math for uint256;
    using EnumerableSet for EnumerableSet.UintSet;

    event TokenMinted(uint256 indexed tokenId, address indexed owner, bytes32 name, string message, uint256 price);
    event TokenBatchMinted(uint256 indexed startTokenId, address indexed owner, bytes32 name, string message, uint256 price, uint numMinted);
    event OwnershipTakenOver(uint256 indexed tokenId, address indexed oldOwner, address indexed newOwner, uint256 price);
    event OwnerNameUpdated(uint256 indexed tokenId, address indexed owner, bytes32 newName);
    event OwnerMsgUpdated(uint256 indexed tokenId, address indexed owner, string newMessage);

    bytes32 public projectName;
    address public beneficiary;
    uint256 public mintFee;
    uint256 public nextTokenId = 1;
    uint256 public totalToBeneficiary;
    uint256 public totalNumOfTransfers;

    struct OwnershipRecord {
        address owner; 
        bytes32 name;
        string message;
        uint ownedAt;
        uint256 price;
    }

    //tokenId to OwnershipRecords map
    mapping(uint256 => OwnershipRecord[]) public ownershipRecordsMap;
    //user address to owned tokenIdsSet map
    mapping(address => EnumerableSet.UintSet) internal _ownedTokensSetMap;

    constructor(string memory uri_, bytes32 projectName_, address beneficiary_, uint256 mintFee_) ERC1155(uri_) {
        require(beneficiary_ != address(0), "NpNFT: beneficiary is the zero address");
        projectName = projectName_;
        beneficiary = beneficiary_;
        mintFee = mintFee_;
    }

    function mint(bytes32 creatorName_, string calldata message_, uint256 initPrice_, bytes memory data_) external payable {
        require(msg.value >= mintFee, "NpNFT: not enough mint fee");
        (bool successForward, bytes memory d) = beneficiary.call{value: msg.value}("");
        require(successForward, "NpNFT: failed to forward mint fee to beneficiary");
        totalToBeneficiary += msg.value;
        totalNumOfTransfers++;

        uint256 currentTokenId_ = nextTokenId;
        nextTokenId++;
        _mint(_msgSender(), currentTokenId_, 1, data_);
        _setURI(currentTokenId_, string(data_));
        ownershipRecordsMap[currentTokenId_].push(OwnershipRecord(_msgSender(), creatorName_, message_, block.timestamp, initPrice_));
        _ownedTokensSetMap[_msgSender()].add(currentTokenId_);

        emit TokenMinted(currentTokenId_, _msgSender(), creatorName_, message_, initPrice_);
    }

    function mintBatch(bytes32 creatorName_, string calldata message_, uint256 initPrice_, bytes memory data_, uint numToMint) external payable {
        require(numToMint > 0 && numToMint <= 100, "NpNFT: invalid numToMint");
        require(msg.value >= mintFee * numToMint, "NpNFT: not enough mint fee");
        (bool successForward, bytes memory d) = beneficiary.call{value: msg.value}("");
        require(successForward, "NpNFT: failed to forward mint fee to beneficiary");
        totalToBeneficiary += msg.value;
        totalNumOfTransfers++;
        uint startTokenId = nextTokenId;

        for (uint i = 0; i < numToMint; i++) {
            uint256 currentTokenId_ = nextTokenId;
            nextTokenId++;
            _mint(_msgSender(), currentTokenId_, 1, data_);
            _setURI(currentTokenId_, string(data_));
            ownershipRecordsMap[currentTokenId_].push(OwnershipRecord(_msgSender(), creatorName_, message_, block.timestamp, initPrice_));
            _ownedTokensSetMap[_msgSender()].add(currentTokenId_);
        }
        emit TokenBatchMinted(startTokenId, _msgSender(), creatorName_, message_, initPrice_, numToMint);
    }

    function takeOwnershipOf(uint256 tokenId_, bytes32 buyerName_, string calldata buyerMsg_) external payable {
        require(tokenId_ > 0 && tokenId_ < nextTokenId, "NpNFT: invalid tokenId");
        require(msg.value > 0, "NpNFT: invalid payment");
        require(msg.value > ownershipRecordsMap[tokenId_][ownershipRecordsMap[tokenId_].length - 1].price, "NpNFT: not enough payment");
        (bool successForward, bytes memory d) = beneficiary.call{value: msg.value}("");
        require(successForward, "NpNFT: failed to forward mint fee to beneficiary");
        totalToBeneficiary += msg.value;
        totalNumOfTransfers++;

        address exOwner_ = ownershipRecordsMap[tokenId_][ownershipRecordsMap[tokenId_].length - 1].owner;
        _safeTransferFrom(exOwner_, _msgSender(), tokenId_, 1, "");
        ownershipRecordsMap[tokenId_].push(OwnershipRecord(_msgSender(), buyerName_, buyerMsg_, block.timestamp, msg.value));
        _ownedTokensSetMap[_msgSender()].add(tokenId_);

        emit OwnershipTakenOver(tokenId_, exOwner_, _msgSender(), msg.value);
        emit OwnerNameUpdated(tokenId_, _msgSender(), buyerName_);
        emit OwnerMsgUpdated(tokenId_, _msgSender(), buyerMsg_);
    }

    function updateOwnerNameOf(uint256 tokenId_, bytes32 newName_) external {
        require(tokenId_ > 0 && tokenId_ < nextTokenId, "NpNFT: invalid tokenId");
        require(_ownedTokensSetMap[_msgSender()].contains(tokenId_), "NpNFT: not owner");

        for (uint i = 0; i < ownershipRecordsMap[tokenId_].length; i++) {
            if (ownershipRecordsMap[tokenId_][i].owner == _msgSender()) {
                ownershipRecordsMap[tokenId_][i].name = newName_;
                emit OwnerNameUpdated(tokenId_, _msgSender(), newName_);
            }
        }
    }

    function updateOwnerMsgOf(uint256 tokenId_, string calldata newMsg_) external {
        require(tokenId_ > 0 && tokenId_ < nextTokenId, "NpNFT: invalid tokenId");
        require(_ownedTokensSetMap[_msgSender()].contains(tokenId_), "NpNFT: not owner");

        for (uint i = 0; i < ownershipRecordsMap[tokenId_].length; i++) {
            if (ownershipRecordsMap[tokenId_][i].owner == _msgSender()) {
                ownershipRecordsMap[tokenId_][i].message = newMsg_;
                emit OwnerMsgUpdated(tokenId_, _msgSender(), newMsg_);
            }
        }
    }

    function isCurrentOwnerOf(uint256 tokenId_, address owner_) external view returns (bool) {
        require(tokenId_ > 0 && tokenId_ < nextTokenId, "NpNFT: invalid tokenId");
        return ownershipRecordsMap[tokenId_][ownershipRecordsMap[tokenId_].length - 1].owner == owner_;
    }

    function isOneOfTheOwnersOf(uint256 tokenId_, address owner_) external view returns (bool) {
        require(tokenId_ > 0 && tokenId_ < nextTokenId, "NpNFT: invalid tokenId");
        for (uint i = 0; i < ownershipRecordsMap[tokenId_].length; i++) {
            if (ownershipRecordsMap[tokenId_][i].owner == owner_) {
                return true;
            }
        }
        return false;
    }

    function getOwnershipRecordsOf(uint256 tokenId_) external view returns (OwnershipRecord[] memory) {
        require(tokenId_ > 0 && tokenId_ < nextTokenId, "NpNFT: invalid tokenId");
        return ownershipRecordsMap[tokenId_];
    }
}
