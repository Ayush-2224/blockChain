Decentralized Book Rental
Project Objective
Build a trustless book rental platform where:
Owners can list books/items for rent (with deposit and daily price)
Renters can borrow items by paying a deposit + rental fee
Smart contracts automatically:
Hold deposits until item return
Refund deposits (minus rental fees) upon return
Penalize late returns
What you must deliver
1. Smart Contract Implementation
Core Functions
listItem
Allows owners to list books/items (title, author, description, daily price, deposit)
Stores data in a struct (optimized for gas)
rentItem
Accepts ETH payment (deposit + 1st day's rent)
Locks item availability
returnItem
Calculates rental duration and refund (deposit - days rented × price)
Transfers payments to owner/renter
Key Features
Uses mapping to track rentals
Emits events (ItemListed, ItemRented, ItemReturned)
Implements reentrancy protection (OpenZeppelin)
A reentrancy attack occurs when a malicious contract repeatedly calls back into a vulnerable contract before the original function completes, draining funds or manipulating state.
How It Works
Attacker Calls a Function
Example: Withdrawing funds from a smart contract.
Contract Sends Funds
The vulnerable contract transfers ETH before updating state (e.g., setting balance to 0).
Attacker's Fallback Function Reenters
The attacker's contract has a receive() or fallback() function that calls the vulnerable function again.
Since the state wasn't updated, the attacker can withdraw repeatedly.





2. Testing (Truffle + Ganache)
Test Cases
Listing Items
Verify only owners can list
Renting
Test correct payment handling
Reject double rentals
Returns
Validate refund calculations
Penalize late returns
3. Frontend (React)
UI Components
Listing Page: Form for owners (title, author, description, price, deposit)
Marketplace: Displays available items with details (title, author, description) and rent buttons
My Rentals: Shows rented items with details (title, author, description) + return button
Key Features
Connects to MetaMask/Ganache
Displays real-time availability

4. Documentation
README.md with:
Setup instructions
Contract explanation
Testing guide

Evaluation Criteria (50 marks)

1. Smart Contract Implementation (15 Marks)
listItem function (3 marks)
Correctly allows owners to list books with details (title, author, description, price, deposit).
rentItem function (4 marks)
Handles payments, checks availability, and updates rental status.
returnItem function (4 marks)
Calculates refunds (deposit - rental fees) and resets book status.
Data storage (2 marks)
Uses efficient structures (e.g., Book struct, arrays/mappings).
Events (2 marks)
Emits BookListed, BookRented, and BookReturned events.

2. Testing (10 Marks)
listItem tests (2 marks)
Verifies books are listed correctly.
rentItem tests (3 marks)
Checks payment handling and availability logic.
returnItem tests (3 marks)
Validates refund calculations and status updates.
Edge cases (2 marks)
Tests failures (e.g., renting an unavailable book).
Testing (Truffle + Ganache)
Test Cases
Item Listing
Only owner can list
Correct storage of price/deposit
Renting
Rejects incorrect payments
Locks item availability
Returns
Calculates refunds accurately
Penalizes late returns

3. Frontend (10 Marks)
UI Components
Listing Page: Form to add items (name, deposit, daily price)
Marketplace: Shows available items with rent buttons
My Rentals: Displays currently rented items + return buttons

Wallet connection (2 marks)
Integrates MetaMask/Ganache via web3.js or ethers.js.
Book listing (3 marks)
Dynamically fetches and displays books from the contract.
Rent/return functionality (3 marks)
Calls rentItem/returnItem and shows transaction status.
Error handling (2 marks)
Displays alerts for failed transactions.

4. Optimization & Gas Efficiency (7 Marks)
Uses uint256 for ETH values (2 marks)
Avoids expensive types like string for prices.
Minimal on-chain data (3 marks)
No redundant storage (e.g., only book metadata, not content).
Efficient functions (2 marks)
Avoids loops/complex math in critical functions.

5. Privacy & Data Handling (5 Marks)
No personal data on-chain (3 marks)
Stores only necessary details (e.g., book title, price, owner address).
Secure deposit/refund logic (2 marks)
Prevents exploits (e.g., incorrect refund calculations).

6. Documentation & Extras (3 Marks)
README 
Clear setup instructions (e.g., Ganache, contract deployment).
Additional features in project
Extra credit for late fees (charges for overdue books), off-chain storage of data (local JSON server), or user ratings.

Key Evaluation Considerations
1. Smart Contract Efficiency
Gas Optimization (Check for):
Use of uint256 for ETH values (price/deposit) instead of strings
Avoidance of storage-heavy operations in loops
Minimal on-chain data (only book metadata, not content)
Struct Design:
Proper use of Book struct with essential fields only
No redundant storage (e.g., don't store renter history unless required)
2. Security
Deposit Handling:
Funds must be locked during rental period
Refund logic should be mathematically sound (deposit - rental days × price)
Access Control:
Only book owner can list/modify
Only renter can return books
3. Testing Coverage
Core Functionality:
Book listing
Rental with payment
Return with proper refund
Edge Cases:
Double rental attempts
Early returns
Insufficient payment tests
4. Frontend Implementation
Wallet Integration:
Proper connection to Ganache/MetaMask
Real-Time Updates:
UI reflects blockchain state changes (e.g., availability after rental)
Error Handling:
Clear messages for failed transactions
5. Privacy Considerations
Data Minimization:
No personal user data stored on-chain
Only necessary book details (title, price - not full content)
Pseudonymity:
Uses addresses instead of names/emails
6. Blockchain Appropriateness
Justification:
Used for trustless deposits/payments
Not used for book content storage
Cost-Benefit:
You should understand when to use on-chain vs off-chain data
On-Chain (Blockchain)
Item Ownership
Track who owns/rents each item
Financial Transactions
Deposit holding
Rental fee calculations
Availability Status
Item lock during rentals
Basic Book Metadata
Title, author name, and brief description (gas-optimized)

Off-Chain Data
Item Descriptions
Detailed book summaries
Author names
Book descriptions
User Profiles
Contact information
Images
Book covers/thumbnails


