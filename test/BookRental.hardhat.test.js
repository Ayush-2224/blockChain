const { expect } = require("chai");
const { ethers, network } = require("hardhat");

describe("BookRental Contract", function () {
  let BookRental;
  let bookRental;
  let owner;
  let renter;
  let otherUser;

  // Common test parameters
  const title = "The Great Gatsby";
  const author = "F. Scott Fitzgerald";
  const description = "A classic American novel";
  const coverImage = "https://example.com/cover.jpg";
  let dailyPrice;
  let deposit;

  before(async function () {
    [owner, renter, otherUser] = await ethers.getSigners();
    
    // Deploy the contract
    BookRental = await ethers.getContractFactory("BookRental");
    bookRental = await BookRental.deploy();
    
    // Convert values to wei
    dailyPrice = ethers.parseEther("0.01");
    deposit = ethers.parseEther("0.1");
  });

  describe("Basic Book Rental Functionality", function () {
    it("Should allow listing a book", async function () {
      const tx = await bookRental.listItem(
        title, 
        author, 
        description, 
        coverImage, 
        dailyPrice, 
        deposit
      );
      
      // Get book count
      const count = await bookRental.bookCount();
      expect(count).to.equal(1);
      
      // Get book details
      const book = await bookRental.getBook(0);
      expect(book.title).to.equal(title);
      expect(book.author).to.equal(author);
      expect(book.description).to.equal(description);
      expect(book.dailyPrice).to.equal(dailyPrice);
      expect(book.deposit).to.equal(deposit);
      expect(book.owner).to.equal(owner.address);
      expect(book.isAvailable).to.be.true;
    });

    it("Should reject listing with empty title", async function () {
      await expect(
        bookRental.listItem("", author, description, coverImage, dailyPrice, deposit)
      ).to.be.revertedWith("Title cannot be empty");
    });

    it("Should reject listing with empty author", async function () {
      await expect(
        bookRental.listItem(title, "", description, coverImage, dailyPrice, deposit)
      ).to.be.revertedWith("Author cannot be empty");
    });

    it("Should allow renting a book", async function () {
      // Calculate payment (price + deposit)
      const payment = ethers.parseEther("0.11"); // 0.01 + 0.1
      
      // Rent the book
      await bookRental.connect(renter).rentItem(0, { value: payment });
      
      // Check book status
      const book = await bookRental.getBook(0);
      expect(book.isAvailable).to.be.false;
      expect(book.renter).to.equal(renter.address);
    });

    it("Should reject renting an unavailable book", async function () {
      const payment = ethers.parseEther("0.11");
      
      await expect(
        bookRental.connect(otherUser).rentItem(0, { value: payment })
      ).to.be.revertedWith("Book is not available");
    });

    it("Should reject insufficient payment", async function () {
      // First, list another book
      await bookRental.listItem(
        "Another Book", 
        "Another Author", 
        "Description", 
        "cover.jpg", 
        dailyPrice, 
        deposit
      );
      
      // Try to rent with insufficient payment
      const insufficientPayment = ethers.parseEther("0.09"); // Less than 0.11
      
      try {
        await bookRental.connect(renter).rentItem(1, { value: insufficientPayment });
        expect.fail("Transaction should have reverted");
      } catch (error) {
        expect(error.message).to.include("Insufficient payment");
      }
    });

    it("Should reject renting by the owner", async function () {
      const payment = ethers.parseEther("0.11");
      
      await expect(
        bookRental.rentItem(1, { value: payment })
      ).to.be.revertedWith("Cannot rent your own book");
    });

    it("Should allow returning a book", async function () {
      // We'll use the first book that's already rented
      const bookId = 0;
      
      // Return the book
      await bookRental.connect(renter).returnItem(bookId);
      
      // Get book details to verify state
      const book = await bookRental.getBook(bookId);
      expect(book.isAvailable).to.be.true;
      expect(book.renter).to.equal("0x0000000000000000000000000000000000000000");
    });
  });
}); 