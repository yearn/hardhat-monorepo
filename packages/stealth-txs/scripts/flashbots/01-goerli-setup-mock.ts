import { StealthERC20, StealthERC20__factory, StealthRelayer, StealthVault } from '@typechained';
import { utils } from 'ethers';
import { run, ethers } from 'hardhat';
import * as contracts from '../../utils/contracts';

async function main() {
  await run('compile');

  await promptAndSubmit();
}

function promptAndSubmit(): Promise<void | Error> {
  return new Promise(async (resolve, reject) => {
    const [owner] = await ethers.getSigners();
    console.log('using address:', owner.address);

    const stealthVault = await ethers.getContractAt<StealthVault>('StealthVault', contracts.stealthVault.goerli);
    const stealthRelayer = await ethers.getContractAt<StealthRelayer>('StealthRelayer', contracts.stealthRelayer.goerli);

    let stealthERC20: StealthERC20;

    if (contracts.stealthERC20.goerli) {
      stealthERC20 = await ethers.getContractAt('StealthERC20', contracts.stealthERC20.goerli);
    } else {
      const stealthERC20Factory: StealthERC20__factory = await ethers.getContractFactory<StealthERC20__factory>('StealthERC20');
      stealthERC20 = await stealthERC20Factory.deploy(
        'stealth token', // string memory _name,
        'sToken', // string memory _symbol,
        utils.parseEther('1000000'), // uint256 _mintAmount,
        stealthRelayer.address // address _stealthRelayer
      );
      console.log('stealthERC20 address:', stealthERC20.address);
      console.log('PLEASE add to utils/contracts.ts');
      console.log(`export const stealthERC20 = goerli: '${stealthERC20.address}'`);

      // set penalty and enables stealth ERC20 to be called from stealthRelayer
      await stealthRelayer.addJob(stealthERC20.address);
    }

    await stealthVault.bond({ value: utils.parseEther('1') });
    await stealthVault.enableStealthContract(stealthRelayer.address);
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
