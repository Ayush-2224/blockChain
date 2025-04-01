import BookRental from '../contracts/BookRental.json';

const getContractAddress = () => {
  try {
    // Get the network ID from the contract deployment
    const networks = Object.keys(BookRental.networks);
    console.log('Available networks:', networks);
    
    if (networks.length === 0) {
      console.error('No networks found in contract artifact');
      return null;
    }
    
    // Use the first available network
    const networkId = networks[0];
    console.log('Using network ID:', networkId);
    
    const networkData = BookRental.networks[networkId];
    console.log('Network data:', networkData);
    
    if (!networkData) {
      console.error('No network data found for network ID:', networkId);
      return null;
    }
    
    const address = networkData.address;
    
    // Debug information
    console.log('Contract deployment info:', {
      networkId,
      address,
      hasABI: !!BookRental.abi,
      abiMethods: BookRental.abi.map(item => item.name).filter(name => name)
    });
    
    if (!address) {
      console.error('Contract address not found for network', networkId);
      return null;
    }
    
    return address;
  } catch (error) {
    console.error('Error getting contract address:', error);
    return null;
  }
};

const getContract = (library) => {
  try {
    if (!library) {
      console.error('Web3 library not initialized');
      return null;
    }

    const address = getContractAddress();
    if (!address) {
      console.error('Contract address not found');
      return null;
    }

    // Verify we have the ABI
    if (!BookRental.abi) {
      console.error('Contract ABI not found');
      return null;
    }

    // Create contract instance
    const contract = new library.eth.Contract(BookRental.abi, address);
    console.log('Contract instance created:', {
      address,
      methods: Object.keys(contract.methods)
    });

    return contract;
  } catch (error) {
    console.error('Error creating contract instance:', error);
    return null;
  }
};

export const contractAddress = getContractAddress();

// Get the original ABI
const originalABI = BookRental.abi;

// Create a new ABI with the modified returnItem function
export const contractABI = originalABI.map(item => {
  // Keep the original item if it's not the returnItem function
  if (item.name !== 'returnItem' || item.type !== 'function') {
    return item;
  }

  // For the returnItem function, ensure it's properly marked as payable
  return {
    inputs: [
      {
        internalType: "uint256",
        name: "_bookId",
        type: "uint256"
      }
    ],
    name: "returnItem",
    outputs: [],
    stateMutability: "payable",
    type: "function",
    payable: true // Add this for older web3 versions
  };
});

// Log the ABI configuration for debugging
console.log('Contract ABI Configuration:', {
  address: contractAddress,
  returnItemFunction: contractABI.find(item => item.name === 'returnItem'),
  allFunctions: contractABI.filter(item => item.type === 'function').map(f => ({
    name: f.name,
    stateMutability: f.stateMutability,
    payable: f.payable
  }))
});

export const getContractInstance = getContract;

// Debug information
console.log('Exported Contract Config:', {
  address: contractAddress,
  hasABI: !!contractABI,
  abiMethods: contractABI?.map(item => item.name).filter(name => name)
}); 