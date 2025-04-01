# Decentralized Book Rental Platform

A decentralized application (DApp) for renting books using Ethereum smart contracts.

## Features

- List books/items for rent with deposit and daily price
- Rent items by paying deposit + rental fee
- Automatic deposit holding and refunds
- Late return penalties
- Real-time availability tracking

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- Git
- MetaMask browser extension
- Ganache (for local blockchain)

## Setup Instructions

1. Clone the repository:
```bash
git clone <your-repository-url>
cd book-rental-dapp
```

2. Install dependencies:
```bash
npm install
cd frontend
npm install
```

3. Start Ganache:
   - Open Ganache
   - Create a new workspace
   - Set the following settings:
     - Network ID: 1337
     - Port: 8545
     - Chain ID: 1337

4. Configure MetaMask:
   - Open MetaMask
   - Click on the network dropdown
   - Click "Add Network"
   - Fill in the following details:
     - Network Name: Ganache
     - RPC URL: http://127.0.0.1:8545
     - Chain ID: 1337
     - Currency Symbol: ETH
   - Click "Save"

5. Deploy the smart contract:
```bash
# In the project root directory
truffle migrate --reset
```

6. Copy contract artifacts:
```bash
# Windows
copy build\contracts\BookRental.json frontend\src\contracts\

# Linux/Mac
cp build/contracts/BookRental.json frontend/src/contracts/
```

7. Start the frontend application:
```bash
cd frontend
npm start
```

8. Connect your wallet:
   - Open MetaMask
   - Import one of the accounts from Ganache using the private key
   - Make sure you're connected to the Ganache network
   - The account should have 100 ETH for testing

## Testing the Application

1. List a Book:
   - Click "List Book" in the navigation
   - Fill in the book details:
     - Title: "Test Book"
     - Daily Price: 0.01 ETH
     - Deposit: 0.05 ETH
   - Click "List Book"
   - Confirm the transaction in MetaMask

2. Rent a Book:
   - Go to the Marketplace
   - Click "Rent Book" on any available book
   - Confirm the transaction in MetaMask

3. Return a Book:
   - Go to "My Rentals"
   - Click "Return Book" on any rented book
   - Confirm the transaction in MetaMask

## Troubleshooting

1. If you see "Contract not deployed" error:
   - Make sure Ganache is running
   - Redeploy the contract using `truffle migrate --reset`
   - Copy the new contract artifacts

2. If MetaMask shows "Unsupported network":
   - Check that you're connected to the Ganache network
   - Verify the network settings in MetaMask

3. If transactions fail:
   - Make sure you have enough ETH in your account
   - Check that you're using the correct network
   - Try resetting your MetaMask account

## Network Configuration

For testing with multiple users:
1. Each user should run their own Ganache instance
2. Each user should deploy the contract to their local Ganache
3. Each user should configure MetaMask to connect to their local Ganache
4. Each user should use different accounts from their Ganache instance

This setup allows each user to test the application independently on their own machine.

## Project Structure

```
├── contracts/           # Smart contracts
├── migrations/         # Deployment scripts
├── test/              # Contract tests
├── frontend/          # React frontend
└── truffle-config.js  # Truffle configuration
```

## Testing

Run the test suite:
```bash
truffle test
```

## Smart Contracts

The main contract `BookRental.sol` implements:
- `listItem`: List books for rent
- `rentItem`: Rent a book
- `returnItem`: Return a rented book

## Frontend

The React frontend provides:
- Book listing interface
- Rental marketplace
- Rental management dashboard
- MetaMask integration

## Security Features

- Reentrancy protection using OpenZeppelin
- Secure deposit handling
- Access control for owners
- Gas-optimized data structures

## License

MIT 