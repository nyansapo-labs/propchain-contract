// SPDX-License-Identifier: MIT
import "@openzeppelin/contracts/access/Ownable.sol";
import "./PropertyRegistryAuction.sol";

pragma solidity ^0.8.24;

error PROPERTYREGISTERY__NOT_ADMIN();
error PROPERTYREGISTERY__ALREADY_REGISTERED();
error PROPERTYREGISTERY__NOT_REGISTERED();
error PROPERTYREGISTERY__NOT_OWNER();
error PROPERTYREGISTERY__BIDDING_STARTED();
error PROPERTYREGISTERY__CANT_UPDATE_PRICE_AFTER_BID_PLACED();
error PROPERTYREGISTERY__AUCTION_ALREADY_ACTIVE();
error PROPERTYREGISTERY__TRANSACTION_NOT_ACTIVE();
error PROPERTYREGISTERY__NOT_AUTHORIZED_FOR_CONFIRMATION();
error PROPERTYREGISTERY__TRANSACTION_NOT_CONFIRMED();
error PROPERTYREGISTERY__TRANSACTION_NOT_CONFIRMED_BY_ADMIN();

/// @title Property Registry and Management Contract
/// @notice This contract is used to register, anage properties, and handle property transactions off-chain but with on-chain confirmation and updates
/// @dev Extends the Auction contract to include auctioning functionalities

