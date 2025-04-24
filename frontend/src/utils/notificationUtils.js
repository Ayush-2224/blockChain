// Error categorization functions
export const categorizeError = (error) => {
  // Extract error message
  let errorMessage = '';
  
  if (typeof error === 'string') {
    errorMessage = error;
  } else if (error.message) {
    errorMessage = error.message;
  } else {
    errorMessage = 'An unknown error occurred';
  }
  
  // Categorize common blockchain errors
  if (errorMessage.includes('User denied transaction')) {
    return {
      type: 'warning',
      message: 'Transaction was rejected in your wallet'
    };
  } else if (errorMessage.includes('insufficient funds')) {
    return {
      type: 'danger',
      message: 'Insufficient funds to complete this transaction'
    };
  } else if (errorMessage.includes('execution reverted')) {
    // Extract revert reason if available
    const revertReason = errorMessage.match(/reason: (.*?)(?:,|$)/);
    return {
      type: 'danger',
      message: revertReason ? `Contract error: ${revertReason[1]}` : 'Contract execution failed'
    };
  } else if (errorMessage.includes('network changed') || errorMessage.includes('network mismatch')) {
    return {
      type: 'warning',
      message: 'Network connection changed. Please check your wallet connection'
    };
  } else if (errorMessage.includes('already processing eth_requestAccounts')) {
    return {
      type: 'info',
      message: 'Wallet connection already in progress. Check your wallet'
    };
  } else if (errorMessage.includes('not available')) {
    return {
      type: 'warning',
      message: 'This item is no longer available'
    };
  } else if (errorMessage.includes('upload failed') || errorMessage.includes('Failed to upload image')) {
    return {
      type: 'danger',
      message: 'Image upload failed. Please try a different image or try again later'
    };
  } else if (errorMessage.includes('Invalid book ID')) {
    return {
      type: 'danger',
      message: 'This book does not exist'
    };
  } else if (errorMessage.includes('Cannot rent your own book')) {
    return {
      type: 'warning',
      message: 'You cannot rent your own book'
    };
  } else if (errorMessage.includes('Title cannot be empty') || 
             errorMessage.includes('Author cannot be empty')) {
    return {
      type: 'warning',
      message: 'Please fill in all required fields'
    };
  } else {
    // Default error handling
    return {
      type: 'danger',
      message: `Error: ${errorMessage}`
    };
  }
};

// Format successful operation messages
export const formatSuccessMessage = (operation) => {
  switch (operation) {
    case 'list':
      return 'Book listed successfully!';
    case 'rent':
      return 'Book rented successfully! You can view it in My Rentals.';
    case 'return':
      return 'Book returned successfully!';
    case 'upload':
      return 'Image uploaded successfully!';
    default:
      return 'Operation completed successfully!';
  }
}; 