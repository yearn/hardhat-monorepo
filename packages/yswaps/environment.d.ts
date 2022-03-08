import { SUPPORTED_NETWORKS } from '../commons/utils/network';
declare namespace NodeJS {
  export interface ProcessEnv {
    HARDHAT_DEPLOY_FORK: SUPPORTED_NETWORKS;
  }
}