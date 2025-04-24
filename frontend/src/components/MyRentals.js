import React, { useState, useEffect, useCallback } from 'react';
import { useWeb3React } from '@web3-react/core';
import { Card, Button, Alert, Row, Col, Spinner, Container, Badge } from 'react-bootstrap';
import { ethers } from 'ethers';
import { contractAddress, contractABI } from '../utils/contractConfig';
import Notification from './Notification';
import { categorizeError, formatSuccessMessage } from '../utils/notificationUtils';
import { resolveIPFSUrl } from '../utils/pinataConfig';

function MyRentals() {
  const { account, library, chainId } = useWeb3React();
  const [rentedBooks, setRentedBooks] = useState([]);
  const [returnedBooks, setReturnedBooks] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [returningBookId, setReturningBookId] = useState(null);
  
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

  const loadRentedBooks = useCallback(async () => {
    if (!library || !contractAddress || !account) {
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

      const bookCount = await contract.getBookCount();
      const booksData = [];
      
      for (let i = 0; i < bookCount; i++) {
        try {
          const book = await contract.getBook(i);
          if (!book.isAvailable && book.renter.toLowerCase() === account.toLowerCase()) {
            const rentalDuration = Math.floor(
              (Date.now() / 1000 - book.rentalStartTime.toNumber()) / 60
            );
            const totalRent = ethers.BigNumber.from(book.dailyPrice).mul(rentalDuration);
            const estimatedRefund = ethers.BigNumber.from(book.deposit).sub(totalRent);

            booksData.push({
              id: i,
              title: book.title,
              author: book.author,
              description: book.description,
              coverImage: book.coverImage,
              dailyPrice: ethers.utils.formatEther(book.dailyPrice),
              deposit: ethers.utils.formatEther(book.deposit),
              rentalStartTime: new Date(book.rentalStartTime.toNumber() * 1000),
              rentalDuration,
              totalRent: ethers.utils.formatEther(totalRent),
              estimatedRefund: estimatedRefund.lt(0) ? "0" : ethers.utils.formatEther(estimatedRefund)
            });
          }
        } catch (err) {
          console.error(`Error loading book ${i}:`, err);
        }
      }

      setRentedBooks(booksData);
    } catch (err) {
      console.error('Error in loadRentedBooks:', err);
      handleError(err);
    } finally {
      setLoading(false);
    }
  }, [library, chainId, account]);

  const loadReturnedBooks = useCallback(async () => {
    try {
      const storedBooks = localStorage.getItem('returnedBooks');
      if (storedBooks) {
        const parsedBooks = JSON.parse(storedBooks);
        const userBooks = parsedBooks.filter(book => 
          book.renter && book.renter.toLowerCase() === account.toLowerCase()
        );
        setReturnedBooks(userBooks);
      }
    } catch (err) {
      console.error('Error loading returned books:', err);
    }
  }, [account]);

  useEffect(() => {
    loadRentedBooks();
    loadReturnedBooks();
    // Refresh rentals every 30 seconds
    const interval = setInterval(() => {
      loadRentedBooks();
      loadReturnedBooks();
    }, 30000);
    return () => clearInterval(interval);
  }, [loadRentedBooks, loadReturnedBooks]);

  const handleReturn = async (bookId) => {
    if (!library || !contractAddress) return;

    setReturningBookId(bookId);

    try {
      const provider = library;
      const signer = provider.getSigner();
      const contract = new ethers.Contract(
        contractAddress,
        contractABI,
        signer
      );

      // First check if the book is still rented by the user
      const book = await contract.getBook(bookId);
      if (book.isAvailable) {
        handleError('This book is no longer rented.');
        loadRentedBooks();
        return;
      }

      if (book.renter.toLowerCase() !== account.toLowerCase()) {
        handleError('You are not the renter of this book.');
        return;
      }

      // Get the current book data before returning
      const currentBook = rentedBooks.find(b => b.id === bookId);
      
      // Calculate rental duration and total rent
      const rentalDuration = Math.floor(
        (Date.now() / 1000 - book.rentalStartTime.toNumber()) / 60
      ) || 1; // Minimum 1 minute

      const totalRentBN = book.dailyPrice.mul(rentalDuration);
      const depositBN = book.deposit;
      
      // Check if total rent exceeds deposit
      if (totalRentBN.gt(depositBN)) {
        // Case 1: Rental amount is MORE than deposit
        const extraPayment = totalRentBN.sub(depositBN);
        const formattedExtraPayment = ethers.utils.formatEther(extraPayment);
        const formattedTotalRent = ethers.utils.formatEther(totalRentBN);
        const formattedDeposit = ethers.utils.formatEther(depositBN);
        const formattedPricePerMinute = ethers.utils.formatEther(book.dailyPrice);
        
        // Check if user has enough balance for extra payment
        const balance = await provider.getBalance(account);
        const gasPrice = await provider.getGasPrice();
        const estimatedGas = ethers.BigNumber.from(300000); // Fixed gas estimate
        const gasCost = gasPrice.mul(estimatedGas);
        const totalRequired = extraPayment.add(gasCost);

        if (balance.lt(totalRequired)) {
          const shortfall = ethers.utils.formatEther(totalRequired.sub(balance));
          handleError(
            `Insufficient funds for extra payment and gas. ` +
            `You need an additional ${shortfall} ETH.\n` +
            `Required breakdown:\n` +
            `- Extra payment: ${formattedExtraPayment} ETH\n` +
            `- Estimated gas: ${ethers.utils.formatEther(gasCost)} ETH`
          );
          return;
        }

        showNotification('info', 
          `Additional payment required:\n` +
          `- Rental duration: ${rentalDuration} minutes\n` +
          `- Price per minute: ${formattedPricePerMinute} ETH\n` +
          `- Total rent: ${formattedTotalRent} ETH\n` +
          `- Deposit paid: ${formattedDeposit} ETH\n` +
          `- Extra payment needed: ${formattedExtraPayment} ETH\n` +
          `Please confirm the transaction in MetaMask...`
        );

        // Listen for events
        contract.once("DebugRefund", (deposit, totalRent, rentalDuration, additionalMinutes) => {
          console.log("Debug Refund Event:", {
            deposit: ethers.utils.formatEther(deposit),
            totalRent: ethers.utils.formatEther(totalRent),
            rentalDuration: rentalDuration.toString(),
            additionalMinutes: additionalMinutes.toString()
          });
        });

        contract.once("RefundSent", (to, amount) => {
          console.log("Refund Sent Event:", {
            to,
            amount: ethers.utils.formatEther(amount)
          });
          // Update UI to show refund is processed
          showNotification('success', formatSuccessMessage('return'));
        });

        contract.once("PaymentSent", (to, amount) => {
          console.log("Payment Sent Event:", {
            to,
            amount: ethers.utils.formatEther(amount)
          });
        });

        // Send transaction with extra payment
        const tx = await contract.returnItem(bookId, {
          value: extraPayment,
          gasLimit: ethers.utils.hexlify(300000)
        });

        showNotification('info', 'Transaction submitted! Waiting for confirmation...');
        const receipt = await tx.wait();

        // Log all events from the receipt
        console.log("Transaction Receipt Events:", receipt.events);

        // Process events to get actual refund amount
        const refundEvent = receipt.events.find(e => e.event === "RefundSent");
        const returnedEvent = receipt.events.find(e => e.event === "ItemReturned");
        const debugEvent = receipt.events.find(e => e.event === "DebugRefund");

        let actualRefundAmount = "0";
        if (refundEvent) {
          actualRefundAmount = ethers.utils.formatEther(refundEvent.args.amount);
        }

        // Add to returned books history with actual refund amount
        const returnedBook = {
          ...currentBook,
          isReturned: true,
          returnTime: new Date(),
          refundAmount: actualRefundAmount,
          extraPayment: formattedExtraPayment,
          transactionHash: receipt.transactionHash,
          coverImage: currentBook.coverImage,
          events: {
            debug: debugEvent ? {
              deposit: ethers.utils.formatEther(debugEvent.args.deposit),
              totalRent: ethers.utils.formatEther(debugEvent.args.totalRent),
              rentalDuration: debugEvent.args.rentalDuration.toString(),
              additionalMinutes: debugEvent.args.additionalMinutes.toString()
            } : null,
            refund: refundEvent ? {
              to: refundEvent.args.to,
              amount: ethers.utils.formatEther(refundEvent.args.amount)
            } : null,
            returned: returnedEvent ? {
              bookId: returnedEvent.args.bookId.toString(),
              renter: returnedEvent.args.renter,
              refundAmount: ethers.utils.formatEther(returnedEvent.args.refundAmount)
            } : null
          }
        };

        // Get existing returned books
        let storedBooks = [];
        try {
          const existingData = localStorage.getItem('returnedBooks');
          if (existingData) {
            storedBooks = JSON.parse(existingData);
          }
        } catch (e) {
          console.error('Error parsing stored books:', e);
        }

        // Add new returned book
        storedBooks.push(returnedBook);
        localStorage.setItem('returnedBooks', JSON.stringify(storedBooks));

        // Update state
        setReturnedBooks(prev => [...prev, returnedBook]);

        showNotification('success', formatSuccessMessage('return'));
      } else {
        // Case 2: Rental amount is LESS than deposit
        showNotification('info', 'Returning book... Please confirm the transaction in MetaMask');
  
        const tx = await contract.returnItem(bookId, {
          value: 0, // No extra payment needed
          gasLimit: ethers.utils.hexlify(300000)
        });
  
        showNotification('info', 'Transaction submitted! Waiting for confirmation...');
        const receipt = await tx.wait();
        
        // Process events to get actual refund amount
        const refundEvent = receipt.events.find(e => e.event === "RefundSent");
        const returnedEvent = receipt.events.find(e => e.event === "ItemReturned");
        const debugEvent = receipt.events.find(e => e.event === "DebugRefund");

        let actualRefundAmount = "0";
        if (refundEvent) {
          actualRefundAmount = ethers.utils.formatEther(refundEvent.args.amount);
        }

        // Add to returned books history with actual refund amount
        const returnedBook = {
          ...currentBook,
          isReturned: true,
          returnTime: new Date(),
          refundAmount: actualRefundAmount,
          extraPayment: "0",
          transactionHash: receipt.transactionHash,
          coverImage: currentBook.coverImage,
          events: {
            debug: debugEvent ? {
              deposit: ethers.utils.formatEther(debugEvent.args.deposit),
              totalRent: ethers.utils.formatEther(debugEvent.args.totalRent),
              rentalDuration: debugEvent.args.rentalDuration.toString(),
              additionalMinutes: debugEvent.args.additionalMinutes.toString()
            } : null,
            refund: refundEvent ? {
              to: refundEvent.args.to,
              amount: ethers.utils.formatEther(refundEvent.args.amount)
            } : null,
            returned: returnedEvent ? {
              bookId: returnedEvent.args.bookId.toString(),
              renter: returnedEvent.args.renter,
              refundAmount: ethers.utils.formatEther(returnedEvent.args.refundAmount)
            } : null
          }
        };

        // Get existing returned books
        let storedBooks = [];
        try {
          const existingData = localStorage.getItem('returnedBooks');
          if (existingData) {
            storedBooks = JSON.parse(existingData);
          }
        } catch (e) {
          console.error('Error parsing stored books:', e);
        }

        // Add new returned book
        storedBooks.push(returnedBook);
        localStorage.setItem('returnedBooks', JSON.stringify(storedBooks));

        // Update state
        setReturnedBooks(prev => [...prev, returnedBook]);

        showNotification('success', formatSuccessMessage('return'));
      }
      
      loadRentedBooks();
      loadReturnedBooks();
    } catch (err) {
      console.error('Error returning book:', err);
      handleError(err);
    } finally {
      setReturningBookId(null);
    }
  };

  const renderTransactionDetails = (book) => {
    return (
      <div className="transaction-details mt-4 p-3 bg-light rounded">
        <h6 className="mb-3"><i className="bi bi-info-circle me-2"></i>Rental Details</h6>
        <div className="mb-2">
          <strong>Duration:</strong> {book.rentalDuration} minutes
        </div>
        <div className="mb-2">
          <strong>Total Rent:</strong> {book.totalRent} ETH
          {parseFloat(book.totalRent) > parseFloat(book.deposit) && (
            <Badge bg="danger" className="ms-2">Exceeds Deposit</Badge>
          )}
        </div>
        {!book.isReturned && parseFloat(book.totalRent) > parseFloat(book.deposit) && (
          <div className="mb-2 text-danger">
            <strong>Extra Payment Needed:</strong> {(parseFloat(book.totalRent) - parseFloat(book.deposit)).toFixed(6)} ETH
          </div>
        )}
        {!book.isReturned && parseFloat(book.totalRent) <= parseFloat(book.deposit) && (
          <div className="mb-2">
            <strong>Estimated Refund:</strong> {book.estimatedRefund} ETH
          </div>
        )}
        {book.isReturned && (
          <>
            <div className="mb-2">
              <strong>Returned on:</strong> {book.returnTime.toLocaleDateString()}
            </div>
            {book.extraPayment && parseFloat(book.extraPayment) > 0 && (
              <div className="mb-2 text-danger">
                <strong>Extra Payment Made:</strong> {book.extraPayment} ETH
              </div>
            )}
            {parseFloat(book.refundAmount) > 0 && (
              <div className="mb-2 text-success">
                <strong>Refund Amount:</strong> {book.refundAmount} ETH
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  const renderBookCard = (book, isReturned = false) => (
    <Card className="h-100 book-card shadow-sm animate__animated animate__fadeIn mb-4">
      <Card.Header className={`${isReturned ? 'bg-success' : 'bg-warning'} text-white`}>
        <h5 className="mb-0">
          <i className={`bi ${isReturned ? 'bi-check-circle' : 'bi-hourglass-split'} me-2`}></i>
          {isReturned ? 'Returned' : 'Currently Rented'}: {book.title}
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
              console.error("Failed to load rental image:", book.coverImage);
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

        {renderTransactionDetails(book)}
        
        {!isReturned && (
          <Button
            variant="primary"
            className="w-100 mt-3"
            onClick={() => handleReturn(book.id)}
            disabled={returningBookId === book.id}
          >
            {returningBookId === book.id ? (
              <>
                <Spinner
                  as="span"
                  animation="border"
                  size="sm"
                  role="status"
                  aria-hidden="true"
                  className="me-2"
                />
                Returning...
              </>
            ) : (
              <>
                <i className="bi bi-arrow-left-circle me-2"></i>
                Return Book
              </>
            )}
          </Button>
        )}
      </Card.Body>
      <Card.Footer className="text-muted">
        <small>
          <i className="bi bi-calendar-check me-1"></i>
          Rented on: {book.rentalStartTime.toLocaleString()}
        </small>
      </Card.Footer>
    </Card>
  );

  const renderBooks = () => {
    if (rentedBooks.length === 0 && returnedBooks.length === 0) {
      return (
        <div className="empty-state animate__animated animate__fadeIn">
          <i className="bi bi-book text-muted"></i>
          <h3>No Rented Books</h3>
          <p>You haven't rented any books yet. Check out the marketplace!</p>
        </div>
      );
    }

    return (
      <>
        {rentedBooks.length > 0 && (
          <div className="mb-5">
            <h3 className="mb-4"><i className="bi bi-hourglass-split me-2"></i>Currently Rented</h3>
            <Row>
              {rentedBooks.map(book => (
                <Col key={book.id} md={6} lg={4}>
                  {renderBookCard(book, false)}
                </Col>
              ))}
            </Row>
          </div>
        )}

        {returnedBooks.length > 0 && (
          <div>
            <h3 className="mb-4"><i className="bi bi-check-circle me-2"></i>Returned Books</h3>
            <Row>
              {returnedBooks.map(book => (
                <Col key={book.id} md={6} lg={4}>
                  {renderBookCard(book, true)}
                </Col>
              ))}
            </Row>
          </div>
        )}
      </>
    );
  };

  if (!account) {
    return (
      <div className="empty-state animate__animated animate__fadeIn">
        <i className="bi bi-wallet2"></i>
        <h3>Connect Your Wallet</h3>
        <p>Please connect your wallet to view your rentals.</p>
      </div>
    );
  }

  if (!contractAddress) {
    return (
      <div className="empty-state animate__animated animate__fadeIn">
        <i className="bi bi-exclamation-triangle text-warning"></i>
        <h3>Contract Not Deployed</h3>
        <p>Please make sure you are connected to the correct network.</p>
      </div>
    );
  }

  return (
    <Container>
      <h2 className="mb-4">My Rentals</h2>
      
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
          <p className="mt-3">Loading your rented books...</p>
        </div>
      ) : (
        renderBooks()
      )}
    </Container>
  );
}

export default MyRentals; 