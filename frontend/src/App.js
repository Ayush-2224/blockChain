import React from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { Container, Navbar, Nav } from 'react-bootstrap';
import { Web3ReactProvider } from '@web3-react/core';
import { Web3Provider } from '@ethersproject/providers';
import Marketplace from './components/Marketplace';
import ListBook from './components/ListBook';
import MyRentals from './components/MyRentals';
import ConnectWallet from './components/ConnectWallet';
import { NotificationProvider } from './utils/notificationContext';
import Notification from './components/Notification';
import './styles/global.css';

function getLibrary(provider) {
  const library = new Web3Provider(provider);
  library.pollingInterval = 12000;
  return library;
}

function App() {
  return (
    <NotificationProvider>
      <Web3ReactProvider getLibrary={getLibrary}>
        <Router>
          <div className="app-wrapper fade-in">
            <Navbar expand="lg" className="mb-4 animate__animated animate__fadeIn">
              <Container>
                <Navbar.Brand as={NavLink} to="/" className="d-flex align-items-center">
                  <i className="bi bi-book me-2"></i>
                  Book Rental DApp
                </Navbar.Brand>
                <Navbar.Toggle aria-controls="basic-navbar-nav" />
                <Navbar.Collapse id="basic-navbar-nav">
                  <Nav className="me-auto">
                    <Nav.Link as={NavLink} to="/" end className="nav-link">
                      <i className="bi bi-shop me-1"></i> Marketplace
                    </Nav.Link>
                    <Nav.Link as={NavLink} to="/list-book" className="nav-link">
                      <i className="bi bi-plus-circle me-1"></i> List Book
                    </Nav.Link>
                    <Nav.Link as={NavLink} to="/my-rentals" className="nav-link">
                      <i className="bi bi-collection me-1"></i> My Rentals
                    </Nav.Link>
                  </Nav>
                  <ConnectWallet />
                </Navbar.Collapse>
              </Container>
            </Navbar>

            <Container className="main-content">
              <Routes>
                <Route path="/" element={<Marketplace />} />
                <Route path="/list-book" element={<ListBook />} />
                <Route path="/my-rentals" element={<MyRentals />} />
              </Routes>
            </Container>

            <footer className="footer mt-5 py-3 animate__animated animate__fadeIn">
              <Container className="text-center">
                <p className="text-muted mb-0">
                  <i className="bi bi-code-slash me-2"></i>
                  Built with Ethereum Smart Contracts
                </p>
              </Container>
            </footer>
          </div>
        </Router>
      </Web3ReactProvider>
    </NotificationProvider>
  );
}

export default App; 