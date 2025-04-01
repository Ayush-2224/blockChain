module.exports = {
  networks: {
    development: {
      host: "127.0.0.1",
      port: 8545,
      network_id: 1337,   // Match Ganache's network ID
      gas: 6721975,           // Gas limit used for deploys
      gasPrice: 20000000000   // 20 gwei
    }
  },
  compilers: {
    solc: {
      version: "0.8.19",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        }
      }
    }
  }
}; 