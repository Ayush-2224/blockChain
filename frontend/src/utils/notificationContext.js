import React, { createContext, useState, useContext } from 'react';
import Notification from '../components/Notification';

// Create the notification context
const NotificationContext = createContext();

// Provider component
export const NotificationProvider = ({ children }) => {
  const [notification, setNotification] = useState({
    show: false,
    type: '',
    message: '',
  });

  // Show notification with auto-dismiss
  const showNotification = (type, message, duration = 3000) => {
    setNotification({
      show: true,
      type,
      message,
      duration,
    });
  };

  // Clear notification
  const clearNotification = () => {
    setNotification(prev => ({
      ...prev,
      show: false
    }));
  };

  return (
    <NotificationContext.Provider
      value={{
        showNotification,
        clearNotification
      }}
    >
      {children}
      <Notification
        show={notification.show}
        type={notification.type}
        message={notification.message}
        duration={notification.duration}
        onClose={clearNotification}
      />
    </NotificationContext.Provider>
  );
};

// Custom hook to use notification context
export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

// Helper to show notification with categorized errors
export const useNotificationWithErrorHandling = () => {
  const { showNotification } = useNotification();
  
  const handleError = (error) => {
    // Import categorization function
    const { categorizeError } = require('./notificationUtils');
    const { type, message } = categorizeError(error);
    showNotification(type, message);
  };

  const showSuccessNotification = (operation) => {
    // Import success message formatter
    const { formatSuccessMessage } = require('./notificationUtils');
    showNotification('success', formatSuccessMessage(operation));
  };

  return {
    showNotification,
    handleError,
    showSuccessNotification
  };
}; 