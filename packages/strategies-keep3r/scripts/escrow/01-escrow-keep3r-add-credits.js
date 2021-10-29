const hre = require('hardhat');
const ethers = hre.ethers;
const config = require('../../.config.json');
const { e18, e18ToDecimal } = require('../../utils/web3-utils');

async function main() {
  await hre.run('compile');
  await run();
}

function run() {
  return new Promise(async (resolve) => {
    const escrowContracts = config.contracts.mainnet.escrow;
    const [owner] = await ethers.getSigners();
    // Setup deployer
    await hre.network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [config.accounts.mainnet.deployer],
    });
    const deployer = owner.provider.getUncheckedSigner(config.accounts.mainnet.deployer);
    // impersonate whale
    await hre.network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [escrowContracts.whale],
    });
    const whale = owner.provider.getUncheckedSigner(escrowContracts.whale);
    (await ethers.getContractFactory('ForceETH')).deploy(whale._address, {
      value: e18,
    });

    const keep3r = await ethers.getContractAt('IKeep3rV1', escrowContracts.keep3r, deployer);

    const Keep3rEscrow = await ethers.getContractFactory('contracts/keep3r/Keep3rEscrow.sol:Keep3rEscrow');
    // const keep3rEscrow = await Keep3rEscrow.deploy(escrowContracts.governance, escrowContracts.keep3r, escrowContracts.lpToken);

    // Setup deployed keep3rEscrow
    const keep3rEscrow = await ethers.getContractAt('contracts/keep3r/Keep3rEscrow.sol:Keep3rEscrow', escrowContracts.escrow1, deployer);
    const keep3rEscrow2 = await ethers.getContractAt('contracts/keep3r/Keep3rEscrow.sol:Keep3rEscrow', escrowContracts.escrow2, deployer);

    const jobs = {
      crvStrategyKeep3r: {
        address: escrowContracts.jobs['crvStrategyKeep3r'],
        contractName: 'CrvStrategyKeep3r',
      },
      vaultKeep3r: {
        address: escrowContracts.jobs['vaultKeep3r'],
        contractName: 'VaultKeep3r',
      },
      yearnGenericKeep3rV2: {
        address: escrowContracts.jobs['yearnGenericKeep3rV2'],
        contractName: 'GenericKeep3rV2',
      },
    };

    // Setup jobs
    for (const job in jobs) {
      jobs[job].contract = await ethers.getContractAt(jobs[job].contractName, jobs[job].address, deployer);
    }

    for (const job in jobs) {
      const credits = await keep3r.callStatic.credits(jobs[job].address, keep3r.address);
      console.log(`${job} credits:`, e18ToDecimal(credits));
    }
    console.log('------------------');

    const job = jobs[Object.keys(jobs)[2]]; // Get first job
    const liquidity = await ethers.getContractAt('IUniswapV2Pair', escrowContracts.lpToken, deployer);
    const lpUnderliyngs = await liquidity.getReserves();
    const underlyingAmount = (await liquidity.token0()) == keep3r.address ? lpUnderliyngs.reserve0 : lpUnderliyngs.reserve1;
    const totalSupply = await liquidity.totalSupply();
    const creditsPerLP = underlyingAmount.mul(e18).div(totalSupply);
    console.log('credits for 1 LP:', e18ToDecimal(creditsPerLP));
    const amount = e18.mul(50);
    console.log('adding:', e18ToDecimal(amount.mul(creditsPerLP).div(e18)), 'credits');

    // Transfer LPs from Whale
    // console.log('amount', e18ToDecimal(amount))
    // await liquidity.connect(whale).transfer(keep3rEscrow.address, amount);

    console.log('lpBalance', e18ToDecimal(await liquidity.callStatic.balanceOf(keep3rEscrow.address)));

    // /*
    // addLiquidityToJob(address _liquidity, address _job, uint _amount)
    console.log('addLiquidityToJob:');
    console.log(liquidity.address, job.address, amount.toString());
    await keep3rEscrow.addLiquidityToJob(liquidity.address, job.address, amount);
    console.log('  lpBalance', e18ToDecimal(await liquidity.callStatic.balanceOf(keep3rEscrow.address)));
    console.log('  credits', e18ToDecimal(await keep3r.callStatic.credits(job.address, keep3r.address)));
    console.log(
      '  liquidityProvided',
      e18ToDecimal(await keep3r.callStatic.liquidityProvided(keep3rEscrow.address, liquidity.address, job.address))
    );
    console.log(
      '  liquidityApplied',
      (await keep3r.callStatic.liquidityApplied(keep3rEscrow.address, liquidity.address, job.address)).toNumber()
    );
    console.log(
      '  liquidityAmount',
      e18ToDecimal(await keep3r.callStatic.liquidityAmount(keep3rEscrow.address, liquidity.address, job.address))
    );

    // Increase time
    await hre.network.provider.request({
      method: 'evm_increaseTime',
      params: [3 * 24 * 60 * 60],
    }); // 3 days
    await hre.network.provider.request({ method: 'evm_mine', params: [] });

    // applyCreditToJob(address provider, address _liquidity, address _job)
    console.log('applyCreditToJob:');
    console.log(keep3rEscrow.address, liquidity.address, job.address);
    await keep3rEscrow.applyCreditToJob(keep3rEscrow.address, liquidity.address, job.address);
    console.log('  credits', e18ToDecimal(await keep3r.callStatic.credits(job.address, keep3r.address)));
    console.log(
      '  liquidityAmount',
      e18ToDecimal(await keep3r.callStatic.liquidityAmount(keep3rEscrow.address, liquidity.address, job.address))
    );
    // */

    // unbondLiquidityFromJob(address _liquidity, address _job, uint _amount)
    console.log('unbondLiquidityFromJob:');
    await keep3rEscrow.unbondLiquidityFromJob(liquidity.address, job.address, amount);
    console.log('  credits', e18ToDecimal(await keep3r.callStatic.credits(job.address, keep3r.address)));
    console.log(
      '  liquidityUnbonding',
      e18ToDecimal(await keep3r.callStatic.liquidityUnbonding(keep3rEscrow.address, liquidity.address, job.address))
    );
    console.log(
      '  liquidityAmountsUnbonding',
      e18ToDecimal(await keep3r.callStatic.liquidityAmountsUnbonding(keep3rEscrow.address, liquidity.address, job.address))
    );

    // Increase time
    await hre.network.provider.request({
      method: 'evm_increaseTime',
      params: [14 * 24 * 60 * 60],
    }); // 14 days
    await hre.network.provider.request({ method: 'evm_mine', params: [] });

    // removeLiquidityFromJob(address _liquidity, address _job)
    console.log('removeLiquidityFromJob:');
    await keep3rEscrow.removeLiquidityFromJob(liquidity.address, job.address);
    console.log('  lpBalance', e18ToDecimal(await liquidity.callStatic.balanceOf(keep3rEscrow.address)));
    console.log(
      '  liquidityProvided',
      e18ToDecimal(await keep3r.callStatic.liquidityProvided(keep3rEscrow.address, liquidity.address, job.address))
    );
    console.log(
      '  liquidityAmountsUnbonding',
      e18ToDecimal(await keep3r.callStatic.liquidityAmountsUnbonding(keep3rEscrow.address, liquidity.address, job.address))
    );

    // removeLiquidityFromJob(address _liquidity, address _job)
    console.log('removeLiquidityFromJob:');
    await keep3rEscrow.returnLPsToGovernance();
    console.log('  lpBalance', e18ToDecimal(await liquidity.callStatic.balanceOf(keep3rEscrow.address)));
    console.log('  lpBalance(governance)', e18ToDecimal(await liquidity.callStatic.balanceOf(escrowContracts.governance)));

    resolve();
  });
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
