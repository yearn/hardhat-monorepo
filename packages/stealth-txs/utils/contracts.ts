export type DeployedNetwork = 'mainnet' | 'goerli' | 'ropsten' | 'rinkeby';

export const stealthVault: { [key in DeployedNetwork]: string } = {
  mainnet: '0xC454F4E1DDB39c8De9663287D52b0E4Feb4cA45E',
  goerli: '0xbBF61a6F7BC3F00B6c13c5c3Eb4BD3640B8F05A1',
  rinkeby: '0x5A4ECb9fA73A241F5fE2F61F72574E3Ecc4Fc720',
  ropsten: '0x5ce667c15ec23cD40262169Bf8e75cc97D23e03d',
};

export const stealthVault2: { [key in DeployedNetwork]: string } = {
  mainnet: '0xde2fe402a285363283853bec903d134426db3ff7',
  goerli: '',
  rinkeby: '',
  ropsten: '',
};

export const stealthRelayer: { [key in DeployedNetwork]: string } = {
  mainnet: '0x0a61c2146A7800bdC278833F21EBf56Cd660EE2a',
  goerli: '0xEE1353447E237E161BAbDB783fBA64FC93453cAE',
  rinkeby: '0x03900f1cdEf9355a121D84DeaC414799dB51Dc05',
  ropsten: '0x635E0E1307b2446aC337622c7D3A7C62CaEe8E24',
};

export const stealthERC20: { [key in DeployedNetwork]: string } = {
  mainnet: '',
  goerli: '0x19309f5b35A7da7f31Ec5e1C97E2e211926cdcDa',
  rinkeby: '0x01489f5881A4C436793cb48434eAA2D488D83C07',
  ropsten: '',
};
