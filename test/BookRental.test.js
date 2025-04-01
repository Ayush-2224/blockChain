const { expect } = require("chai");
const { ethers } = require("hardhat");
const { parseEther, formatEther } = ethers.utils;

describe("BookRental", function () {
  let bookRental;
  let owner;
  let renter;
  let addrs;

  beforeEach(async function () {
    // Get signers
    [owner, renter, ...addrs] = await ethers.getSigners();

    // Deploy contract
    const BookRentalFactory = await ethers.getContractFactory("BookRental");
    bookRental = await BookRentalFactory.deploy();
  });

  describe("Return with Refund Test", function () {
    it("Should correctly process refund when rental duration is less than deposit", async function () {
      // Test parameters
      const title = "Test Book";
      const pricePerMinute = parseEther("0.05"); // 0.05 ETH per minute
      const deposit = parseEther("0.5"); // 0.5 ETH deposit
      
      // List a book
      const listTx = await bookRental.listItem(title, pricePerMinute, deposit);
      await listTx.wait();
      
      // Get initial balances
      const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);
      const renterBalanceBefore = await ethers.provider.getBalance(renter.address);
      
      // Rent the book
      const rentTx = await bookRental.connect(renter).rentItem(0, {
        value: deposit.add(pricePerMinute) // deposit + first minute
      });
      const rentReceipt = await rentTx.wait();
      
      // Wait for 5 minutes (simulated)
      await ethers.provider.send("evm_increaseTime", [5 * 60]); // 5 minutes
      await ethers.provider.send("evm_mine");

      // Calculate expected values
      const rentalDuration = 5; // 5 minutes
      const totalRent = pricePerMinute.mul(rentalDuration);
      const expectedRefund = deposit.sub(totalRent);
      const expectedOwnerPayment = totalRent;

      // Return the book
      const returnTx = await bookRental.connect(renter).returnItem(0);
      const receipt = await returnTx.wait();

      // Get final balances
      const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);
      const renterBalanceAfter = await ethers.provider.getBalance(renter.address);

      // Find events
      const debugEvent = receipt.events.find(e => e.event === "DebugRefund");
      const refundEvent = receipt.events.find(e => e.event === "RefundSent");
      const paymentEvent = receipt.events.find(e => e.event === "PaymentSent");
      const returnedEvent = receipt.events.find(e => e.event === "ItemReturned");

      // Verify events
      expect(debugEvent).to.not.be.undefined;
      expect(refundEvent).to.not.be.undefined;
      expect(paymentEvent).to.not.be.undefined;
      expect(returnedEvent).to.not.be.undefined;

      expect(debugEvent.args.deposit).to.equal(deposit);
      expect(debugEvent.args.totalRent).to.equal(totalRent);
      expect(debugEvent.args.refundAmount).to.equal(expectedRefund);

      expect(refundEvent.args.to).to.equal(renter.address);
      expect(refundEvent.args.amount).to.equal(expectedRefund);

      expect(paymentEvent.args.to).to.equal(owner.address);
      expect(paymentEvent.args.amount).to.equal(expectedOwnerPayment);

      expect(returnedEvent.args.bookId).to.equal(0);
      expect(returnedEvent.args.renter).to.equal(renter.address);
      expect(returnedEvent.args.refundAmount).to.equal(expectedRefund);

      // Verify book state
      const book = await bookRental.getBook(0);
      expect(book.isAvailable).to.be.true;
      expect(book.renter).to.equal(ethers.constants.AddressZero);

      // Calculate gas costs
      const rentGasCost = rentReceipt.gasUsed.mul(rentReceipt.effectiveGasPrice);
      const returnGasCost = receipt.gasUsed.mul(receipt.effectiveGasPrice);
      const totalGasCost = rentGasCost.add(returnGasCost);

      // Log the test results
      console.log("\nTest Results:");
      console.log("-------------");
      console.log("Initial Parameters:");
      console.log("- Price per minute:", formatEther(pricePerMinute), "ETH");
      console.log("- Deposit:", formatEther(deposit), "ETH");
      console.log("- Rental Duration:", rentalDuration, "minutes");
      
      console.log("\nCalculated Values:");
      console.log("- Total Rent:", formatEther(totalRent), "ETH");
      console.log("- Expected Refund:", formatEther(expectedRefund), "ETH");
      console.log("- Expected Owner Payment:", formatEther(expectedOwnerPayment), "ETH");
      
      console.log("\nEvents Emitted:");
      console.log("- Debug Refund Event:");
      console.log("  * Deposit:", formatEther(debugEvent.args.deposit), "ETH");
      console.log("  * Total Rent:", formatEther(debugEvent.args.totalRent), "ETH");
      console.log("  * Refund Amount:", formatEther(debugEvent.args.refundAmount), "ETH");
      
      console.log("\n- Refund Sent Event:");
      console.log("  * To:", refundEvent.args.to);
      console.log("  * Amount:", formatEther(refundEvent.args.amount), "ETH");
      
      console.log("\n- Payment Sent Event:");
      console.log("  * To:", paymentEvent.args.to);
      console.log("  * Amount:", formatEther(paymentEvent.args.amount), "ETH");
      
      console.log("\nBalance Changes:");
      console.log("Owner:");
      console.log("- Initial:", formatEther(ownerBalanceBefore), "ETH");
      console.log("- Final:", formatEther(ownerBalanceAfter), "ETH");
      console.log("- Change:", formatEther(ownerBalanceAfter.sub(ownerBalanceBefore)), "ETH");
      
      console.log("\nRenter:");
      console.log("- Initial:", formatEther(renterBalanceBefore), "ETH");
      console.log("- Final:", formatEther(renterBalanceAfter), "ETH");
      console.log("- Change:", formatEther(renterBalanceAfter.sub(renterBalanceBefore)), "ETH");
      console.log("- Total Gas Cost:", formatEther(totalGasCost), "ETH");
    });

    it("Should handle extra payment when rental duration exceeds deposit", async function () {
      // Test parameters
      const title = "Test Book";
      const pricePerMinute = parseEther("0.1"); // 0.1 ETH per minute
      const deposit = parseEther("0.5"); // 0.5 ETH deposit
      
      // List a book
      const listTx = await bookRental.listItem(title, pricePerMinute, deposit);
      await listTx.wait();
      
      // Get initial balances
      const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);
      const renterBalanceBefore = await ethers.provider.getBalance(renter.address);
      
      // Rent the book
      const rentTx = await bookRental.connect(renter).rentItem(0, {
        value: deposit.add(pricePerMinute) // deposit + first minute
      });
      const rentReceipt = await rentTx.wait();
      
      // Wait for 10 minutes (simulated)
      await ethers.provider.send("evm_increaseTime", [10 * 60]); // 10 minutes
      await ethers.provider.send("evm_mine");

      // Calculate expected values
      const rentalDuration = 10; // 10 minutes
      const totalRent = pricePerMinute.mul(rentalDuration); // 1 ETH
      const extraPaymentNeeded = totalRent.sub(deposit); // 0.5 ETH

      // Return the book with extra payment
      const returnTx = await bookRental.connect(renter).returnItem(0, {
        value: extraPaymentNeeded
      });
      const receipt = await returnTx.wait();

      // Get final balances
      const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);
      const renterBalanceAfter = await ethers.provider.getBalance(renter.address);

      // Find events
      const paymentEvent = receipt.events.find(e => e.event === "PaymentSent");
      const returnedEvent = receipt.events.find(e => e.event === "ItemReturned");

      // Verify events
      expect(paymentEvent).to.not.be.undefined;
      expect(returnedEvent).to.not.be.undefined;

      expect(paymentEvent.args.to).to.equal(owner.address);
      expect(paymentEvent.args.amount).to.equal(totalRent);

      expect(returnedEvent.args.bookId).to.equal(0);
      expect(returnedEvent.args.renter).to.equal(renter.address);
      expect(returnedEvent.args.refundAmount).to.equal(0);

      // Verify book state
      const book = await bookRental.getBook(0);
      expect(book.isAvailable).to.be.true;
      expect(book.renter).to.equal(ethers.constants.AddressZero);

      // Calculate gas costs
      const rentGasCost = rentReceipt.gasUsed.mul(rentReceipt.effectiveGasPrice);
      const returnGasCost = receipt.gasUsed.mul(receipt.effectiveGasPrice);
      const totalGasCost = rentGasCost.add(returnGasCost);

      // Log the test results
      console.log("\nExtra Payment Test Results:");
      console.log("-------------------------");
      console.log("Initial Parameters:");
      console.log("- Price per minute:", formatEther(pricePerMinute), "ETH");
      console.log("- Deposit:", formatEther(deposit), "ETH");
      console.log("- Rental Duration:", rentalDuration, "minutes");
      
      console.log("\nCalculated Values:");
      console.log("- Total Rent:", formatEther(totalRent), "ETH");
      console.log("- Extra Payment Needed:", formatEther(extraPaymentNeeded), "ETH");
      
      console.log("\nEvents Emitted:");
      console.log("- Payment Sent Event:");
      console.log("  * To:", paymentEvent.args.to);
      console.log("  * Amount:", formatEther(paymentEvent.args.amount), "ETH");
      
      console.log("\nBalance Changes:");
      console.log("Owner:");
      console.log("- Initial:", formatEther(ownerBalanceBefore), "ETH");
      console.log("- Final:", formatEther(ownerBalanceAfter), "ETH");
      console.log("- Change:", formatEther(ownerBalanceAfter.sub(ownerBalanceBefore)), "ETH");
      
      console.log("\nRenter:");
      console.log("- Initial:", formatEther(renterBalanceBefore), "ETH");
      console.log("- Final:", formatEther(renterBalanceAfter), "ETH");
      console.log("- Change:", formatEther(renterBalanceAfter.sub(renterBalanceBefore)), "ETH");
      console.log("- Total Gas Cost:", formatEther(totalGasCost), "ETH");
    });
  });
}); 