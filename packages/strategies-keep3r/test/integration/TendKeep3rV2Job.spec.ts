import { expect } from 'chai';
import { ethers, network } from 'hardhat';
import { e18, ZERO_ADDRESS } from '../../utils/web3-utils';
import config from '../../contracts.json';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber } from 'ethers';
import * as contracts from '../../utils/contracts';
import * as yOracleContracts from '@lbertenasco/y-oracle/dist/utils/contracts';
import { evm, wallet } from '@test-utils';
import { getNodeUrl } from '@utils/network';

const mechanicsContracts = config.contracts.mainnet.mechanics;

const lowerCaseArray = (array: string[]) => array.map((address: string) => address.toLowerCase());

describe('TendKeep3rV2Job', () => {
  let owner: SignerWithAddress;
  let keeper: any;
  let anotherKeeper:any;
  let keep3rGovernance: any;
  let whale: any;
  let governorV2Keeper: any;

  let v2Keeper:any;
  let tendKeep3rV2Job:any;
  let strategy:any;
  let keep3rV2:any;
  let dummyStrategy:any;

  let strategies:any[];

  before('Setup accounts and contracts', async () => {
    [owner] = await ethers.getSigners();

    await evm.reset({
      jsonRpcUrl: getNodeUrl('mainnet'),
      blockNumber: 14385751,
    });

    // wallets
    keeper = await wallet.impersonate(config.accounts.mainnet.keeper);
    anotherKeeper = await wallet.generateRandomWithBalance();
    keep3rGovernance = await wallet.impersonate(config.accounts.mainnet.keep3rGovernance);
    whale = await wallet.impersonate(config.accounts.mainnet.whale);
    governorV2Keeper = await wallet.impersonate(config.accounts.mainnet.governorV2Keeper);

    (await ethers.getContractFactory('ForceETH')).deploy(keep3rGovernance._address, {
      value: e18.mul(100),
    });
    (await ethers.getContractFactory('ForceETH')).deploy(keeper._address, {
      value: e18.mul(100),
    });

    // Contracts
    v2Keeper = await ethers.getContractAt('V2Keeper', config.contracts.mainnet.proxyJobs.v2Keeper, governorV2Keeper);
    dummyStrategy = await (await ethers.getContractFactory('DummyStrategy', owner)).deploy();
    keep3rV2 = await ethers.getContractAt('@yearn/contract-utils/contracts/interfaces/keep3rV2/IKeep3r.sol:IKeep3r', config.contracts.mainnet.keep3rV2.address, keep3rGovernance);
    
    // Fund WETH
    const wethSigner = await wallet.impersonate(config.contracts.mainnet.wethToken.address);
    const weth = await ethers.getContractAt('ERC20Token', config.contracts.mainnet.wethToken.address, wethSigner);
    
    // Transfer WETH
    await weth.connect(wethSigner).transfer(anotherKeeper.address, e18.mul(10));
    
    // Register keeper (bond WETH)
    await weth.connect(anotherKeeper).approve(keep3rV2.address, e18.mul(10));
    await keep3rV2.connect(anotherKeeper).bond(config.contracts.mainnet.wethToken.address, e18.mul(10));
    await evm.advanceTimeAndBlock(4 * 24 * 60 * 60); // 4 days
    await keep3rV2.connect(anotherKeeper).activate(config.contracts.mainnet.wethToken.address);

    // Register keeper (bond KP3R)
    await keep3rV2.connect(keeper).bond(config.contracts.mainnet.keep3r.address, e18.mul(0));
    await evm.advanceTimeAndBlock(4 * 24 * 60 * 60); // 4 days
    await keep3rV2.connect(keeper).activate(config.contracts.mainnet.keep3r.address);
  });

  it('Should deploy on mainnet fork', async function () {
    const TendKeep3rV2Job = await ethers.getContractFactory('TendKeep3rV2Job');

    tendKeep3rV2Job = (
      await TendKeep3rV2Job.deploy(
        mechanicsContracts.registry, // address _mechanicsRegistry,
        yOracleContracts.yUnsafeOracleV1.mainnet, // address _yOracle
        config.contracts.mainnet.keep3rV2.address, // address _keep3r,
        ZERO_ADDRESS, // address _bond,
        0, //e18.mul(50), // 50 KP3R required // uint256 _minBond,
        0, // uint256 _earned,
        0, // uint256 _age,
        true, // bool _onlyEOA,
        v2Keeper.address, // address _v2Keeper
        6 * 60 * 60 // uint256 _workCooldown // 6 hours
      )
    ).connect(owner);

    // Add as valid job
    await v2Keeper.addJob(tendKeep3rV2Job.address);

    // Add to keep3rV2
    await keep3rV2.addJob(tendKeep3rV2Job.address);
    await keep3rV2.forceLiquidityCreditsToJob(tendKeep3rV2Job.address, e18.mul(10000));

    // Add strategies to job
    strategies = [
      {
        name: 'test',
        address: dummyStrategy.address,
        requiredAmount: 0,
        costToken: ZERO_ADDRESS,
        costPair: ZERO_ADDRESS,
      },
    ];

    // set reward multiplier
    await tendKeep3rV2Job.setRewardMultiplier(950);

    for (const strategy of strategies) {
      await tendKeep3rV2Job.addStrategy(
        dummyStrategy.address, // address _strategy,
        e18.mul(strategy.requiredAmount), // uint256 _requiredAmount,
        strategy.costToken, // address _costToken,
        strategy.costPair // address _costPair
      );
    }

    const jobStrategies = await tendKeep3rV2Job.strategies();
    expect(lowerCaseArray(jobStrategies)).to.be.deep.eq(lowerCaseArray(strategies.map((s) => s.address)));
  });

  it('Should work and get paid in bonded KP3R', async function () {
    // work
    await tendKeep3rV2Job.connect(keeper).work(strategies[0].address);

    expect(await tendKeep3rV2Job.callStatic.workable(strategies[0].address)).to.be.false;
  });

  it('Should change requirements', async function () {
    // Change req (bond == WETH)
    await tendKeep3rV2Job.connect(owner).setKeep3rRequirements(
      config.contracts.mainnet.wethToken.address, // address _bond,
      e18.mul(1), // 1 WETH required // uint256 _minBond,
      0, // uint256 _earned,
      0, // uint256 _age,
      true, // bool _onlyEOA,
    );
  });

  it('Should bond in WETH and get paid in bonded KP3R', async function () {
    await evm.advanceTimeAndBlock(6 * 60 * 60); // 6 hours

    // work
    await tendKeep3rV2Job.connect(anotherKeeper).work(strategies[0].address);

    expect(await tendKeep3rV2Job.callStatic.workable(strategies[0].address)).to.be.false;
  });
});