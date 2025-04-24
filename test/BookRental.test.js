const { expect } = require("chai");
const BookRental = artifacts.require("BookRental");

contract("BookRental", function (accounts) {
  const owner = accounts[0];
  const renter = accounts[1];
  const otherUser = accounts[2];

  // Common test parameters
  const title = "The Great Gatsby";
  const author = "F. Scott Fitzgerald";
  const description = "A classic American novel";
  const coverImage = "https://example.com/cover.jpg";
  const dailyPrice = web3.utils.toWei("0.01", "ether"); // Price per minute in test
  const deposit = web3.utils.toWei("0.1", "ether");   // Deposit amount
  
  // Helper function to mine blocks and advance time
  const advanceTimeAndBlock = async (minutes) => {
    await web3.currentProvider.send({
      jsonrpc: "2.0",
      method: "evm_increaseTime",
      params: [minutes * 60],
      id: new Date().getTime()
    });
    
    await web3.currentProvider.send({
      jsonrpc: "2.0",
      method: "evm_mine",
      params: [],
      id: new Date().getTime()
    });
  };

  let bookRental;
  
  beforeEach(async function () {
    bookRental = await BookRental.new();
  });

  describe("Book Listing", function () {
    it("Should successfully list a book", async function () {
      const tx = await bookRental.listItem(title, author, description, coverImage, dailyPrice, deposit, { from: owner });
      
      // Check event was emitted correctly
      const event = tx.logs.find(log => log.event === "ItemListed");
      expect(event).to.not.be.undefined;
      expect(event.args.bookId.toString()).to.equal("0");
      expect(event.args.title).to.equal(title);
      expect(event.args.author).to.equal(author);
      
      // Check book data stored correctly
      const book = await bookRental.getBook(0);
      expect(book.title).to.equal(title);
      expect(book.author).to.equal(author);
      expect(book.description).to.equal(description);
      expect(book.coverImage).to.equal(coverImage);
      expect(book.dailyPrice.toString()).to.equal(dailyPrice);
      expect(book.deposit.toString()).to.equal(deposit);
      expect(book.owner).to.equal(owner);
      expect(book.isAvailable).to.be.true;
    });

    it("Should reject listing with empty title", async function () {
      try {
        await bookRental.listItem("", author, description, coverImage, dailyPrice, deposit, { from: owner });
        expect.fail("Transaction should have reverted");
      } catch (error) {
        expect(error.message).to.include("Title cannot be empty");
      }
    });

    it("Should reject listing with empty author", async function () {
      try {
        await bookRental.listItem(title, "", description, coverImage, dailyPrice, deposit, { from: owner });
        expect.fail("Transaction should have reverted");
      } catch (error) {
        expect(error.message).to.include("Author cannot be empty");
      }
    });

    it("Should reject listing with zero price", async function () {
      try {
        await bookRental.listItem(title, author, description, coverImage, 0, deposit, { from: owner });
        expect.fail("Transaction should have reverted");
      } catch (error) {
        expect(error.message).to.include("Price must be greater than 0");
      }
    });

    it("Should reject listing with deposit less than price", async function () {
      try {
        await bookRental.listItem(title, author, description, coverImage, deposit, dailyPrice, { from: owner });
        expect.fail("Transaction should have reverted");
      } catch (error) {
        expect(error.message).to.include("Deposit must be greater than or equal to price");
      }
    });
  });

  describe("Book Rental", function () {
    beforeEach(async function () {
      // List a book for testing rental functionality
      await bookRental.listItem(title, author, description, coverImage, dailyPrice, deposit, { from: owner });
    });

    it("Should successfully rent a book", async function () {
      const payment = web3.utils.toBN(dailyPrice).add(web3.utils.toBN(deposit));
      const tx = await bookRental.rentItem(0, { from: renter, value: payment });
      
      // Check event was emitted correctly
      const event = tx.logs.find(log => log.event === "ItemRented");
      expect(event).to.not.be.undefined;
      expect(event.args.bookId.toString()).to.equal("0");
      expect(event.args.renter).to.equal(renter);
      
      // Check book data updated correctly
      const book = await bookRental.getBook(0);
      expect(book.renter).to.equal(renter);
      expect(book.isAvailable).to.be.false;
    });

    it("Should reject renting with insufficient payment", async function () {
      const insufficientPayment = web3.utils.toBN(dailyPrice).add(web3.utils.toBN(deposit)).sub(web3.utils.toBN(1));
      try {
        await bookRental.rentItem(0, { from: renter, value: insufficientPayment });
        expect.fail("Transaction should have reverted");
      } catch (error) {
        expect(error.message).to.include("Insufficient payment");
      }
    });

    it("Should refund excess payment when renting", async function () {
      const excessPayment = web3.utils.toWei("0.05", "ether");
      const payment = web3.utils.toBN(dailyPrice).add(web3.utils.toBN(deposit)).add(web3.utils.toBN(excessPayment));
      
      const balanceBefore = web3.utils.toBN(await web3.eth.getBalance(renter));
      const tx = await bookRental.rentItem(0, { from: renter, value: payment });
      
      // Get transaction gas cost
      const receipt = await web3.eth.getTransactionReceipt(tx.tx);
      const gasUsed = web3.utils.toBN(receipt.gasUsed);
      const txDetails = await web3.eth.getTransaction(tx.tx);
      const gasPrice = web3.utils.toBN(txDetails.gasPrice);
      const gasCost = gasUsed.mul(gasPrice);
      
      const balanceAfter = web3.utils.toBN(await web3.eth.getBalance(renter));
      
      // Expected change: payment - excessPayment (which is refunded)
      const expectedSpending = web3.utils.toBN(dailyPrice).add(web3.utils.toBN(deposit));
      const actualChange = balanceBefore.sub(balanceAfter).sub(gasCost);
      
      expect(actualChange.toString()).to.equal(expectedSpending.toString());
    });

    it("Should reject renting by the book owner", async function () {
      const payment = web3.utils.toBN(dailyPrice).add(web3.utils.toBN(deposit));
      try {
        await bookRental.rentItem(0, { from: owner, value: payment });
        expect.fail("Transaction should have reverted");
      } catch (error) {
        expect(error.message).to.include("Cannot rent your own book");
      }
    });

    it("Should reject renting an already rented book", async function () {
      const payment = web3.utils.toBN(dailyPrice).add(web3.utils.toBN(deposit));
      
      // First rental
      await bookRental.rentItem(0, { from: renter, value: payment });
      
      // Second rental attempt
      try {
        await bookRental.rentItem(0, { from: otherUser, value: payment });
        expect.fail("Transaction should have reverted");
      } catch (error) {
        expect(error.message).to.include("Book is not available");
      }
    });
  });

  describe("Book Return", function () {
    beforeEach(async function () {
      // List and rent a book for testing return functionality
      await bookRental.listItem(title, author, description, coverImage, dailyPrice, deposit, { from: owner });
      const payment = web3.utils.toBN(dailyPrice).add(web3.utils.toBN(deposit));
      await bookRental.rentItem(0, { from: renter, value: payment });
    });

    it("Should successfully return a book with correct refund", async function () {
      // Simulate passage of 5 minutes
      await advanceTimeAndBlock(5);
      
      // Calculate expected values
      const rentalDuration = 5; // 5 minutes
      const totalRent = web3.utils.toBN(dailyPrice).mul(web3.utils.toBN(rentalDuration));
      const expectedRefund = web3.utils.toBN(deposit).sub(totalRent);
      
      // Track balances before return
      const ownerBalanceBefore = web3.utils.toBN(await web3.eth.getBalance(owner));
      const renterBalanceBefore = web3.utils.toBN(await web3.eth.getBalance(renter));
      
      // Return the book
      const tx = await bookRental.returnItem(0, { from: renter });
      
      // Get transaction gas cost
      const receipt = await web3.eth.getTransactionReceipt(tx.tx);
      const gasUsed = web3.utils.toBN(receipt.gasUsed);
      const txDetails = await web3.eth.getTransaction(tx.tx);
      const gasPrice = web3.utils.toBN(txDetails.gasPrice);
      const gasCost = gasUsed.mul(gasPrice);
      
      // Find relevant events
      const returnedEvent = tx.logs.find(log => log.event === "ItemReturned");
      const refundEvent = tx.logs.find(log => log.event === "RefundSent");
      const paymentEvent = tx.logs.find(log => log.event === "PaymentSent");
      
      // Verify events
      expect(returnedEvent).to.not.be.undefined;
      expect(refundEvent).to.not.be.undefined;
      expect(paymentEvent).to.not.be.undefined;
      
      expect(returnedEvent.args.bookId.toString()).to.equal("0");
      expect(returnedEvent.args.renter).to.equal(renter);
      expect(returnedEvent.args.refundAmount.toString()).to.equal(expectedRefund.toString());
      
      expect(refundEvent.args.to).to.equal(renter);
      expect(refundEvent.args.amount.toString()).to.equal(expectedRefund.toString());
      
      expect(paymentEvent.args.to).to.equal(owner);
      expect(paymentEvent.args.amount.toString()).to.equal(totalRent.toString());
      
      // Verify book state
      const book = await bookRental.getBook(0);
      expect(book.isAvailable).to.be.true;
      expect(book.renter).to.equal("0x0000000000000000000000000000000000000000");
      
      // Check balance changes
      const ownerBalanceAfter = web3.utils.toBN(await web3.eth.getBalance(owner));
      const renterBalanceAfter = web3.utils.toBN(await web3.eth.getBalance(renter));
      
      // Owner should receive the rental payment
      expect(ownerBalanceAfter.sub(ownerBalanceBefore).toString()).to.equal(totalRent.toString());
      
      // Renter should receive the refund minus gas costs
      const expectedRenterChange = expectedRefund.sub(gasCost);
      const actualRenterChange = renterBalanceAfter.sub(renterBalanceBefore);
      
      // Due to possible rounding, we'll check if the difference is minimal
      const difference = expectedRenterChange.sub(actualRenterChange).abs();
      expect(difference.lt(web3.utils.toBN(web3.utils.toWei("0.0001", "ether")))).to.be.true;
    });

    it("Should handle return when rental duration exceeds deposit", async function () {
      // Calculate minutes that would exceed deposit 
      const depositInWei = web3.utils.toBN(deposit);
      const priceInWei = web3.utils.toBN(dailyPrice);
      const minutes = depositInWei.div(priceInWei).add(web3.utils.toBN(5)).toNumber();
      
      // Simulate passage of time
      await advanceTimeAndBlock(minutes);
      
      // Calculate expected values
      const totalRent = priceInWei.mul(web3.utils.toBN(minutes));
      const extraPaymentNeeded = totalRent.sub(depositInWei);
      
      // Track balances before return
      const ownerBalanceBefore = web3.utils.toBN(await web3.eth.getBalance(owner));
      
      // Return the book with extra payment
      const tx = await bookRental.returnItem(0, { from: renter, value: extraPaymentNeeded });
      
      // Find relevant events
      const returnedEvent = tx.logs.find(log => log.event === "ItemReturned");
      const paymentEvent = tx.logs.find(log => log.event === "PaymentSent");
      
      // Verify events
      expect(returnedEvent).to.not.be.undefined;
      expect(paymentEvent).to.not.be.undefined;
      
      expect(returnedEvent.args.bookId.toString()).to.equal("0");
      expect(returnedEvent.args.renter).to.equal(renter);
      expect(returnedEvent.args.refundAmount.toString()).to.equal("0");
      
      expect(paymentEvent.args.to).to.equal(owner);
      expect(paymentEvent.args.amount.toString()).to.equal(totalRent.toString());
      
      // Verify book state
      const book = await bookRental.getBook(0);
      expect(book.isAvailable).to.be.true;
      
      // Check owner received correct payment
      const ownerBalanceAfter = web3.utils.toBN(await web3.eth.getBalance(owner));
      expect(ownerBalanceAfter.sub(ownerBalanceBefore).toString()).to.equal(totalRent.toString());
    });
  });

  describe("Edge Cases", function () {
    it("Should reject invalid book ID", async function () {
      try {
        await bookRental.getBook(999);
        expect.fail("Transaction should have reverted");
      } catch (error) {
        expect(error.message).to.include("Invalid book ID");
      }
      
      try {
        await bookRental.rentItem(999, { from: renter, value: web3.utils.toWei("1", "ether") });
        expect.fail("Transaction should have reverted");
      } catch (error) {
        expect(error.message).to.include("Invalid book ID");
      }
      
      try {
        await bookRental.returnItem(999, { from: renter });
        expect.fail("Transaction should have reverted");
      } catch (error) {
        expect(error.message).to.include("Invalid book ID");
      }
    });

    it("Should handle minimum rental period (1 minute)", async function () {
      // List and rent a book
      await bookRental.listItem(title, author, description, coverImage, dailyPrice, deposit, { from: owner });
      const payment = web3.utils.toBN(dailyPrice).add(web3.utils.toBN(deposit));
      await bookRental.rentItem(0, { from: renter, value: payment });
      
      // Return immediately (less than 1 minute)
      const tx = await bookRental.returnItem(0, { from: renter });
      
      // Find event to check refund amount
      const returnedEvent = tx.logs.find(log => log.event === "ItemReturned");
      const totalRent = web3.utils.toBN(dailyPrice).mul(web3.utils.toBN(1)); // Minimum 1 minute
      const expectedRefund = web3.utils.toBN(deposit).sub(totalRent);
      
      expect(returnedEvent.args.refundAmount.toString()).to.equal(expectedRefund.toString());
    });
  });
}); 