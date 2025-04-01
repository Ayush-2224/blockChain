import React, { useState, useEffect, useCallback } from 'react';
import { useWeb3React } from '@web3-react/core';
import { Card, Button, Alert, Row, Col, Spinner, Container, Badge } from 'react-bootstrap';
import { ethers } from 'ethers';
import { contractAddress, contractABI } from '../utils/contractConfig';

function Marketplace() {
  const { account, library, chainId } = useWeb3React();
  const [books, setBooks] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [rentingBookId, setRentingBookId] = useState(null);

  const loadBooks = useCallback(async () => {
    if (!library || !contractAddress) {
      setLoading(false);
      return;
    }

    try {
      const provider = library;
      const contract = new ethers.Contract(
        contractAddress,
        contractABI,
        provider
      );

      const code = await provider.getCode(contractAddress);
      if (code === '0x') {
        setError('Contract not deployed at the specified address');
        setLoading(false);
        return;
      }

      const bookCount = await contract.getBookCount();
      
      if (bookCount.toNumber() === 0) {
        setBooks([]);
        setLoading(false);
        return;
      }

      const booksData = [];
      for (let i = 0; i < bookCount; i++) {
        try {
          const book = await contract.getBook(i);
          if (book.isAvailable) {
            booksData.push({
              id: i,
              title: book.title,
              dailyPrice: ethers.utils.formatEther(book.dailyPrice),
              deposit: ethers.utils.formatEther(book.deposit),
              owner: book.owner,
            });
          }
        } catch (err) {
          console.error(`Error loading book ${i}:`, err);
        }
      }

      setBooks(booksData);
    } catch (err) {
      console.error('Error in loadBooks:', err);
      setError(`Error loading books: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  }, [library, chainId, account]);

  useEffect(() => {
    loadBooks();
    // Refresh books every 30 seconds
    const interval = setInterval(loadBooks, 30000);
    return () => clearInterval(interval);
  }, [loadBooks]);

  const handleRent = async (bookId, deposit, dailyPrice) => {
    if (!library || !contractAddress) {
      setError('Please connect your wallet first');
      return;
    }

    setRentingBookId(bookId);
    setError('');
    setSuccess('');

    try {
      const provider = library;
      const signer = provider.getSigner();
      const contract = new ethers.Contract(
        contractAddress,
        contractABI,
        signer
      );

      // First check if the book is still available
      const book = await contract.getBook(bookId);
      if (!book.isAvailable) {
        setError('This book is no longer available for rent.');
        loadBooks(); // Refresh the list
        return;
      }

      // Check if user is trying to rent their own book
      if (book.owner.toLowerCase() === account.toLowerCase()) {
        setError('You cannot rent your own book.');
        return;
      }

      // Calculate total payment (deposit + first minute's rent)
      const depositAmount = ethers.utils.parseEther(deposit.toString());
      const priceAmount = ethers.utils.parseEther(dailyPrice.toString());
      const totalPayment = depositAmount.add(priceAmount);

      // Check if user has enough balance
      const balance = await provider.getBalance(account);
      
      // Get current gas price with a small buffer
      const gasPrice = (await provider.getGasPrice()).mul(12).div(10); // Add 20% buffer
      
      // Estimate gas with the value parameter
      const gasLimit = await contract.estimateGas.rentItem(bookId, { 
        value: totalPayment,
        from: account,
        gasPrice: gasPrice
      });

      const gasCost = gasLimit.mul(gasPrice);
      const totalRequired = totalPayment.add(gasCost);

      if (balance.lt(totalRequired)) {
        const formattedBalance = ethers.utils.formatEther(balance);
        const formattedRequired = ethers.utils.formatEther(totalRequired);
        const formattedGasCost = ethers.utils.formatEther(gasCost);
        
        setError(
          `Insufficient funds for transaction:\n` +
          `- Your balance: ${formattedBalance} ETH\n` +
          `- Required payment: ${ethers.utils.formatEther(totalPayment)} ETH\n` +
          `- Estimated gas cost: ${formattedGasCost} ETH\n` +
          `- Total required: ${formattedRequired} ETH\n\n` +
          `Please add ${(parseFloat(formattedRequired) - parseFloat(formattedBalance)).toFixed(6)} ETH to your wallet.`
        );
        return;
      }

      setSuccess('Confirming transaction... Please wait and approve in MetaMask.');
      
      // Send transaction with explicit parameters
      const tx = await contract.rentItem(bookId, { 
        value: totalPayment,
        from: account,
        gasLimit: gasLimit,
        gasPrice: gasPrice,
        nonce: await provider.getTransactionCount(account, 'latest')
      });

      setSuccess('Transaction submitted! Waiting for confirmation...');
      await tx.wait();

      setSuccess('Book rented successfully! You can view it in My Rentals.');
      loadBooks();
    } catch (err) {
      console.error('Error renting book:', err);
      
      if (err.code === 4001) {
        setError('Transaction was rejected in MetaMask. Please try again.');
      } else if (err.message.includes('insufficient funds')) {
        try {
          // Try to parse the detailed error message
          const match = err.message.match(/Required: (\d+) wei, Sent: (\d+) wei/);
          if (match) {
            const required = ethers.utils.formatEther(match[1]);
            const sent = ethers.utils.formatEther(match[2]);
            setError(
              `Insufficient funds:\n` +
              `- Required: ${required} ETH\n` +
              `- Available: ${sent} ETH\n` +
              `Please add ${(parseFloat(required) - parseFloat(sent)).toFixed(6)} ETH to your wallet.`
            );
          } else {
            setError('Insufficient funds to rent the book. Please check your balance.');
          }
        } catch (parseErr) {
          setError('Insufficient funds to rent the book. Please check your balance.');
        }
      } else if (err.message.includes('not available')) {
        setError('This book is no longer available for rent.');
        loadBooks();
      } else if (err.message.includes('user rejected')) {
        setError('Transaction was cancelled. Please try again.');
      } else if (err.message.includes('network changed')) {
        setError('Network changed. Please make sure you are on the correct network.');
      } else if (err.message.includes('Internal JSON-RPC error')) {
        // Try to extract the actual error message
        const errorMatch = err.message.match(/{"message":"([^"]+)"/);
        if (errorMatch) {
          setError(`Transaction failed: ${errorMatch[1]}`);
        } else {
          setError('Transaction failed. Please try again with a higher gas limit.');
        }
      } else {
        setError(`Error renting book: ${err.message || 'Unknown error'}`);
      }
    } finally {
      setRentingBookId(null);
    }
  };

  if (!account) {
    return (
      <Card className="shadow-sm">
        <Card.Body className="text-center">
          <Card.Title>Connect Your Wallet</Card.Title>
          <Card.Text>Please connect your wallet to view the marketplace.</Card.Text>
        </Card.Body>
      </Card>
    );
  }

  if (!contractAddress) {
    return (
      <Card className="shadow-sm">
        <Card.Body className="text-center">
          <Card.Title>Contract Not Deployed</Card.Title>
          <Card.Text>Please make sure you are connected to the correct network.</Card.Text>
        </Card.Body>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="text-center mt-5">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      </div>
    );
  }

  return (
    <Container>
      <h2 className="mb-4">Available Books</h2>
      {error && (
        <Alert variant="danger" className="mb-4">
          <i className="bi bi-exclamation-triangle me-2"></i>
          {error}
        </Alert>
      )}
      {success && (
        <Alert variant="success" className="mb-4">
          <i className="bi bi-check-circle me-2"></i>
          {success}
        </Alert>
      )}

      <Row>
        {books.map((book) => (
          <Col key={book.id} md={4} className="mb-4">
            <Card className="h-100 shadow-sm">
              <Card.Body>
                <Card.Title className="d-flex justify-content-between align-items-center">
                  {book.title}
                  <Badge bg="success">Available</Badge>
                </Card.Title>
                <div className="mb-3">
                  <p className="mb-2">
                    <strong>Price per Minute:</strong> {book.dailyPrice} ETH
                  </p>
                  <p className="mb-2">
                    <strong>Deposit:</strong> {book.deposit} ETH
                  </p>
                  <p className="text-muted small mb-0">
                    Owner: {book.owner.slice(0, 6)}...{book.owner.slice(-4)}
                  </p>
                </div>
                <Button
                  variant="primary"
                  onClick={() => handleRent(book.id, book.deposit, book.dailyPrice)}
                  disabled={rentingBookId === book.id}
                  className="w-100"
                >
                  {rentingBookId === book.id ? (
                    <>
                      <Spinner
                        as="span"
                        animation="border"
                        size="sm"
                        role="status"
                        aria-hidden="true"
                        className="me-2"
                      />
                      Renting...
                    </>
                  ) : (
                    'Rent Book'
                  )}
                </Button>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

      {books.length === 0 && !error && (
        <Card className="shadow-sm">
          <Card.Body className="text-center">
            <Card.Title>No Books Available</Card.Title>
            <Card.Text>There are currently no books available for rent.</Card.Text>
          </Card.Body>
        </Card>
      )}
    </Container>
  );
}

export default Marketplace; 