import React, { useState, useEffect } from 'react';
import { Toast, ToastContainer } from 'react-bootstrap';
import 'animate.css';

const Notification = ({ show, type, message, onClose, duration = 3000 }) => {
  const [visible, setVisible] = useState(show);
  
  useEffect(() => {
    setVisible(show);
    
    // Auto-dismiss after specified duration
    if (show) {
      const timer = setTimeout(() => {
        setVisible(false);
        if (onClose) onClose();
      }, duration);
      
      return () => clearTimeout(timer);
    }
  }, [show, onClose, duration]);
  
  // Determine icon based on type
  const getIcon = () => {
    switch (type) {
      case 'success':
        return 'bi-check-circle-fill';
      case 'danger':
        return 'bi-exclamation-triangle-fill';
      case 'warning':
        return 'bi-exclamation-circle-fill';
      case 'info':
        return 'bi-info-circle-fill';
      default:
        return 'bi-bell-fill';
    }
  };
  
  // Get animation class
  const getAnimationClass = () => {
    switch (type) {
      case 'success':
        return 'animate__bounceIn';
      case 'danger':
        return 'animate__shakeX';
      default:
        return 'animate__fadeIn';
    }
  };
  
  return (
    <ToastContainer 
      position="top-end" 
      className="p-3" 
      style={{ 
        zIndex: 1050, 
        position: 'fixed', 
        top: 20, 
        right: 20 
      }}
    >
      <Toast 
        show={visible} 
        onClose={() => {
          setVisible(false);
          if (onClose) onClose();
        }}
        bg={type}
        className={`animate__animated ${getAnimationClass()}`}
      >
        <Toast.Header closeButton>
          <i className={`bi ${getIcon()} me-2`}></i>
          <strong className="me-auto">
            {type === 'success' ? 'Success' : 
             type === 'danger' ? 'Error' : 
             type === 'warning' ? 'Warning' : 'Information'}
          </strong>
        </Toast.Header>
        <Toast.Body className={type === 'danger' || type === 'success' ? 'text-white' : ''}>
          {message}
        </Toast.Body>
      </Toast>
    </ToastContainer>
  );
};

export default Notification; 