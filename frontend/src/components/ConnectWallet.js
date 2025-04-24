import React, { useEffect, useState } from 'react';
import { useWeb3React } from '@web3-react/core';
import { InjectedConnector } from '@web3-react/injected-connector';
import { Button, Spinner } from 'react-bootstrap';
import BookRental from '../contracts/BookRental.json';

// Network configuration
const EXPECTED_NETWORK_ID = 1337; // Ganache network ID

const injected = new InjectedConnector({
  supportedChainIds: [EXPECTED_NETWORK_ID],
});

function ConnectWallet() {
  const { active, account, activate, deactivate, chainId, error: web3Error } = useWeb3React();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);

  // Try to reconnect on component mount
  useEffect(() => {
    const connectWalletOnPageLoad = async () => {
      if (localStorage?.getItem('isWalletConnected') === 'true') {
        try {
          await activate(injected);
        } catch (error) {
          console.error('Error on auto-connect:', error);
          setError('Failed to auto-connect. Please try connecting manually.');
        }
      }
    };
    connectWalletOnPageLoad();
  }, [activate]);

  // Handle network/chain changes
  useEffect(() => {
    if (chainId && chainId !== EXPECTED_NETWORK_ID) {
      setError(`Please switch to the correct network (ID: ${EXPECTED_NETWORK_ID})`);
    } else {
      setError('');
    }
  }, [chainId]);

  // Handle Web3 errors
  useEffect(() => {
    if (web3Error) {
      console.error('Web3 Error:', web3Error);
      if (web3Error.name === 'UnsupportedChainIdError') {
        setError(`Please switch to the correct network (ID: ${EXPECTED_NETWORK_ID})`);
      } else {
        setError(web3Error.message);
      }
    }
  }, [web3Error]);

  useEffect(() => {
    // Clear error when connection status changes
    setError(null);
  }, [active]);

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);

    try {
      await activate(injected);
      localStorage.setItem('isWalletConnected', 'true');
    } catch (err) {
      console.error('Connection error:', err);
      setError('Failed to connect wallet');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
    try {
      deactivate();
      localStorage.setItem('isWalletConnected', 'false');
      setError('');
    } catch (err) {
      console.error('Disconnection error:', err);
    }
  };

  // Check if contract is deployed on the current network
  const isContractDeployed = BookRental.networks[EXPECTED_NETWORK_ID];

  if (error) {
    return (
      <Button 
        variant="danger"
        className="d-flex align-items-center animate__animated animate__shakeX"
        onClick={handleConnect}
      >
        <i className="bi bi-exclamation-triangle me-2"></i>
        {error}
      </Button>
    );
  }

  if (active) {
    return (
      <div className="d-flex align-items-center animate__animated animate__fadeIn">
        <span className="me-3 text-success">
          <i className="bi bi-circle-fill me-2"></i>
          {`${account.slice(0, 6)}...${account.slice(-4)}`}
        </span>
        <Button 
          variant="outline-primary"
          size="sm"
          onClick={handleDisconnect}
          className="d-flex align-items-center"
        >
          <i className="bi bi-box-arrow-right me-2"></i>
          Disconnect
        </Button>
      </div>
    );
  }

  if (!isContractDeployed) {
    return (
      <Button 
        variant="warning" 
        disabled
        className="animate__animated animate__fadeIn"
      >
        <i className="bi bi-exclamation-triangle me-2"></i>
        Contract not deployed on network {EXPECTED_NETWORK_ID}
      </Button>
    );
  }

  return (
    <Button
      variant="primary"
      onClick={handleConnect}
      disabled={connecting}
      className="d-flex align-items-center animate__animated animate__fadeIn"
    >
      {connecting ? (
        <>
          <Spinner
            as="span"
            animation="border"
            size="sm"
            role="status"
            aria-hidden="true"
            className="me-2"
          />
          Connecting...
        </>
      ) : (
        <>
          <i className="bi bi-wallet2 me-2"></i>
          Connect Wallet
        </>
      )}
    </Button>
  );
}

export default ConnectWallet; 