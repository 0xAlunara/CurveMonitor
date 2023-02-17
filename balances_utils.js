const Web3 = require("web3");
const fs = require("fs");

require("dotenv").config();

const genericUtils = require("./generic_utils.js");
const getCurvePools = genericUtils.getCurvePools;
const getABI = genericUtils.getABI;

const web3CallUtils = require("./web3_call_utils.js");
const errHandler = web3CallUtils.errHandler;
const getContract = web3CallUtils.getContract;
const web3Call = web3CallUtils.web3Call;

const web3HttpLlamarpc = new Web3(new Web3.providers.HttpProvider("https://eth.llamarpc.com/rpc/" + process.env.web3_llamarpc));

function setLlamaRPC(abi, address) {
  return new web3HttpLlamarpc.eth.Contract(abi, address);
}

const CURVE_JSON = JSON.parse(fs.readFileSync("curve_pool_data.json"));

function roundNumber(num) {
  if (num >= 1000) return Number(num.toFixed(0));
  if (num < 1000) return Number(num.toFixed(1));
  if (num < 100) return Number(num.toFixed(2));
  if (num < 10) return Number(num.toFixed(3));
}

function bootBalancesJSON() {
  let balancesJSON;
  try {
    balancesJSON = JSON.parse(fs.readFileSync("balances.json"));
  } catch (err) {
    balancesJSON = {};
  }
  const POOLS = getCurvePools();
  for (const POOL_ADDRESS of POOLS) {
    if (balancesJSON[POOL_ADDRESS]) continue;
    balancesJSON[POOL_ADDRESS] = [];
  }
  fs.writeFileSync("balances.json", JSON.stringify(balancesJSON, null, 2));
}

// returns an arr with all blocknumbers which saw action for a given pool
function getRawBlocknumbers(POOL_ADDRESS) {
  const DATA_ALL = JSON.parse(fs.readFileSync("processed_tx_log_all.json"));
  const BLOCK_NUMBERS = DATA_ALL[POOL_ADDRESS].map((obj) => obj.blockNumber);
  return BLOCK_NUMBERS;
}

async function getPoolBalance(METAREGISTRY, POOL_ADDRESS, blockNumber) {
  // example: balances = ['18640063536133844603972293','18564920428085','17811701123312','16056764826637922459027923','0','0','0','0' ]
  let balances = await web3Call(METAREGISTRY, "get_balances", [POOL_ADDRESS], blockNumber);
  for (let i = 0; i < 12; i++) {
    try {
      balances = await web3Call(METAREGISTRY, "get_balances", [POOL_ADDRESS], blockNumber);
      break;
    } catch (error) {
      await errHandler(error);
    }
  }

  // example: balances = ['18640063536133844603972293','18564920428085','17811701123312','16056764826637922459027923' ]
  balances = balances.slice(0, -CURVE_JSON[POOL_ADDRESS].n_coins);

  // example: balances = [ 18640063,18564920,17811701,16056764 ]
  const DECIMALS = CURVE_JSON[POOL_ADDRESS].decimals;
  balances = balances.map((item, index) => {
    return roundNumber(item / 10 ** DECIMALS[index]);
  });

  return balances;
}

function findLastStoredUnixtimeInBalances(POOL_ADDRESS) {
  let lastStoredUnixtime;
  const BALANCES_JSON = JSON.parse(fs.readFileSync("balances.json"));
  try {
    lastStoredUnixtime = Number(Object.keys(BALANCES_JSON[POOL_ADDRESS][BALANCES_JSON[POOL_ADDRESS].length - 1])[0]);
  } catch (err) {
    lastStoredUnixtime = 0;
  }
  return lastStoredUnixtime;
}

function findLastStoredBlocknumberInBalances(POOL_ADDRESS) {
  const LAST_STORED_UNIXTIME = findLastStoredUnixtimeInBalances(POOL_ADDRESS);
  if (LAST_STORED_UNIXTIME === 0) return 0;
  const DATA_ALL = JSON.parse(fs.readFileSync("processed_tx_log_all.json"));
  const BLOCK_NUMBER = DATA_ALL[POOL_ADDRESS].find((tx) => tx.unixtime == LAST_STORED_UNIXTIME).blockNumber;
  return BLOCK_NUMBER;
}

