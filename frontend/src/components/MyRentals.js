import React, { useState, useEffect, useCallback } from 'react';
import { useWeb3React } from '@web3-react/core';
import { Card, Button, Alert, Row, Col, Spinner, Container, Badge } from 'react-bootstrap';
import { ethers } from 'ethers';
import { contractAddress, contractABI } from '../utils/contractConfig';

function MyRentals() {
  const { account, library, chainId } = useWeb3React();
  const [rentedBooks, setRentedBooks] = useState([]);
  const [returnedBooks, setReturnedBooks] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [returningBookId, setReturningBookId] = useState(null);

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
      setError('Error loading rented books: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [library, chainId, account]);

  useEffect(() => {
    loadRentedBooks();
    // Refresh rentals every 30 seconds
    const interval = setInterval(loadRentedBooks, 30000);
    return () => clearInterval(interval);
  }, [loadRentedBooks]);

  const handleReturn = async (bookId) => {
    if (!library || !contractAddress) return;

    setReturningBookId(bookId);
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

      // First check if the book is still rented by the user
      const book = await contract.getBook(bookId);
      if (book.isAvailable) {
        setError('This book is no longer rented.');
        loadRentedBooks();
        return;
      }

      if (book.renter.toLowerCase() !== account.toLowerCase()) {
        setError('You are not the renter of this book.');
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
          setError(
            `Insufficient funds for extra payment and gas. ` +
            `You need an additional ${shortfall} ETH.\n` +
            `Required breakdown:\n` +
            `- Extra payment: ${formattedExtraPayment} ETH\n` +
            `- Estimated gas: ${ethers.utils.formatEther(gasCost)} ETH`
          );
          return;
        }

        setSuccess(
          `Additional payment required:\n` +
          `- Rental duration: ${rentalDuration} minutes\n` +
          `- Price per minute: ${formattedPricePerMinute} ETH\n` +
          `- Total rent: ${formattedTotalRent} ETH\n` +
          `- Deposit paid: ${formattedDeposit} ETH\n` +
          `- Extra payment needed: ${formattedExtraPayment} ETH\n` +
          `- Estimated gas: ${ethers.utils.formatEther(gasCost)} ETH\n\n` +
          `Please confirm the transaction in MetaMask...`
        );

        // Listen for events
        contract.once("DebugRefund", (deposit, totalRent, refundAmount) => {
          console.log("Debug Refund Event:", {
            deposit: ethers.utils.formatEther(deposit),
            totalRent: ethers.utils.formatEther(totalRent),
            refundAmount: ethers.utils.formatEther(refundAmount)
          });
        });

        contract.once("RefundSent", (to, amount) => {
          console.log("Refund Sent Event:", {
            to,
            amount: ethers.utils.formatEther(amount)
          });
          // Update UI to show refund is processed
          setSuccess(prev => prev + `\nRefund of ${ethers.utils.formatEther(amount)} ETH sent to ${to}`);
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

        setSuccess(prev => prev + '\nTransaction submitted! Waiting for confirmation...');
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
        setReturnedBooks(prev => [...prev, {
          ...currentBook,
          returnTime: new Date(),
          refundAmount: actualRefundAmount,
          extraPayment: formattedExtraPayment,
          transactionHash: receipt.transactionHash,
          events: {
            debug: debugEvent ? {
              deposit: ethers.utils.formatEther(debugEvent.args.deposit),
              totalRent: ethers.utils.formatEther(debugEvent.args.totalRent),
              refundAmount: ethers.utils.formatEther(debugEvent.args.refundAmount)
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
        }]);

        setSuccess(
          `Book returned successfully!\n` +
          `Additional payment of ${formattedExtraPayment} ETH was required and paid.\n` +
          `Transaction Hash: ${receipt.transactionHash}`
        );
      } else {
        // Case 2: Rental amount is LESS than or equal to deposit
        const refundAmount = depositBN.sub(totalRentBN);
        const formattedRefund = ethers.utils.formatEther(refundAmount);
        
        setSuccess('Please confirm the transaction in MetaMask to return the book and receive your refund...');

        // Listen for events
        contract.once("DebugRefund", (deposit, totalRent, refundAmount) => {
          console.log("Debug Refund Event:", {
            deposit: ethers.utils.formatEther(deposit),
            totalRent: ethers.utils.formatEther(totalRent),
            refundAmount: ethers.utils.formatEther(refundAmount)
          });
        });

        contract.once("RefundSent", (to, amount) => {
          console.log("Refund Sent Event:", {
            to,
            amount: ethers.utils.formatEther(amount)
          });
          // Update UI to show refund is processed
          setSuccess(prev => prev + `\nRefund of ${ethers.utils.formatEther(amount)} ETH sent to ${to}`);
        });

        contract.once("PaymentSent", (to, amount) => {
          console.log("Payment Sent Event:", {
            to,
            amount: ethers.utils.formatEther(amount)
          });
        });

        // Send transaction without extra payment
        const tx = await contract.returnItem(bookId, {
          gasLimit: ethers.utils.hexlify(300000)
        });

        setSuccess(prev => prev + '\nTransaction submitted! Waiting for confirmation...');
        const receipt = await tx.wait();

        // Log all events from the receipt
        console.log("Transaction Receipt Events:", receipt.events);

        // Process events to get actual refund amount
        const refundEvent = receipt.events.find(e => e.event === "RefundSent");
        const returnedEvent = receipt.events.find(e => e.event === "ItemReturned");
        const debugEvent = receipt.events.find(e => e.event === "DebugRefund");

        let actualRefundAmount = formattedRefund;
        if (refundEvent) {
          actualRefundAmount = ethers.utils.formatEther(refundEvent.args.amount);
        }

        // Add to returned books history with actual refund amount
        setReturnedBooks(prev => [...prev, {
          ...currentBook,
          returnTime: new Date(),
          refundAmount: actualRefundAmount,
          extraPayment: "0",
          transactionHash: receipt.transactionHash,
          events: {
            debug: debugEvent ? {
              deposit: ethers.utils.formatEther(debugEvent.args.deposit),
              totalRent: ethers.utils.formatEther(debugEvent.args.totalRent),
              refundAmount: ethers.utils.formatEther(debugEvent.args.refundAmount)
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
        }]);

        setSuccess(
          `Book returned successfully!\n` +
          `You will receive a refund of ${actualRefundAmount} ETH.\n` +
          `Transaction Hash: ${receipt.transactionHash}`
        );
      }
      
      loadRentedBooks();
    } catch (err) {
      console.error('Error returning book:', err);
      if (err.code === 4001) {
        setError('Transaction was rejected. Please try again.');
      } else if (err.message.includes('not rented')) {
        setError('This book is no longer rented.');
        loadRentedBooks();
      } else if (err.message.includes('not the renter')) {
        setError('You are not the renter of this book.');
      } else if (err.message.includes('insufficient funds')) {
        setError('Insufficient funds to process the return. Please check your balance.');
      } else if (err.message.includes('Additional payment required')) {
        try {
          // Try to parse the detailed error message
          const durationMatch = err.message.match(/duration: (\d+) minutes/);
          const priceMatch = err.message.match(/(\d+) wei per minute/);
          const totalRentMatch = err.message.match(/total rent of (\d+) wei/);
          
          if (durationMatch && priceMatch && totalRentMatch) {
            const duration = durationMatch[1];
            const pricePerMinute = ethers.utils.formatEther(priceMatch[1]);
            const totalRent = ethers.utils.formatEther(totalRentMatch[1]);
            
            setError(
              `Additional payment required. Rental details:\n` +
              `- Duration: ${duration} minutes\n` +
              `- Price per minute: ${pricePerMinute} ETH\n` +
              `- Total rent: ${totalRent} ETH\n` +
              `Please try again with the correct payment amount.`
            );
          } else {
            setError('Additional payment required. Please try again with the correct amount.');
          }
        } catch (parseErr) {
          setError('Additional payment required. Please try again.');
        }
      } else {
        setError('Error returning book: ' + err.message);
      }
    } finally {
      setReturningBookId(null);
    }
  };

  const renderTransactionDetails = (book) => {
    if (!book.transactionHash) return null;
    
    return (
      <div className="mt-3 border-top pt-3">
        <h6>Transaction Details</h6>
        <div className="mb-2">
          <strong>Transaction Hash:</strong>
          <br />
          <a 
            href={`http://localhost:8545/tx/${book.transactionHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-break"
          >
            {book.transactionHash}
          </a>
        </div>
        
        {/* Show Debug Event Info */}
        {book.events?.debug && (
          <div className="mb-2">
            <strong>Debug Info:</strong>
            <ul className="list-unstyled mb-0 ps-3">
              <li>Deposit: {book.events.debug.deposit} ETH</li>
              <li>Total Rent: {book.events.debug.totalRent} ETH</li>
              <li>Calculated Refund: {book.events.debug.refundAmount} ETH</li>
            </ul>
          </div>
        )}

        {/* Show Refund Event Info */}
        {book.events?.refund && (
          <div className="mb-2">
            <strong>Refund Details:</strong>
            <ul className="list-unstyled mb-0 ps-3">
              <li>Amount: {book.events.refund.amount} ETH</li>
              <li>Sent to: {book.events.refund.to}</li>
            </ul>
          </div>
        )}

        {/* Show Return Event Info */}
        {book.events?.returned && (
          <div className="mb-2">
            <strong>Return Details:</strong>
            <ul className="list-unstyled mb-0 ps-3">
              <li>Book ID: {book.events.returned.bookId}</li>
              <li>Renter: {book.events.returned.renter}</li>
              <li>Final Refund: {book.events.returned.refundAmount} ETH</li>
            </ul>
          </div>
        )}

        {book.refundAmount !== '0' && (
          <div className="alert alert-info">
            <i className="bi bi-info-circle me-2"></i>
            If the refund ({book.refundAmount} ETH) is not visible in MetaMask:
            <ol className="mb-0 mt-2">
              <li>Open MetaMask</li>
              <li>Click on "Activity"</li>
              <li>Look for "Receive" transaction</li>
              <li>Check your balance - it should have increased by {book.refundAmount} ETH</li>
              <li>If you don't see the transaction, try refreshing MetaMask</li>
            </ol>
          </div>
        )}
      </div>
    );
  };

  const renderBookCard = (book, isReturned = false) => (
    <Col key={book.id} md={4} className="mb-4">
      <Card className="h-100 shadow-sm">
        <Card.Body>
          <Card.Title className="d-flex justify-content-between align-items-center">
            {book.title}
            <Badge bg={isReturned ? "secondary" : "warning"}>
              {isReturned ? "Returned" : "Rented"}
            </Badge>
          </Card.Title>
          <Card.Text>
            <div className="mb-2">
              <strong>Price per Minute:</strong> {book.dailyPrice} ETH
            </div>
            <div className="mb-2">
              <strong>Deposit:</strong> {book.deposit} ETH
            </div>
            <div className="mb-2">
              <strong>Rented on:</strong> {book.rentalStartTime.toLocaleDateString()}
            </div>
            <div className="mb-2">
              <strong>Duration:</strong> {book.rentalDuration} minutes
            </div>
            <div className="mb-2">
              <strong>Total Rent:</strong> {book.totalRent} ETH
              {parseFloat(book.totalRent) > parseFloat(book.deposit) && (
                <Badge bg="danger" className="ms-2">Exceeds Deposit</Badge>
              )}
            </div>
            {!isReturned && parseFloat(book.totalRent) > parseFloat(book.deposit) && (
              <div className="mb-2 text-danger">
                <strong>Extra Payment Needed:</strong> {(parseFloat(book.totalRent) - parseFloat(book.deposit)).toFixed(6)} ETH
              </div>
            )}
            {!isReturned && parseFloat(book.totalRent) <= parseFloat(book.deposit) && (
              <div className="mb-2">
                <strong>Estimated Refund:</strong> {book.estimatedRefund} ETH
              </div>
            )}
            {isReturned && (
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
                {renderTransactionDetails(book)}
              </>
            )}
          </Card.Text>
          {!isReturned && (
            <Button
              variant="primary"
              onClick={() => handleReturn(book.id)}
              disabled={returningBookId === book.id}
              className="w-100"
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
                'Return Book'
              )}
            </Button>
          )}
        </Card.Body>
      </Card>
    </Col>
  );

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
      {error && (
        <Alert variant="danger" className="mb-4 animate__animated animate__shakeX">
          <i className="bi bi-exclamation-triangle me-2"></i>
          {error}
        </Alert>
      )}
      {success && (
        <Alert variant="success" className="mb-4 animate__animated animate__bounceIn">
          <i className="bi bi-check-circle me-2"></i>
          {success}
        </Alert>
      )}

      <h2 className="mb-4">Currently Rented Books</h2>
      <Row>
        {rentedBooks.map(book => renderBookCard(book))}
        {rentedBooks.length === 0 && (
          <Col>
            <Card className="shadow-sm">
              <Card.Body className="text-center">
                <Card.Title>No Active Rentals</Card.Title>
                <Card.Text>You don't have any rented books at the moment.</Card.Text>
              </Card.Body>
            </Card>
          </Col>
        )}
      </Row>

      {returnedBooks.length > 0 && (
        <>
          <h2 className="mb-4 mt-5">Rental History</h2>
          <Row>
            {returnedBooks.map(book => renderBookCard(book, true))}
          </Row>
        </>
      )}
    </Container>
  );
}

export default MyRentals; 