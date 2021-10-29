import { utils } from 'ethers';
import { run, ethers } from 'hardhat';

async function main() {
  run('compile');
  const [deployer] = await ethers.getSigners();
  const stealthVaultFactory = await ethers.getContractFactory('contracts/StealthVault.sol:StealthVault');
  const stealthRelayerFactory = await ethers.getContractFactory('contracts/StealthRelayer.sol:StealthRelayer');
  const stealthERC20Factory = await ethers.getContractFactory('contracts/mock/StealthERC20.sol:StealthERC20');
  const stealthVault = await stealthVaultFactory.deploy();
  console.log('Deployed stealth vault', stealthVault.address);
  await stealthVault.bond({ value: utils.parseEther('1') });
  console.log('Added 0.1 bond');
  const stealthRelayer = await stealthRelayerFactory.deploy(stealthVault.address);
  console.log('Deployed stealth relayer', stealthRelayer.address);
  await stealthVault.enableStealthContract(stealthRelayer.address);
  console.log('Enabled stealth relayer as a stealth contract for caller in stealth vault');
  const stealthERC20 = await stealthERC20Factory.deploy('BLA', 'BLA', 0, stealthRelayer.address);
  console.log('Deployed stealth erc20', stealthERC20.address);
  await stealthRelayer.addJob(stealthERC20.address);
  console.log('Added stealth erc20 as a job to stealth relayer');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
