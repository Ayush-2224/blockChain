// Pinata IPFS API Configuration
const PINATA_API_KEY = ' 5690b6f2fb7c1876550e';
const PINATA_API_SECRET = 'd7b6a6d805f57e1e76c1b7455e2ec42de04dbb0ee6299e84092190e3a7c110f2';
const PINATA_JWT='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiJiNTgyYzhmZS0zZmMzLTRiYzAtYWMzZS0wYzI5OGZlYTgyNDkiLCJlbWFpbCI6ImF5dXNoa3VtYXIuNDU5NC5icndkQGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJwaW5fcG9saWN5Ijp7InJlZ2lvbnMiOlt7ImRlc2lyZWRSZXBsaWNhdGlvbkNvdW50IjoxLCJpZCI6IkZSQTEifSx7ImRlc2lyZWRSZXBsaWNhdGlvbkNvdW50IjoxLCJpZCI6Ik5ZQzEifV0sInZlcnNpb24iOjF9LCJtZmFfZW5hYmxlZCI6ZmFsc2UsInN0YXR1cyI6IkFDVElWRSJ9LCJhdXRoZW50aWNhdGlvblR5cGUiOiJzY29wZWRLZXkiLCJzY29wZWRLZXlLZXkiOiI1NjkwYjZmMmZiN2MxODc2NTUwZSIsInNjb3BlZEtleVNlY3JldCI6ImQ3YjZhNmQ4MDVmNTdlMWU3NmMxYjc0NTVlMmVjNDJkZTA0ZGJiMGVlNjI5OWU4NDA5MjE5MGUzYTdjMTEwZjIiLCJleHAiOjE3NzY5Mjc5MTJ9.W_7xGAYBYYUZ2PROygqAlGlrjhTayirIrFYqak5IR08'

// Set to false to use real Pinata service
const USE_MOCK_UPLOAD = false;

/**
 * Test Pinata credentials (API key/secret or JWT)
 * @param {Object} headers - Headers object for authentication
 * @returns {Promise<boolean>} - Promise resolving to true if authentication successful
 */
const testPinataAuth = async (headers) => {
  try {
    const resp = await fetch('https://api.pinata.cloud/data/testAuthentication', {
      method: 'GET',
      headers
    });
    
    if (!resp.ok) {
      const body = await resp.text();
      console.error(`Pinata authentication failed: ${resp.status} ${resp.statusText} - ${body}`);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error testing Pinata authentication:', error);
    return false;
  }
};

/**
 * Uploads an image file to IPFS via Pinata
 * @param {File} file - The file to upload
 * @returns {Promise<string>} - Promise resolving to the IPFS URL of the uploaded image
 */
export const uploadImageToPinata = async (file) => {
  if (!file) {
    throw new Error('No file provided for upload');
  }

  // Prepare form data for upload
  const formData = new FormData();
  
  // Append the file to the form data
  formData.append('file', file);
  
  // Add metadata
  const metadata = JSON.stringify({
    name: `${file.name}`,
    keyvalues: {
      description: 'Book cover image',
      timestamp: Date.now().toString()
    }
  });
  formData.append('pinataMetadata', metadata);
  
  // Add options (including setting the content as public)
  const options = JSON.stringify({
    cidVersion: 0
  });
  formData.append('pinataOptions', options);

  // Check if JWT is available first
  let authHeaders = {};
  let authMethod = '';
  
  if (PINATA_JWT && PINATA_JWT.trim() !== '') {
    authHeaders = { Authorization: `Bearer ${PINATA_JWT}` };
    authMethod = 'JWT';
  } else if (PINATA_API_KEY && PINATA_API_SECRET) {
    authHeaders = {
      'pinata_api_key': PINATA_API_KEY.trim(),
      'pinata_secret_api_key': PINATA_API_SECRET
    };
    authMethod = 'API Key';
  } else {
    throw new Error('No Pinata authentication credentials provided');
  }

  console.log(`Authenticating with Pinata using ${authMethod}...`);
  
  // Test authentication first
  const isAuthenticated = await testPinataAuth(authHeaders);
  if (!isAuthenticated) {
    throw new Error(`Pinata authentication failed using ${authMethod}. Please check your credentials.`);
  }
  
  console.log('Pinata authentication successful, uploading file...');
  
  try {
    // Make API call to Pinata
    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: authHeaders,
      body: formData
    });
    
    // Check if the call was successful
    if (!response.ok) {
      const errorText = await response.text();
      let errorInfo;
      
      try {
        errorInfo = JSON.parse(errorText);
      } catch (e) {
        errorInfo = { error: errorText };
      }
      
      console.error('Pinata API error details:', {
        status: response.status,
        statusText: response.statusText,
        errorInfo
      });
      
      throw new Error(`Failed to upload to IPFS: Status ${response.status} - ${response.statusText}. ${errorInfo.error || errorInfo.message || ''}`);
    }
    
    // Get the response data
    const responseData = await response.json();
    console.log('Pinata upload successful:', responseData);
    
    // Return the IPFS URL for the uploaded file
    // Format: ipfs://{CID}
    return `ipfs://${responseData.IpfsHash}`;
    
  } catch (error) {
    console.error('Error uploading to Pinata:', error);
    throw new Error('Failed to upload image to IPFS: ' + (error.message || 'Unknown error'));
  }
};

/**
 * Convert ipfs:// URLs to HTTP gateway URLs
 * @param {string} ipfsUrl - IPFS URL to resolve
 * @returns {string} - HTTP URL for the IPFS content
 */
export const resolveIPFSUrl = (ipfsUrl) => {
  if (!ipfsUrl) return '';
  
  // Check if the URL is already in HTTP format
  if (ipfsUrl.startsWith('http')) {
    return ipfsUrl;
  }
  
  // Convert IPFS URL to HTTP gateway URL
  // Format: ipfs://{CID} -> https://gateway.pinata.cloud/ipfs/{CID}
  const ipfsGateway = 'https://gateway.pinata.cloud/ipfs/';
  const cid = ipfsUrl.replace('ipfs://', '');
  
  return `${ipfsGateway}${cid}`;
};
