import React, { useState } from 'react';
import { useWeb3React } from '@web3-react/core';
import { Form, Button, Spinner, Card, Container, Row, Col, Image } from 'react-bootstrap';
import { ethers } from 'ethers';
import { contractAddress, contractABI } from '../utils/contractConfig';
import { uploadImageToPinata, resolveIPFSUrl } from '../utils/pinataConfig';
import Notification from './Notification';
import { categorizeError, formatSuccessMessage } from '../utils/notificationUtils';

function ListBook() {
  const { account, library } = useWeb3React();
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [description, setDescription] = useState('');
  const [coverImage, setCoverImage] = useState(null);
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [coverImagePreview, setCoverImagePreview] = useState('');
  const [dailyPrice, setDailyPrice] = useState('');
  const [deposit, setDeposit] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  
  // Notification states
  const [notification, setNotification] = useState({
    show: false,
    type: '',
    message: ''
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

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

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      handleError(new Error('Image file is too large. Maximum size is 5MB'));
      return;
    }
    
    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      handleError(new Error('Invalid file type. Please upload a JPEG, PNG, GIF or WebP image'));
      return;
    }
    
    setCoverImage(file);
    // Create a preview of the image
    const reader = new FileReader();
    reader.onloadend = () => {
      setCoverImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
    
    // Reset any previous upload URL
    setCoverImageUrl('');
    
    showNotification('info', `Selected image: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);
  };

  const handleImageUpload = async () => {
    if (!coverImage) {
      handleError(new Error('Please select an image first'));
      return;
    }
    
    try {
      setIsUploading(true);
      showNotification('info', 'Uploading to IPFS via Pinata, please wait...');
      
      // Upload image to IPFS using Pinata
      const ipfsUrl = await uploadImageToPinata(coverImage);
      setCoverImageUrl(ipfsUrl);
      
      // Extract the CID from the IPFS URL
      const cid = ipfsUrl.replace('ipfs://', '');
      
      showNotification('success', `Image uploaded to IPFS successfully!`);
      console.log('Uploaded to IPFS with CID:', cid);
      console.log('HTTP Gateway URL:', resolveIPFSUrl(ipfsUrl));
      
      return ipfsUrl;
    } catch (err) {
      console.error('Error uploading image to IPFS:', err);
      handleError(err);
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!library || !contractAddress) {
      handleError('Please connect your wallet and make sure you are on the correct network.');
      return;
    }

    if (!coverImage && !coverImageUrl) {
      handleError('Please upload a cover image first.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Upload image if not already uploaded
      let finalImageUrl = coverImageUrl;
      if (!finalImageUrl) {
        finalImageUrl = await handleImageUpload();
        if (!finalImageUrl) {
          handleError('Failed to upload cover image. Please try again.');
          setIsSubmitting(false);
          return;
        }
      }

      const provider = library;
      const signer = provider.getSigner();
      const contract = new ethers.Contract(
        contractAddress,
        contractABI,
        signer
      );

      const dailyPriceWei = ethers.utils.parseEther(dailyPrice);
      const depositWei = ethers.utils.parseEther(deposit);

      // Use the IPFS URL in the contract
      const tx = await contract.listItem(title, author, description, finalImageUrl, dailyPriceWei, depositWei);
      
      // Show pending notification
      showNotification('info', 'Transaction submitted! Waiting for confirmation...');
      
      await tx.wait();

      // Show success notification
      showNotification('success', formatSuccessMessage('list'));
      
      // Reset form
      setTitle('');
      setAuthor('');
      setDescription('');
      setCoverImage(null);
      setCoverImageUrl('');
      setCoverImagePreview('');
      setDailyPrice('');
      setDeposit('');
    } catch (err) {
      console.error('Error in listItem:', err);
      handleError(err);
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
          {/* Notifications */}
          <Notification
            show={notification.show}
            type={notification.type}
            message={notification.message}
            onClose={() => setNotification(prev => ({ ...prev, show: false }))}
          />
          
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
                    <i className="bi bi-person me-2"></i>
                    Author Name
                  </Form.Label>
                  <Form.Control
                    type="text"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    placeholder="Enter author name"
                    required
                    disabled={isSubmitting}
                    className="form-control-lg"
                  />
                </Form.Group>

                <Form.Group className="mb-4">
                  <Form.Label>
                    <i className="bi bi-card-text me-2"></i>
                    Book Description
                  </Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Enter book description"
                    disabled={isSubmitting}
                    className="form-control-lg"
                  />
                </Form.Group>

                <Form.Group className="mb-4">
                  <Form.Label>
                    <i className="bi bi-image me-2"></i>
                    Cover Image
                  </Form.Label>
                  <div className="d-flex flex-column">
                    {coverImagePreview && !coverImageUrl && (
                      <div className="mb-3 text-center">
                        <Image 
                          src={coverImagePreview} 
                          alt="Book cover preview" 
                          style={{ maxHeight: '200px', maxWidth: '100%' }} 
                          thumbnail 
                          className="mb-2"
                        />
                        <p className="text-muted">Image Preview</p>
                      </div>
                    )}
                    {coverImageUrl && (
                      <div className="mb-3 text-center">
                        <Image 
                          src={resolveIPFSUrl(coverImageUrl)} 
                          alt="Book cover on IPFS" 
                          style={{ maxHeight: '200px', maxWidth: '100%' }} 
                          thumbnail 
                          className="mb-2"
                        />
                        <p className="text-success">
                          <i className="bi bi-lock me-1"></i>
                          Stored on decentralized IPFS network
                        </p>
                      </div>
                    )}
                    <Form.Control
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      disabled={isSubmitting || isUploading}
                      className="form-control-lg"
                    />
                    <div className="d-flex mt-2">
                      <Button 
                        variant="outline-primary" 
                        onClick={handleImageUpload}
                        disabled={!coverImage || isUploading || isSubmitting || coverImageUrl}
                        className="me-2"
                        type="button"
                      >
                        {isUploading ? (
                          <>
                            <Spinner animation="border" size="sm" /> Uploading to IPFS...
                          </>
                        ) : (
                          <>
                            <i className="bi bi-cloud-upload"></i> Upload to IPFS
                          </>
                        )}
                      </Button>
                      {coverImageUrl && (
                        <div className="text-success d-flex align-items-center">
                          <i className="bi bi-check-circle me-1"></i> Uploaded to IPFS
                        </div>
                      )}
                    </div>
                    <Form.Text className="text-muted">
                      <i className="bi bi-info-circle me-1"></i>
                      Select a cover image and upload it to IPFS (decentralized storage)
                    </Form.Text>
                  </div>
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

                <Button 
                  variant="primary" 
                  type="submit"
                  disabled={isSubmitting || isUploading}
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