contract PropertyRegistry is Ownable, Auction {
    struct Property {
        address owner;
        string location;
        string gpsAddress;
        string ipfsHash; // This will be hash of the property's documents and the users Id card tHus, documentHash
        bool isVerified;
        uint256 price;
        bool biddingStarted;
        bool isAuctionActive;
    }
    struct Transaction {
        address buyer;
        address seller;
        bool buyerConfirmed;
        bool sellerConfirmed;
        bool adminConfirmed;
        bool isActive;
    }

    mapping(string => Property) public properties; // Using gps address as key
    mapping(string => Transaction) public transactions; // Using gps address of properties as key for transactions

    event PropertyRegistered(
        string gpsAddress,
        address owner,
        string location,
        string ipfsHash
    );
    event PropertyVerified(string gpsAddress);
    event PropertyPriceUpdated(
        string gpsAddress,
        uint256 oldPrice,
        uint256 newPrice
    );
    event PropertyTransferred(
        string gpsAddress,
        address oldOwner,
        address newOwner
    );
    event PropertyDocsUpdated(string gpsAddress, string newDocumentHash);
    event TransactionInitiated(
        string gpsAddress,
        address buyer,
        address seller
    );
    event TransactionConfirmed(
        string gpsAddress,
        address buyer,
        address seller
    );
    event TransactionCompleted(
        string gpsAddress,
        address seller,
        address buyer
    );

    constructor(address _owner) Ownable(_owner) {}

    modifier onlyAdmin() {
        if (msg.sender != owner()) {
            revert PROPERTYREGISTERY__NOT_ADMIN();
        }
        _;
    }

    modifier notBiddingStarted(string memory _gpsAddress) {
        if (properties[_gpsAddress].biddingStarted) {
            revert PROPERTYREGISTERY__BIDDING_STARTED();
        }
        _;
    }

    modifier onlyPropertyOwner(string memory _gpsAddress) {
        if (properties[_gpsAddress].owner != msg.sender) {
            revert PROPERTYREGISTERY__NOT_OWNER();
        }
        _;
    }

    modifier onlyRegisteredProperty(string memory _gpsAddress) {
        if (properties[_gpsAddress].owner == address(0)) {
            revert PROPERTYREGISTERY__NOT_REGISTERED();
        }
        _;
    }

    function registerProperty(
        string memory _location,
        string memory _gpsAddress,
        string memory _ipfsHash
    ) public {
        if (properties[_gpsAddress].owner != address(0)) {
            revert PROPERTYREGISTERY__ALREADY_REGISTERED();
        }

        properties[_gpsAddress] = Property(
            msg.sender,
            _location,
            _gpsAddress,
            _ipfsHash,
            false,
            0,
            false,
            false
        );
        emit PropertyRegistered(_gpsAddress, msg.sender, _location, _ipfsHash);
    }

    function verifyProperty(
        string memory _gpsAddress
    ) public onlyAdmin onlyRegisteredProperty(_gpsAddress) {
        properties[_gpsAddress].isVerified = true;
        emit PropertyVerified(_gpsAddress);
    }

    function updatePropertyPrice(
        string memory _gpsAddress,
        uint256 _newPrice
    )
        public
        onlyRegisteredProperty(_gpsAddress)
        onlyPropertyOwner(_gpsAddress)
    {
        // Check if an auction exists and if bids have been placed
        AuctionItem memory auction = getAuctionDetails(_gpsAddress);
        if (auction.isActive && auction.bidPlaced) {
            revert PROPERTYREGISTERY__CANT_UPDATE_PRICE_AFTER_BID_PLACED();
        }

        uint256 oldPrice = properties[_gpsAddress].price;
        properties[_gpsAddress].price = _newPrice;
        emit PropertyPriceUpdated(_gpsAddress, oldPrice, _newPrice);
    }

    //Auction functions

    function createAuction(
        string memory _gpsAddress,
        uint256 _startingPrice,
        uint256 _auctionEndTime
    )
        public
        override
        onlyRegisteredProperty(_gpsAddress)
        onlyPropertyOwner(_gpsAddress)
    {
        if (properties[_gpsAddress].isAuctionActive) {
            revert PROPERTYREGISTERY__AUCTION_ALREADY_ACTIVE();
        }

        properties[_gpsAddress].isAuctionActive = true;
        super.createAuction(_gpsAddress, _startingPrice, _auctionEndTime);
    }

    function endAuction(
        string memory _gpsAddress
    )
        internal
        override
        onlyRegisteredProperty(_gpsAddress)
        returns (address highestBidder)
    {
        properties[_gpsAddress].isAuctionActive = false;
        highestBidder = super.endAuction(_gpsAddress);
        return highestBidder;
    }

    function cancelAuction(
        string memory _gpsAddress
    ) public override onlyRegisteredProperty(_gpsAddress) {
        properties[_gpsAddress].isAuctionActive = false;
        super.cancelAuction(_gpsAddress);
    }

    function initiateTransaction(
        string memory _gpsAddress,
        address _buyer
    )
        internal
        onlyRegisteredProperty(_gpsAddress)
        onlyPropertyOwner(_gpsAddress)
    {
        Transaction storage txn = transactions[_gpsAddress];
        txn.buyer = _buyer;
        txn.seller = msg.sender;
        txn.isActive = true;

        emit TransactionInitiated(_gpsAddress, _buyer, msg.sender);
    }

    // Override the _afterAuctionEnd function to call initiateTransaction
    function _afterAuctionEnd(
        string memory propertyAddress,
        address highestBidder,
        uint256 highestBid
    ) internal override {
        pendingReturns[highestBidder] += highestBid;
        initiateTransaction(propertyAddress, highestBidder);
    }

    //this function is for the buyer or seller to confirm the transaction on-chain after making the transaction off-chain.
    function confirmTransaction(string memory _gpsAddress) public {
        Transaction storage txn = transactions[_gpsAddress];
        if (!txn.isActive) {
            revert PROPERTYREGISTERY__TRANSACTION_NOT_ACTIVE();
        }
        if (msg.sender != txn.buyer && msg.sender != txn.seller) {
            revert PROPERTYREGISTERY__NOT_AUTHORIZED_FOR_CONFIRMATION();
        }

        if (msg.sender == txn.buyer) {
            txn.buyerConfirmed = true;
        } else if (msg.sender == txn.seller) {
            txn.sellerConfirmed = true;
        }

        if (txn.buyerConfirmed && txn.sellerConfirmed) {
            emit TransactionConfirmed(_gpsAddress, txn.buyer, txn.seller);
        }
    }

    function adminConfirmTransaction(
        string memory _gpsAddress,
        string memory _newDocumentHash
    ) public onlyAdmin {
        Transaction storage txn = transactions[_gpsAddress];
        if (!txn.buyerConfirmed && !txn.sellerConfirmed) {
            revert PROPERTYREGISTERY__TRANSACTION_NOT_CONFIRMED();
        }

        txn.adminConfirmed = true;
        _completeTransaction(_gpsAddress, _newDocumentHash);
    }

    function _completeTransaction(
        string memory _gpsAddress,
        string memory _newDocumentHash
    ) internal {
        Transaction storage txn = transactions[_gpsAddress];
        if (!txn.adminConfirmed) {
            revert PROPERTYREGISTERY__TRANSACTION_NOT_CONFIRMED_BY_ADMIN();
        }

        _transferProperty(_gpsAddress, txn.seller, txn.buyer);
        _updatePropertyDocs(_gpsAddress, _newDocumentHash);

        txn.isActive = false;
        emit TransactionCompleted(_gpsAddress, txn.seller, txn.buyer);
    }

    function _transferProperty(
        string memory _gpsAddress,
        address oldOwner,
        address newOwner
    ) internal {
        properties[_gpsAddress].owner = newOwner;
        emit PropertyTransferred(_gpsAddress, oldOwner, newOwner);
    }

    function _updatePropertyDocs(
        string memory _gpsAddress,
        string memory _newDocumentHash
    ) internal {
        properties[_gpsAddress].ipfsHash = _newDocumentHash;
        emit PropertyDocsUpdated(_gpsAddress, _newDocumentHash);
    }
}
