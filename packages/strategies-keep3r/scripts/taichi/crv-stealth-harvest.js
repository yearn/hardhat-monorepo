const { Confirm, NumberPrompt, Select, Toggle } = require('enquirer');
const hre = require('hardhat');
const ethers = hre.ethers;
const config = require('../../.config.json');
const { gwei, e18, bnToDecimal } = require('../../utils/web3-utils');
const taichi = require('../../utils/taichi');
const registryData = require('../../utils/v1-registry-data.json');

const selectStrategyPrompt = new Select({
  name: 'strategy',
  message: 'Select a crv strategy to stealth harvest',
  choices: ['ycrv', 'busd', 'sbtc', 'pool3', 'comp', 'gusd3crv', 'musd', 'usdn', 'susd', 'link'],
});
const checkEarnVaultPrompt = new Toggle({
  message: 'Check vault.earn tx first?',
  enabled: 'Yes',
  disabled: 'No',
});
const earnVaultPrompt = new Toggle({
  message: 'Send vault.earn tx first?',
  enabled: 'Yes',
  disabled: 'No',
});
const customGasPrompt = new Toggle({
  message: 'Send custom gasPrice?',
  enabled: 'Yes',
  disabled: 'No',
});
const gasPricePrompt = new NumberPrompt({
  name: 'number',
  message: 'type a custom gasPrice in gwei',
});
const customNoncePrompt = new Toggle({
  message: 'Send custom nonce?',
  enabled: 'Yes',
  disabled: 'No',
});
const sendTxPrompt = new Confirm({ message: 'Send tx?' });

async function main() {
  await hre.run('compile');
  await run();
}

function run() {
  return new Promise(async (resolve, reject) => {
    try {
      const [owner] = await ethers.getSigners();
      const provider = ethers.getDefaultProvider();
      const signer = new ethers.Wallet('0x' + config.accounts.mainnet.privateKey).connect(provider);

      // Setup crv strategy keep3r
      const crvStrategyKeep3r = await ethers.getContractAt('CrvStrategyKeep3rJob', config.contracts.mainnet.jobs.crvStrategyKeep3rJob, signer);

      const strategy = await selectStrategyPrompt.run();
      if (!strategy) reject('no strategy');
      console.log('using strategy:', strategy);

      // Setup crv strategy
      const strategyContract = await ethers.getContractAt('StrategyCurveYVoterProxy', config.contracts.mainnet[strategy].address, signer);

      const strategist = await strategyContract.strategist();
      console.log(`${strategy}.strategist():`, strategist == crvStrategyKeep3r.address ? 'crvStrategyKeep3r' : strategist);

      console.log(
        `calculateHarvest(${strategy})`,
        (await crvStrategyKeep3r.callStatic.calculateHarvest(strategyContract.address)).div(e18).toString()
      );

      const checkVaultEarnTx = await checkEarnVaultPrompt.run();
      let sendVaultEarnTx = false;
      if (checkVaultEarnTx) {
        // Setup vault
        const vaultData = registryData.find((data) => data.strategy === strategyContract.address);
        const vault = {
          contract: await ethers.getContractAt('IV1Vault', vaultData.address, owner),
        };
        vault.token = await vault.contract.token();
        vault.tokenContract = await ethers.getContractAt('ERC20Mock', vault.token);
        vault.tokenSymbol = await vault.tokenContract.symbol();
        vault.tokenDecimals = await vault.tokenContract.decimals();
        vault.available = await vault.contract.available();
        vault.decimals = await vault.contract.decimals();
        // TODO print available with token decimals and token name
        console.log(vault.tokenSymbol, 'available in vault:', bnToDecimal(vault.available, vault.tokenDecimals));
        await vault.contract.earn();
        console.log('after earn:', bnToDecimal(await vault.contract.available(), vault.tokenDecimals));

        sendVaultEarnTx = await earnVaultPrompt.run();
      }

      const gasResponse = await taichi.getGasPrice();
      console.log('taichi gasPrices:', {
        fast: Math.floor(gasResponse.data.fast / 10 ** 9),
        standard: Math.floor(gasResponse.data.standard / 10 ** 9),
        slow: Math.floor(gasResponse.data.slow / 10 ** 9),
      });
      let gasPrice;
      if (await customGasPrompt.run()) {
        gasPrice = await gasPricePrompt.run();
        console.log('using custom gasPrice in gwei:', gasPrice);
        gasPrice = gwei.mul(gasPrice);
      } else {
        gasPrice = ethers.BigNumber.from(gasResponse.data.fast);
        console.log('gasPrice in gwei:', gasPrice.div(gwei).toNumber());
      }

      const maxGwei = 220;
      if (gasPrice.gt(gwei.mul(maxGwei))) {
        reject(`gas price > ${maxGwei}gwei`);
      }

      let nonce = ethers.BigNumber.from(await signer.getTransactionCount());
      if (await customNoncePrompt.run()) {
        const noncePrompt = new NumberPrompt({
          name: 'number',
          message: `type a custom nonce, current is ${nonce}`,
        });
        nonce = await noncePrompt.run();
        console.log('using custom nonce:', nonce);
      } else {
        console.log('using account nonce:', nonce.toNumber());
      }

      let rawMessage;
      if (sendVaultEarnTx) {
        rawMessage = await vault.contract.connect(signer).populateTransaction.earn({
          gasPrice,
          nonce,
        });
      } else {
        rawMessage = await crvStrategyKeep3r.populateTransaction.forceWork(strategyContract.address, {
          gasPrice,
          nonce,
        });
      }

      console.log(rawMessage);

      const signedMessage = await signer.signTransaction(rawMessage);

      // TODO prompt and Send tx on forknet and see if it rejects

      if ((await sendTxPrompt.run()) == false) {
        console.log('not sending tx, bye :)');
        return resolve();
      }

      const res = await taichi.sendPrivateTransaction(signedMessage);
      if (res.error) {
        return reject(res.error.message);
      }

      const privateTxHash = res.result;
      console.log({ privateTxHash });

      if (!privateTxHash) {
        return reject('no privateTxHash from taichi');
      }
      let received;
      while (!received) {
        await new Promise((r) => setTimeout(r, 2000)); // sleeps 2s
        const query = await taichi.queryPrivateTransaction(privateTxHash);
        received = query.success && query.obj.status == 'pending';
        if (received) {
          console.log('received tx:');
          console.log(query.obj);
        }
      }

      resolve();
    } catch (err) {
      reject(err);
    }
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
