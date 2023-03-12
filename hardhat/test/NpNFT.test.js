const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");

const uri = "https://test";

let accounts;
let owner, beneficiary0, creator1, creator2, buyer3, nonOwner4;
let mintFee, initPrice1, buyAmount1;

let npNFT;
const projectName01 = ethers.utils.formatBytes32String("project01");
const creatorName01 = ethers.utils.formatBytes32String("creator01");
const creatorName02 = ethers.utils.formatBytes32String("creator02");
const buyerName03 = ethers.utils.formatBytes32String("buyer03");
const nonOwnerName04 = ethers.utils.formatBytes32String("nonOwner04");
const creatorName05 = ethers.utils.formatBytes32String("creator05");

before(async function () {
    // get accounts from hardhat
    accounts = await ethers.getSigners();
    owner = accounts[0];
    beneficiary0 = accounts[0];
    creator1 = accounts[1];
    creator2 = accounts[2];
    buyer3 = accounts[3];
    nonOwner4 = accounts[4];
    mintFee = ethers.utils.parseEther('1');
    initPrice1 = ethers.utils.parseEther('2');
    buyAmount1 = initPrice1.add(1);
});
  
describe("NpNFT", function () {
    describe("Deploy", function () {
        it("Should deploy", async function () {
            const NpNFT = await ethers.getContractFactory("NpNFT");
            npNFT = await NpNFT.deploy(uri, projectName01, beneficiary0.address, mintFee);
            expect(npNFT.address).to.not.be.undefined;
            console.log("npNFT.address: ", npNFT.address);
        });
    });

    describe("Mint", function () {
        it("Should revert without paying mint fee", async function () {
            const tx0 = npNFT.connect(creator1).mint(creatorName01, "msg1", initPrice1, []);
            await expect(tx0).to.be.revertedWith("NpNFT: not enough mint fee");
        });
        it("Should mint", async function () {
            const benBalance0 = await ethers.provider.getBalance(beneficiary0.address);
            const tx0 = await npNFT.connect(creator1).mint(creatorName01, "msg1", initPrice1, [], {value: mintFee});
            expect(tx0).to.emit(npNFT, 'TokenMinted').withArgs(1, creator1.address, creatorName01, "msg1", initPrice1);
            expect(await npNFT.balanceOf(creator1.address, 1)).to.equal(1);
            expect(await npNFT.isCurrentOwnerOf(1, creator1.address)).to.equal(true);
            expect(await npNFT.isOneOfTheOwnersOf(1, creator1.address)).to.equal(true);
            const ownershipRecords = await npNFT.getOwnershipRecordsOf(1);
            expect(ownershipRecords.length).to.equal(1);
            expect(ownershipRecords[0].name).to.equal(creatorName01);
            expect(ownershipRecords[0].message).to.equal("msg1");
            const benBalance1 = await ethers.provider.getBalance(beneficiary0.address);
            expect(benBalance1.sub(benBalance0)).to.equal(mintFee);
        });
        it("Should mint batch", async function () {
            const name = creatorName02;
            const msg = "msg2";
            const numToMint = 2;
            const tx0 = await npNFT.connect(creator2).mintBatch(name, msg, initPrice1, [], numToMint, { value: (mintFee.mul(numToMint)) });
            expect(tx0).to.emit(npNFT, 'TokenBatchMinted').withArgs(2, creator2.address, name, msg, initPrice1, numToMint);
            expect(await npNFT.balanceOf(creator2.address, 2)).to.equal(1);
            expect(await npNFT.balanceOf(creator2.address, 3)).to.equal(1);
            expect(await npNFT.isCurrentOwnerOf(2, creator2.address)).to.equal(true);
            expect(await npNFT.isOneOfTheOwnersOf(3, creator2.address)).to.equal(true);
            const ownershipRecords = await npNFT.getOwnershipRecordsOf(3);
            expect(ownershipRecords.length).to.equal(1);
            expect(ownershipRecords[0].name).to.equal(name);
            expect(ownershipRecords[0].message).to.equal(msg);
        });
    });

    describe("takeOwnershipOf", function () {
        const name = buyerName03;
        const msg = "msg3";
        it("takeOwnershipOf should revet without paying", async function () {
            const tx0 = npNFT.connect(buyer3).takeOwnershipOf(1, name, msg);
            await expect(tx0).to.be.revertedWith("NpNFT: invalid payment");
        });
        it("takeOwnershipOf should revet with insufficient payment", async function () {
            const tx0 = npNFT.connect(buyer3).takeOwnershipOf(1, name, msg, { value: 1 });
            await expect(tx0).to.be.revertedWith("NpNFT: not enough payment");
            const tx1 = npNFT.connect(buyer3).takeOwnershipOf(1, name, msg, { value: initPrice1 });
            await expect(tx0).to.be.revertedWith("NpNFT: not enough payment");
        });
        it("takeOwnershipOf should revet with invalid token id", async function () {
            const tx0 = npNFT.connect(buyer3).takeOwnershipOf(100, name, msg, { value: buyAmount1 });
            await expect(tx0).to.be.revertedWith("NpNFT: invalid tokenId");
        });
        it("takeOwnershipOf should work", async function () {
            const benBalance0 = await ethers.provider.getBalance(beneficiary0.address);
            const tx0 = await npNFT.connect(buyer3).takeOwnershipOf(1, name, msg, { value: buyAmount1 });
            expect(tx0).to.emit(npNFT, 'OwnershipTakenOver').withArgs(1, creator1.address, buyer3.address, buyAmount1);
            expect(await npNFT.balanceOf(creator1.address, 1)).to.equal(0);
            expect(await npNFT.balanceOf(buyer3.address, 1)).to.equal(1);
            expect(await npNFT.isCurrentOwnerOf(1, creator1.address)).to.equal(false);
            expect(await npNFT.isCurrentOwnerOf(1, buyer3.address)).to.equal(true);
            expect(await npNFT.isOneOfTheOwnersOf(1, creator1.address)).to.equal(true);
            expect(await npNFT.isOneOfTheOwnersOf(1, buyer3.address)).to.equal(true);
            const ownershipRecords = await npNFT.getOwnershipRecordsOf(1);
            expect(ownershipRecords.length).to.equal(2);
            expect(ownershipRecords[1].name).to.equal(name);
            expect(ownershipRecords[1].message).to.equal(msg);
            const benBalance1 = await ethers.provider.getBalance(beneficiary0.address);
            expect(benBalance1.sub(benBalance0)).to.equal(buyAmount1);
        });
    });

    describe("updateOwnerNameOf", function () {
        it("should revert if sender is not owner", async function () {
            const newName = nonOwnerName04;
            const tx0 = npNFT.connect(nonOwner4).updateOwnerNameOf(1, newName);
            await expect(tx0).to.be.revertedWith("NpNFT: not owner");
        });
        it("should update owner name", async function () {
            const newName = creatorName05;
            const tx0 = await npNFT.connect(creator1).updateOwnerNameOf(1, newName);
            expect(tx0).to.emit(npNFT, 'OwnerNameUpdated').withArgs(1, creator1.address, newName);
        });
    });

    describe("updateOwnerMsgOf", function () {
        it("should revert if sender is not owner", async function () {
            const newMsg = "newMsg4";
            const tx0 = npNFT.connect(nonOwner4).updateOwnerMsgOf(1, newMsg);
            await expect(tx0).to.be.revertedWith("NpNFT: not owner");
        });
        it("should update owner name", async function () {
            const newMsg = "newMsg1";
            const tx0 = await npNFT.connect(creator1).updateOwnerMsgOf(1, newMsg);
            expect(tx0).to.emit(npNFT, 'OwnerMsgUpdated').withArgs(1, creator1.address, newMsg);
        });
    });
});
