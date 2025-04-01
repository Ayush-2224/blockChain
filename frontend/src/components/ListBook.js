import React, { useState } from 'react';
import { useWeb3React } from '@web3-react/core';
import { Form, Button, Alert, Spinner, Card, Container, Row, Col } from 'react-bootstrap';
import { ethers } from 'ethers';
import { contractAddress, contractABI } from '../utils/contractConfig';

function ListBook() {
  const { account, library } = useWeb3React();
  const [title, setTitle] = useState('');
  const [dailyPrice, setDailyPrice] = useState('');
  const [deposit, setDeposit] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!library || !contractAddress) {
      setError('Please connect your wallet and make sure you are on the correct network.');
      return;
    }

    setError('');
    setSuccess('');
    setIsSubmitting(true);

    try {
      const provider = library;
      const signer = provider.getSigner();
      const contract = new ethers.Contract(
        contractAddress,
        contractABI,
        signer
      );

      const dailyPriceWei = ethers.utils.parseEther(dailyPrice);
      const depositWei = ethers.utils.parseEther(deposit);

      const tx = await contract.listItem(title, dailyPriceWei, depositWei);
      await tx.wait();

      setSuccess('Book listed successfully!');
      setTitle('');
      setDailyPrice('');
      setDeposit('');
    } catch (err) {
      console.error('Error in listItem:', err);
      if (err.code === 4001) {
        setError('Transaction was rejected. Please try again.');
      } else if (err.message.includes('insufficient funds')) {
        setError('Insufficient funds to list the book. Please check your balance.');
      } else {
        setError('Error listing book: ' + err.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!account) {
    return (
      <div className="empty-state animate__animated animate__fadeIn">
        <i className="bi bi-wallet2"></i>
        <h3>Connect Your Wallet</h3>
        <p>Please connect your wallet to list a book for rent.</p>
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
      <Row className="justify-content-center">
        <Col md={8}>
          <Card className="book-card shadow-sm animate__animated animate__fadeIn">
            <Card.Header className="bg-primary text-white">
              <h3 className="mb-0">
                <i className="bi bi-book me-2"></i>
                List a Book for Rent
              </h3>
            </Card.Header>
            <Card.Body>
              <Form onSubmit={handleSubmit} className="book-form">
                <Form.Group className="mb-4">
                  <Form.Label>
                    <i className="bi bi-bookmark me-2"></i>
                    Book Title
                  </Form.Label>
                  <Form.Control
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter book title"
                    required
                    disabled={isSubmitting}
                    className="form-control-lg"
                  />
                </Form.Group>

                <Form.Group className="mb-4">
                  <Form.Label>
                    <i className="bi bi-currency-dollar me-2"></i>
                    Price per Minute (ETH)
                  </Form.Label>
                  <Form.Control
                    type="number"
                    step="0.000001"
                    value={dailyPrice}
                    onChange={(e) => setDailyPrice(e.target.value)}
                    placeholder="Enter price per minute"
                    required
                    disabled={isSubmitting}
                    className="form-control-lg"
                  />
                  <Form.Text className="text-muted">
                    <i className="bi bi-info-circle me-1"></i>
                    Recommended: 0.0001 ETH per minute for testing
                  </Form.Text>
                </Form.Group>

                <Form.Group className="mb-4">
                  <Form.Label>
                    <i className="bi bi-shield-lock me-2"></i>
                    Deposit (ETH)
                  </Form.Label>
                  <Form.Control
                    type="number"
                    step="0.000001"
                    value={deposit}
                    onChange={(e) => setDeposit(e.target.value)}
                    placeholder="Enter deposit amount"
                    required
                    disabled={isSubmitting}
                    className="form-control-lg"
                  />
                  <Form.Text className="text-muted">
                    <i className="bi bi-info-circle me-1"></i>
                    Deposit should be greater than or equal to the price per minute
                  </Form.Text>
                </Form.Group>

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

                <Button 
                  variant="primary" 
                  type="submit"
                  disabled={isSubmitting}
                  className="w-100 py-3 animate__animated animate__pulse"
                >
                  {isSubmitting ? (
                    <>
                      <Spinner
                        as="span"
                        animation="border"
                        size="sm"
                        role="status"
                        aria-hidden="true"
                        className="me-2"
                      />
                      Listing Book...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-plus-circle me-2"></i>
                      List Book
                    </>
                  )}
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

export default ListBook; 