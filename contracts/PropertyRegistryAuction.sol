// SPDX-License-Identifier: MIT
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol";
pragma solidity ^0.8.24;

error AUCTION__AUCTION_DOES_NOT_EXIST();
error AUCTION__AUCTION_NOT_ACTIVE();
error AUCTION__AUCTION_ALREADY_EXISTS();
error AUCTION__AUCTION_HAS_ENDED();
error AUCTION__AUCTION_NOT_ENDED();
error AUCTION__HIGHER_BID_EXISTS();
error AUCTION__ONLY_SELLER();
error AUCTION__BID_ALREADY_PLACED();
error AUCTION__NO_FUNDS_TO_WITHDRAW();
error AUCTION__WITHDRAW_FAILED();
error AUCTION__NO_UPKEEP_NEEDED();

/// @title Auction Contract
/// @notice This contract is used to manage property auctions and bidding of properties
/// @dev Implements Chainlink Keepers for automatation

contract Auction is ReentrancyGuard, AutomationCompatible {
    struct AuctionItem {
        string propertyAddress;
        address payable seller;
        address payable highestBidder;
        uint256 startingPrice;
        uint256 highestBid;
        uint256 auctionEndTime;
        bool isActive;
        bool bidPlaced;
    }

    mapping(string => AuctionItem) public auctions;
    mapping(address => uint256) public pendingReturns;
    string[] public activeAuctionList;
    mapping(string => bool) public activeAuctions; // Track all active auction addresses(property addresses)

    event AuctionCreated(
        string indexed propertyAddress,
        address indexed seller,
        uint256 startingPrice,
        uint256 auctionEndTime
    );
    event BidPlaced(
        string indexed propertyAddress,
        address indexed bidder,
        uint256 amount
    );
    event AuctionEnded(
        string indexed propertyAddress,
        address indexed highestBidder,
        uint256 highestBid
    );
    event AuctionCanceled(
        string indexed propertyAddress,
        address indexed seller
    );

    modifier auctionExists(string memory propertyAddress) {
        if (auctions[propertyAddress].auctionEndTime == 0) {
            revert AUCTION__AUCTION_DOES_NOT_EXIST();
        }

        _;
    }

    modifier auctionActive(string memory propertyAddress) {
        if (block.timestamp >= auctions[propertyAddress].auctionEndTime) {
            revert AUCTION__AUCTION_HAS_ENDED();
        }

        _;
    }

    modifier onlySeller(string memory propertyAddress) {
        if (msg.sender != auctions[propertyAddress].seller) {
            revert AUCTION__ONLY_SELLER();
        }

        _;
    }

    function checkUpkeep(
        bytes calldata /* checkData */
    )
        external
        view
        override
        returns (bool upkeepNeeded, bytes memory performData)
    {
        // Check for any active auction that has ended

        for (uint256 i = 0; i < activeAuctionList.length; i++) {
            string memory propertyAddress = activeAuctionList[i];

            if (
                block.timestamp >= auctions[propertyAddress].auctionEndTime &&
                activeAuctions[propertyAddress]
            ) {
                return (true, abi.encode(propertyAddress));
            }
        }
        return (false, "");
    }

    function performUpkeep(bytes calldata performData) external override {
        string memory propertyAddress = abi.decode(performData, (string));
        AuctionItem storage auction = auctions[propertyAddress];

        if (
            !activeAuctions[propertyAddress] ||
            block.timestamp < auction.auctionEndTime
        ) {
            revert AUCTION__NO_UPKEEP_NEEDED();
        }

        endAuction(propertyAddress);
    }

    function createAuction(
        string memory propertyAddress,
        uint256 startingPrice,
        uint256 auctionEndTime
    ) public virtual nonReentrant {
        if (auctions[propertyAddress].isActive) {
            revert AUCTION__AUCTION_ALREADY_EXISTS();
        }

        AuctionItem storage newAuction = auctions[propertyAddress];
        newAuction.propertyAddress = propertyAddress;
        newAuction.seller = payable(msg.sender);
        newAuction.startingPrice = startingPrice;
        newAuction.highestBid = startingPrice;
        newAuction.auctionEndTime = block.timestamp + auctionEndTime;
        newAuction.isActive = true;
        newAuction.bidPlaced = false;

        activeAuctions[propertyAddress] = true;
        activeAuctionList.push(propertyAddress);

        emit AuctionCreated(
            propertyAddress,
            msg.sender,
            startingPrice,
            auctionEndTime
        );
    }

    function placeBid(
        string memory propertyAddress
    )
        public
        payable
        auctionExists(propertyAddress)
        auctionActive(propertyAddress)
        nonReentrant
    {
        AuctionItem storage auction = auctions[propertyAddress];
        if (msg.value <= auction.highestBid) {
            revert AUCTION__HIGHER_BID_EXISTS();
        }

        if (auction.highestBid != 0) {
            pendingReturns[auction.highestBidder] += auction.highestBid;
        }

        auction.highestBid = msg.value;
        auction.highestBidder = payable(msg.sender);
        auction.bidPlaced = true;

        emit BidPlaced(propertyAddress, msg.sender, msg.value);
    }

    function endAuction(
        string memory propertyAddress
    ) internal virtual nonReentrant returns (address highestBidder) {
        AuctionItem storage auction = auctions[propertyAddress];
        if (!auction.isActive) {
            revert AUCTION__AUCTION_NOT_ACTIVE();
        }

        if (block.timestamp < auction.auctionEndTime) {
            revert AUCTION__AUCTION_NOT_ENDED();
        }

        auction.isActive = false;
        _removeActiveAuction(propertyAddress);

        if (auction.bidPlaced) {
            emit AuctionEnded(
                propertyAddress,
                auction.highestBidder,
                auction.highestBid
            );
            _afterAuctionEnd(
                propertyAddress,
                auction.highestBidder,
                auction.highestBid
            );
            highestBidder = auction.highestBidder;
        } else {
            emit AuctionEnded(propertyAddress, address(0), 0);
            highestBidder = address(0);
        }
    }

    function cancelAuction(
        string memory propertyAddress
    ) public virtual nonReentrant onlySeller(propertyAddress) {
        AuctionItem storage auction = auctions[propertyAddress];
        if (!auction.isActive) {
            revert AUCTION__AUCTION_NOT_ACTIVE();
        }

        if (auction.bidPlaced) {
            revert AUCTION__BID_ALREADY_PLACED();
        }

        auction.isActive = false;
        _removeActiveAuction(propertyAddress);
        emit AuctionCanceled(propertyAddress, msg.sender);
    }

    function _removeActiveAuction(string memory propertyAddress) private {
        // Remove from activeAuctions mapping
        activeAuctions[propertyAddress] = false;

        // Remove from activeAuctionList array
        for (uint256 i = 0; i < activeAuctionList.length; i++) {
            if (
                keccak256(abi.encodePacked(activeAuctionList[i])) ==
                keccak256(abi.encodePacked(propertyAddress))
            ) {
                activeAuctionList[i] = activeAuctionList[
                    activeAuctionList.length - 1
                ];
                activeAuctionList.pop();
                break;
            }
        }
    }

    function getAuctionDetails(
        string memory propertyAddress
    ) public view auctionExists(propertyAddress) returns (AuctionItem memory) {
        return auctions[propertyAddress];
    }

    function getHighestBidder(
        string memory propertyAddress
    ) public view returns (address) {
        AuctionItem storage auction = auctions[propertyAddress];

        return auction.highestBidder;
    }

    function withdraw() public nonReentrant {
        uint256 amount = pendingReturns[msg.sender];
        if (amount == 0) {
            revert AUCTION__NO_FUNDS_TO_WITHDRAW();
        }

        pendingReturns[msg.sender] = 0;
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        if (!success) {
            revert AUCTION__WITHDRAW_FAILED();
        }
    }

    // Define this as a virtual function to be overridden in the derived contract
    function _afterAuctionEnd(
        string memory propertyAddress,
        address highestBidder,
        uint256 highestBid
    ) internal virtual {}
}
