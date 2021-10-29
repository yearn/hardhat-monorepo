import { utils } from 'ethers';
import { ethers } from 'hardhat';
import moment from 'moment';

const generateRandomNumber = (min: number, max: number): string => {
  return `${Math.floor(Math.random() * (max - min) + min)}`;
};

async function execute() {
  const [deployer] = await ethers.getSigners();
  const stealthRelayer = await ethers.getContractAt('contracts/StealthRelayer.sol:StealthRelayer', '0x03900f1cdEf9355a121D84DeaC414799dB51Dc05');
  const stealthERC20 = await ethers.getContractAt('contracts/mock/StealthERC20.sol:StealthERC20', '0x01489f5881A4C436793cb48434eAA2D488D83C07');
  const rawTx = await stealthERC20.populateTransaction.stealthMint(deployer.address, utils.parseEther('666'));
  const hash = utils.formatBytes32String(generateRandomNumber(1, 1000000));
  console.log('hash', hash);
  await stealthRelayer.executeWithoutBlockProtection(stealthERC20.address, rawTx.data, hash, {
    gasLimit: 30_000_000 - 15_000,
    gasPrice: utils.parseUnits('10', 'gwei'),
  });
  console.log('sent at', moment().unix());
  console.log('Executing without block protection');
}

execute()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
