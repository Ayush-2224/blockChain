// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract BookRental is ReentrancyGuard, Ownable {
    struct Book {
        string title;
        string author;
        string description;
        string coverImage;
        uint256 dailyPrice;  // Price per minute for testing
        uint256 deposit;
        address owner;
        address renter;
        uint256 rentalStartTime;
        bool isAvailable;
    }

    mapping(uint256 => Book) public books;
    uint256 public bookCount;
    uint256 public constant LATE_FEE_MULTIPLIER = 2; // 2x price for late returns
    uint256 public constant SECONDS_PER_MINUTE = 60; // For testing with minutes

    event DebugRefund(uint256 deposit, uint256 totalRent, uint256 rentalDuration, uint256 additionalMinutes);
    event ItemListed(uint256 indexed bookId, string title, string author, string description, string coverImage, uint256 dailyPrice, uint256 deposit);
    event ItemRented(uint256 indexed bookId, address indexed renter);
    event ItemReturned(uint256 indexed bookId, address indexed renter, uint256 refundAmount);
    event RefundSent(address indexed to, uint256 amount);
    event PaymentSent(address indexed to, uint256 amount);

    constructor() {
        // Ownable constructor is called automatically
    }

    function listItem(
        string memory _title,
        string memory _author,
        string memory _description,
        string memory _coverImage,
        uint256 _dailyPrice,
        uint256 _deposit
    ) external {
        require(bytes(_title).length > 0, "Title cannot be empty");
        require(bytes(_author).length > 0, "Author cannot be empty");
        require(_dailyPrice > 0, "Price must be greater than 0");
        require(_deposit >= _dailyPrice, "Deposit must be greater than or equal to price");

        uint256 bookId = bookCount;
        books[bookId] = Book({
            title: _title,
            author: _author,
            description: _description,
            coverImage: _coverImage,
            dailyPrice: _dailyPrice,
            deposit: _deposit,
            owner: msg.sender,
            renter: address(0),
            rentalStartTime: 0,
            isAvailable: true
        });
        bookCount++;

        emit ItemListed(bookId, _title, _author, _description, _coverImage, _dailyPrice, _deposit);
    }

    function rentItem(uint256 _bookId) external payable nonReentrant {
        require(_bookId < bookCount, "Invalid book ID");
        Book storage book = books[_bookId];
        require(book.isAvailable, "Book is not available");
        require(msg.sender != book.owner, "Cannot rent your own book");

        uint256 totalPayment = book.dailyPrice + book.deposit;
        require(msg.value >= totalPayment, string(abi.encodePacked(
            "Insufficient payment. Required: ",
            uint2str(totalPayment),
            " wei, Sent: ",
            uint2str(msg.value),
            " wei"
        )));

        book.renter = msg.sender;
        book.rentalStartTime = block.timestamp;
        book.isAvailable = false;

        // Transfer the first minute's payment directly to the book owner
        (bool dailyPaymentSuccess, ) = payable(book.owner).call{value: book.dailyPrice}("");
        require(dailyPaymentSuccess, "Initial payment transfer failed");
        emit PaymentSent(book.owner, book.dailyPrice);

        // Refund excess payment
        if (msg.value > totalPayment) {
            (bool success, ) = payable(msg.sender).call{value: msg.value - totalPayment}("");
            require(success, "Excess payment refund failed");
        }

        emit ItemRented(_bookId, msg.sender);
    }

    function returnItem(uint256 _bookId) external payable nonReentrant {
        require(_bookId < bookCount, "Invalid book ID");
        Book storage book = books[_bookId];
        require(!book.isAvailable, "Book is not rented");
        require(msg.sender == book.renter, "Only renter can return the book");

        // Calculate rental duration in minutes with ceiling (round up) for partial minutes
        uint256 rentalSeconds = block.timestamp - book.rentalStartTime;
        // Ceiling division: (a + b - 1) / b
        uint256 rentalDuration = (rentalSeconds + SECONDS_PER_MINUTE - 1) / SECONDS_PER_MINUTE;
        if (rentalDuration == 0) rentalDuration = 1; // Minimum rental period is 1 minute
        
        // Calculate additional minutes after the first minute (which was already paid)
        uint256 additionalMinutes = rentalDuration > 1 ? rentalDuration - 1 : 0;
        uint256 additionalRent = book.dailyPrice * additionalMinutes;

        // Log rental information for debugging
        emit DebugRefund(
            book.deposit, 
            additionalRent, 
            rentalDuration, 
            additionalMinutes
        );

        // Store renter address for event
        address renter = book.renter;

        // Reset book state before transfers to prevent reentrancy
        book.renter = address(0);
        book.rentalStartTime = 0;
        book.isAvailable = true;

        uint256 refundAmount;
        uint256 ownerPayment;
        uint256 extraPaymentNeeded;
        
        if (additionalRent > book.deposit) {
            // Calculate extra payment needed from renter
            extraPaymentNeeded = additionalRent - book.deposit;
            
            // Verify the renter has sent the extra payment
            require(msg.value >= extraPaymentNeeded, string(abi.encodePacked(
                "Additional payment required: ",
                uint2str(extraPaymentNeeded),
                " wei for additional rent of ",
                uint2str(additionalRent),
                " wei (duration: ",
                uint2str(rentalDuration),
                " minutes, with first minute already paid)"
            )));
            
            refundAmount = 0; // No refund as rent exceeds deposit
            ownerPayment = book.deposit + extraPaymentNeeded; // Total additional rent to owner
            
            // Refund excess payment if any
            if (msg.value > extraPaymentNeeded) {
                uint256 excessPayment = msg.value - extraPaymentNeeded;
                (bool success, ) = payable(renter).call{value: excessPayment}("");
                require(success, "Excess payment refund failed");
                emit RefundSent(renter, excessPayment);
            }
            
            // Transfer payment to book owner
            (bool ownerSuccess, ) = payable(book.owner).call{value: ownerPayment}("");
            require(ownerSuccess, "Owner payment transfer failed");
            emit PaymentSent(book.owner, ownerPayment);
        } else {
            require(msg.value == 0, "No additional payment needed for return");
            refundAmount = book.deposit - additionalRent;
            ownerPayment = additionalRent;

            // Transfer refund to renter
            if (refundAmount > 0) {
                (bool refundSuccess, ) = payable(renter).call{value: refundAmount}("");
                require(refundSuccess, "Refund transfer failed");
                emit RefundSent(renter, refundAmount);
            }

            // Transfer payment to book owner (if any additional rent is due)
            if (ownerPayment > 0) {
                (bool ownerSuccess, ) = payable(book.owner).call{value: ownerPayment}("");
                require(ownerSuccess, "Owner payment transfer failed");
                emit PaymentSent(book.owner, ownerPayment);
            }
        }

        emit ItemReturned(_bookId, renter, refundAmount);
    }

    function getBook(uint256 _bookId) external view returns (
        string memory title,
        string memory author,
        string memory description,
        string memory coverImage,
        uint256 dailyPrice,
        uint256 deposit,
        address owner,
        address renter,
        uint256 rentalStartTime,
        bool isAvailable
    ) {
        require(_bookId < bookCount, "Invalid book ID");
        Book storage book = books[_bookId];
        return (
            book.title,
            book.author,
            book.description,
            book.coverImage,
            book.dailyPrice,
            book.deposit,
            book.owner,
            book.renter,
            book.rentalStartTime,
            book.isAvailable
        );
    }

    function getBookCount() external view returns (uint256) {
        return bookCount;
    }

    // Helper function to convert uint to string
    function uint2str(uint _i) internal pure returns (string memory _uintAsString) {
        if (_i == 0) {
            return "0";
        }
        uint j = _i;
        uint len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint k = len;
        while (_i != 0) {
            k = k-1;
            uint8 temp = (48 + uint8(_i - _i / 10 * 10));
            bytes1 b1 = bytes1(temp);
            bstr[k] = b1;
            _i /= 10;
        }
        return string(bstr);
    }
} 
