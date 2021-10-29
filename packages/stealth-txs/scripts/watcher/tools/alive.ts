import moment from 'moment';

const MAX_UNRESPONSIVE_TIME = moment.duration('5', 'seconds').as('milliseconds');

let aliveInterval: NodeJS.Timeout;

export const startCheck = (): void => {
  aliveInterval = setTimeout(dead, MAX_UNRESPONSIVE_TIME);
};

export const stillAlive = (): void => {
  clearTimeout(aliveInterval);
  startCheck();
};

const dead = (): void => {
  console.error('Aliveness check failed');
  process.exit(1);
};
