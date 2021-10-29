import { Contract, ContractFactory, utils, BigNumber } from 'ethers';
import { run, ethers, network } from 'hardhat';
import * as contracts from '../../utils/contracts';

async function main() {
  await run('compile');

  await promptAndSubmit();
}

function promptAndSubmit(): Promise<void | Error> {
  return new Promise(async (resolve, reject) => {
    const [owner] = await ethers.getSigners();
    console.log('using address:', owner.address);

    const stealthVault = await ethers.getContractAt('StealthVault', contracts.stealthVault.goerli);
    const stealthRelayer = await ethers.getContractAt('StealthRelayer', contracts.stealthRelayer.goerli);

    const stealthERC20Factory: ContractFactory = await ethers.getContractFactory('StealthERC20');

    const stealthERC20: Contract = await stealthERC20Factory.deploy(
      'stealth token', // string memory _name,
      'sToken', // string memory _symbol,
      utils.parseEther('1000000'), // uint256 _mintAmount,
      stealthRelayer.address // address _stealthRelayer
    );
    console.log('stealthERC20 address:', stealthERC20.address);
    console.log('PLEASE add to utils/contracts.ts');
    console.log(`export const stealthERC20 = goerli: '${stealthERC20.address}'`);

    const penalty = utils.parseEther('1');
    // set penalty and enables stealth ERC20 to be called from stealthRelayer
    await stealthRelayer.setPenalty(penalty); // (default is 1 ETH)
    await stealthRelayer.addJob(stealthERC20.address);
    await stealthVault.bond({ value: penalty });
    await stealthVault.enableStealthContract(stealthRelayer.address);
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