// returns the number of blocks that had to be fetched. If 0, we know it is up to date. If it was more than 0, we repeat the cycle
async function fetchBalancesForPool(POOL_ADDRESS) {
  const DATA_ALL = JSON.parse(fs.readFileSync("processed_tx_log_all.json"));
  const BALANCES_JSON = JSON.parse(fs.readFileSync("balances.json"));

  const ADDRESS_METAREGISTRY = "0xF98B45FA17DE75FB1aD0e7aFD971b0ca00e379fC";
  const ABI_METAREGISTRY = await getABI(ADDRESS_METAREGISTRY);
  const METAREGISTRY = setLlamaRPC(ABI_METAREGISTRY, ADDRESS_METAREGISTRY);

  const LAST_STORED_BLOCK_NUMBER = findLastStoredBlocknumberInBalances(POOL_ADDRESS);

  const RAW_BLOCKNUMBERS = getRawBlocknumbers(POOL_ADDRESS);
  const index = RAW_BLOCKNUMBERS.indexOf(LAST_STORED_BLOCK_NUMBER);
  let blockNumbers = RAW_BLOCKNUMBERS.splice(index + 2);

  // removing dupes caused by multiple tx in the same block
  blockNumbers = blockNumbers.filter((num, index) => blockNumbers.indexOf(num) === index);

  const data = BALANCES_JSON[POOL_ADDRESS];

  let counter = 1;
  for (const blockNumber of blockNumbers) {
    let unixtime;
    DATA_ALL[POOL_ADDRESS].forEach((element) => {
      if (element.blockNumber === blockNumber) {
        unixtime = element.unixtime;
      }
    });
    const BALANCES = await getPoolBalance(METAREGISTRY, POOL_ADDRESS, blockNumber);
    data.push({ [unixtime]: BALANCES });

    // saving each 100 fetches
    if (counter % 10 === 0) {
      BALANCES_JSON[POOL_ADDRESS] = data;
      fs.writeFileSync("balances.json", JSON.stringify(BALANCES_JSON, null, 2));
      console.log(counter + "/" + blockNumbers.length, unixtime, BALANCES, POOL_ADDRESS);
    }
    counter += 1;
  }
  fs.writeFileSync("balances.json", JSON.stringify(BALANCES_JSON, null, 2));

  return blockNumbers.length;
}

function hasEntryForUnixTime(DATA, unixtime) {
  let start = 0;
  let end = DATA.length - 1;

  while (start <= end) {
    const mid = Math.floor((start + end) / 2);
    const midUnixtime = Object.keys(DATA[mid])[0];

    if (midUnixtime == unixtime) {
      return true;
    } else if (Number(DATA[mid][midUnixtime][0]) < unixtime) {
      start = mid + 1;
    } else {
      end = mid - 1;
    }
  }

  return false;
}

// extra set up because it needs a different web3 provider
async function fetchBalancesOnce(poolAddress, blockNumber) {
  const BALANCES_JSON = JSON.parse(fs.readFileSync("balances.json"));
  const DATA = BALANCES_JSON[poolAddress];

  let unixtime;
  const DATA_ALL = JSON.parse(fs.readFileSync("processed_tx_log_all.json"));
  DATA_ALL[poolAddress].forEach((element) => {
    if (element.blockNumber == blockNumber) {
      unixtime = element.unixtime;
    }
  });
  if (hasEntryForUnixTime(DATA, unixtime)) return [];

  const ADDRESS_METAREGISTRY = "0xF98B45FA17DE75FB1aD0e7aFD971b0ca00e379fC";
  const METAREGISTRY = await getContract(await getABI(ADDRESS_METAREGISTRY), ADDRESS_METAREGISTRY);
  let balances = await web3Call(METAREGISTRY, "get_balances", [poolAddress], blockNumber);
  const CURVE_JSON = JSON.parse(fs.readFileSync("curve_pool_data.json"));
  try {
    balances = balances.slice(0, -CURVE_JSON[poolAddress].n_coins);
  } catch (err) {
    console.log("err at fetchBalancesOnce in balances_utils, poolAddress", poolAddress, "blockNumber", blockNumber, "balances", balances, err);
  }
  const DECIMALS = CURVE_JSON[poolAddress].decimals;
  balances = balances.map((item, index) => {
    return roundNumber(item / 10 ** DECIMALS[index]);
  });
  const ENTRY = { [unixtime]: balances };
  DATA.push(ENTRY);
  fs.writeFileSync("balances.json", JSON.stringify(BALANCES_JSON, null, 2));
  return ENTRY;
}

async function balancesCollectionMain(poolAddress) {
  bootBalancesJSON();
  while (true) {
    const CHECK = await fetchBalancesForPool(poolAddress);
    // check is used to repeat the balances collection cycle as long as the last cycle wasn't an empty fetch => up to date
    if (CHECK === 0) break;
  }
  console.log("collection of balances complete for pool", poolAddress);
}

// used to forward balances-array to the client
function readBalancesArray(poolAddress) {
  const BALANCES_JSON = JSON.parse(fs.readFileSync("balances.json"));
  return BALANCES_JSON[poolAddress];
}

module.exports = {
  fetchBalancesForPool,
  fetchBalancesOnce,
  findLastStoredBlocknumberInBalances,
  findLastStoredUnixtimeInBalances,
  getPoolBalance,
  getRawBlocknumbers,
  bootBalancesJSON,
  roundNumber,
  balancesCollectionMain,
  readBalancesArray,
};
