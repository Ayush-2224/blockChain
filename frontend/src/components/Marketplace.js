import React, { useState, useEffect, useCallback } from 'react';
import { useWeb3React } from '@web3-react/core';
import { Card, Button, Alert, Row, Col, Spinner, Container, Badge } from 'react-bootstrap';
import { ethers } from 'ethers';
import { contractAddress, contractABI } from '../utils/contractConfig';
import Notification from './Notification';
import { categorizeError, formatSuccessMessage } from '../utils/notificationUtils';
import { resolveIPFSUrl } from '../utils/pinataConfig';

function Marketplace() {
  const { account, library, chainId } = useWeb3React();
  const [books, setBooks] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [rentingBookId, setRentingBookId] = useState(null);

  // Notification states
  const [notification, setNotification] = useState({
    show: false,
    type: '',
    message: ''
  });

  // Show notification with auto-dismiss
  const showNotification = (type, message) => {
    setNotification({
      show: true,
      type,
      message
    });
    
    // Auto-clear notification reference after dismissal
    setTimeout(() => {
      setNotification(prev => ({
        ...prev,
        show: false
      }));
    }, 3000);
  };

  // Handle errors with categorization
  const handleError = (error) => {
    const { type, message } = categorizeError(error);
    showNotification(type, message);
  };

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
        handleError('Contract not deployed at the specified address');
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
            console.log(`Book ${i} cover image:`, book.coverImage);
            
            booksData.push({
              id: i,
              title: book.title,
              author: book.author,
              description: book.description,
              coverImage: book.coverImage,
              dailyPrice: ethers.utils.formatEther(book.dailyPrice),
              deposit: ethers.utils.formatEther(book.deposit),
              owner: book.owner,
            });
          }
        } catch (err) {
          console.error(`Error loading book ${i}:`, err);
        }
      }
      
      console.log("Loaded books data:", booksData);
      setBooks(booksData);
    } catch (err) {
      console.error('Error in loadBooks:', err);
      handleError(err);
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
      handleError('Please connect your wallet first');
      return;
    }

    setRentingBookId(bookId);

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
        handleError('This book is no longer available for rent.');
        loadBooks(); // Refresh the list
        return;
      }

      // Check if user is trying to rent their own book
      if (book.owner.toLowerCase() === account.toLowerCase()) {
        handleError('You cannot rent your own book.');
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
        
        handleError(
          `Insufficient funds for transaction:\n` +
          `- Your balance: ${formattedBalance} ETH\n` +
          `- Required payment: ${ethers.utils.formatEther(totalPayment)} ETH\n` +
          `- Estimated gas cost: ${formattedGasCost} ETH\n` +
          `- Total required: ${formattedRequired} ETH\n\n` +
          `Please add ${(parseFloat(formattedRequired) - parseFloat(formattedBalance)).toFixed(6)} ETH to your wallet.`
        );
        return;
      }

      showNotification('info', 'Confirming transaction... Please wait and approve in MetaMask.');
      
      // Send transaction with explicit parameters
      const tx = await contract.rentItem(bookId, { 
        value: totalPayment,
        from: account,
        gasLimit: gasLimit,
        gasPrice: gasPrice,
        nonce: await provider.getTransactionCount(account, 'latest')
      });

      showNotification('info', 'Transaction submitted! Waiting for confirmation...');
      await tx.wait();

      showNotification('success', formatSuccessMessage('rent'));
      loadBooks();
    } catch (err) {
      console.error('Error renting book:', err);
      handleError(err);
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

  const renderBooks = () => {
    if (books.length === 0) {
      return (
        <div className="empty-state animate__animated animate__fadeIn">
          <i className="bi bi-book text-muted"></i>
          <h3>No Books Available</h3>
          <p>There are no books available for rent at the moment.</p>
        </div>
      );
    }

    return (
      <Row xs={1} md={2} lg={3} className="g-4">
        {books.map((book) => (
          <Col key={book.id}>
            <Card className="h-100 book-card shadow-sm animate__animated animate__fadeIn">
              <Card.Header className="bg-primary text-white">
                <h5 className="mb-0">
                  <i className="bi bi-book me-2"></i>
                  {book.title}
                </h5>
              </Card.Header>
              {book.coverImage && (
                <div className="book-cover-container">
                  <img 
                    src={resolveIPFSUrl(book.coverImage)} 
                    alt={`Cover for ${book.title}`} 
                    className="img-fluid book-cover-image w-100"
                    style={{ 
                      height: '250px', 
                      objectFit: 'cover',
                      backgroundColor: '#f8f9fa',
                      border: '1px solid #dee2e6'
                    }}
                    onError={(e) => {
                      console.error("Failed to load image:", book.coverImage);
                      e.target.onerror = null;
                      e.target.src = 'https://via.placeholder.com/500x700?text=No+Image';
                    }}
                  />
                </div>
              )}
              <Card.Body>
                <Card.Text className="book-author mb-3">
                  <strong><i className="bi bi-person me-2"></i>Author:</strong> {book.author}
                </Card.Text>
                <div className="book-description mb-3">
                  <strong><i className="bi bi-card-text me-2"></i>Description:</strong> 
                  <p className="mt-2">{book.description || "No description provided."}</p>
                </div>
                <Card.Text>
                  <strong><i className="bi bi-currency-dollar me-2"></i>Price:</strong> {book.dailyPrice} ETH per minute
                </Card.Text>
                <Card.Text>
                  <strong><i className="bi bi-shield-lock me-2"></i>Deposit:</strong> {book.deposit} ETH
                </Card.Text>
                <Button
                  variant="primary"
                  className="w-100 mt-3"
                  onClick={() => handleRent(book.id, book.deposit, book.dailyPrice)}
                  disabled={rentingBookId === book.id}
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
                    <>
                      <i className="bi bi-cart-plus me-2"></i>
                      Rent Now
                    </>
                  )}
                </Button>
              </Card.Body>
              <Card.Footer className="text-muted">
                <small>
                  <i className="bi bi-person-circle me-1"></i>
                  Listed by: {book.owner.substring(0, 6)}...{book.owner.substring(38)}
                </small>
              </Card.Footer>
            </Card>
          </Col>
        ))}
      </Row>
    );
  };

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

      {/* Notifications */}
      <Notification
        show={notification.show}
        type={notification.type}
        message={notification.message}
        onClose={() => setNotification(prev => ({ ...prev, show: false }))}
      />

      {loading ? (
        <div className="text-center p-5">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Loading...</span>
          </Spinner>
          <p className="mt-3">Loading available books...</p>
        </div>
      ) : (
        renderBooks()
      )}
    </Container>
  );
}

export default Marketplace; 