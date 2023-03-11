// deploy/00_deploy_my_contract.js
// https://github.com/wighawag/hardhat-deploy

const hre = require("hardhat");

module.exports = async ({getNamedAccounts, deployments}) => {
  const {deploy} = deployments;
  const { deployer } = await getNamedAccounts();
  
  const uri = "https://test";
  const projectName = hre.ethers.utils.formatBytes32String("testProject01");
  const beneficiary = "0x683c5FEb93Dfe9f940fF966a264CBD0b59233cd2";
  const mintFee = hre.ethers.utils.parseEther("0.0001");

  await deploy('NpNFT', {
    from: deployer,
    args: [uri, projectName, beneficiary, mintFee],
    log: true,
  });
};
module.exports.tags = ['NpNFT'];