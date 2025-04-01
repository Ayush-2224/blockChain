import BookRental from './contracts/BookRental.json';

const getContractAddress = () => {
  try {
    // Get the network ID from the contract deployment
    const networks = Object.keys(BookRental.networks);
    
    if (networks.length === 0) {
      console.error('No networks found in contract artifact');
      return null;
    }
    
    // Use the first available network
    const networkId = networks[0];
    const networkData = BookRental.networks[networkId];
    
    if (!networkData) {
      console.error('No network data found for network ID:', networkId);
      return null;
    }
    
    return networkData.address;
  } catch (error) {
    console.error('Error getting contract address:', error);
    return null;
  }
};

export const contractAddress = getContractAddress();
export const contractABI = BookRental.abi;

// Log the contract configuration for debugging
console.log('Contract Configuration:', {
  address: contractAddress,
  networks: BookRental.networks,
}); 