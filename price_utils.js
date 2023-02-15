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

// to deal with compute units / s
const MAX_RETRIES = 12;

const web3HttpLlamarpc = new Web3(new Web3.providers.HttpProvider("https://eth.llamarpc.com/rpc/" + process.env.web3_llamarpc));

function setLlamaRPC(abi, address) {
  return new web3HttpLlamarpc.eth.Contract(abi, address);
}

function bootPriceJSON() {
  const CURVE_JSON = JSON.parse(fs.readFileSync("curve_pool_data.json"));
  let priceJSON;
  try {
    priceJSON = JSON.parse(fs.readFileSync("prices.json"));
  } catch (err) {
    priceJSON = {};
  }

  const POOLS = getCurvePools();
  for (const POOL_ADDRESS of POOLS) {
    if (priceJSON[POOL_ADDRESS]) continue;
    const ORIGNIAL_ARRAY = [];
    const REVERSED_ARRAY = [];
    const nameArray = CURVE_JSON[POOL_ADDRESS].coin_names;
    for (let i = 0; i < nameArray.length; i++) {
      for (let j = i + 1; j < nameArray.length; j++) {
        ORIGNIAL_ARRAY.push({
          type: "original",
          priceOf: nameArray[i],
          priceIn: nameArray[j],
          data: [],
        });
        REVERSED_ARRAY.push({
          type: "reversed",
          priceOf: nameArray[j],
          priceIn: nameArray[i],
          data: [],
        });
      }
    }
    const FINAL_ARRAY = ORIGNIAL_ARRAY.concat(REVERSED_ARRAY);
    priceJSON[POOL_ADDRESS] = FINAL_ARRAY;
  }
  fs.writeFileSync("prices.json", JSON.stringify(priceJSON, null, 4));
}

function findLastStoredUnixtimeForCombination(poolAddress, combination, priceJSON) {
  const PRICE_OF = combination.priceOf;
  const PRICE_IN = combination.priceIn;
  const PAIR_ID = priceJSON[poolAddress].findIndex((item) => {
    return item.priceOf === PRICE_OF && item.priceIn === PRICE_IN;
  });
  const DATA = priceJSON[poolAddress][PAIR_ID].data;
  if (DATA.length === 0) return 0;
  return Number(Object.keys(DATA[DATA.length - 1])[0]);
}

function findLastStoredBlocknumberForCombination(poolAddress, combination, priceJSON) {
  const LAST_STORED_UNIXTIME_FOR_COMBINATION = findLastStoredUnixtimeForCombination(poolAddress, combination, priceJSON);
  if (LAST_STORED_UNIXTIME_FOR_COMBINATION === 0) return 0;
  const DATA_ALL = JSON.parse(fs.readFileSync("processed_tx_log_all.json"));
  const BLOCK_NUMBER = DATA_ALL[poolAddress].find((tx) => tx.unixtime == LAST_STORED_UNIXTIME_FOR_COMBINATION).blockNumber;
  return BLOCK_NUMBER;
}

// for one pool for one specific token-combination (eg sUSD price in USDC), fetches historical prices
// input is the json with the processed tx-log, where the blockNumbers are used as relevant blocks to fetch the prices for
// stores the result as a json in a file
async function priceCollectionOneCombination(poolAddress, combination, dataALL, PRICE_JSON, CURVE_JSON) {
  const CONTRACT = setLlamaRPC(await getABI(poolAddress), poolAddress);
  const PRICE_OF = combination.priceOf;
  const PRICE_IN = combination.priceIn;

  // pairID is inside price.json, at which place the token-combination is located. example: {"priceOf": "DAI","priceIn": "USDC"},{"priceOf": "DAI","priceIn": "USDT"}
  const PAIR_ID = PRICE_JSON[poolAddress].findIndex((item) => {
    return item.priceOf === PRICE_OF && item.priceIn === PRICE_IN;
  });

  const COIN_ID_PRICE_OF = CURVE_JSON[poolAddress].coin_names.indexOf(PRICE_OF);
  const DECIMALS_PRICE_OF = CURVE_JSON[poolAddress].decimals[COIN_ID_PRICE_OF];
  let dx = "1";
  for (let i = 0; i < DECIMALS_PRICE_OF; i++) {
    dx += "0";
  }

  const COIN_ID_PRICE_IN = CURVE_JSON[poolAddress].coin_names.indexOf(PRICE_IN);

  // in case the prices got fetched for price coin0 in coin1, and we want the price of coin1 in coin0
  // pairIdOriginal is the index of the coin0 in coin1 pair in the array (will get used later to invert the price on)
  let pairIdOriginal;
  let priceArrayOriginal;
  if (combination.type === "reversed") {
    pairIdOriginal = PRICE_JSON[poolAddress].findIndex((item) => {
      return item.priceIn === PRICE_OF && item.priceOf === PRICE_IN;
    });
    priceArrayOriginal = PRICE_JSON[poolAddress][pairIdOriginal].data;
  }

  const DATA = PRICE_JSON[poolAddress][PAIR_ID].data;

  // blockNumbers will be the array of missing blocks, input being the tx-logs
  let blockNumbers = dataALL[poolAddress].map((obj) => obj.blockNumber);
  const LAST_STORED_BLOCK_NUMBER_FOR_COMBINATION = findLastStoredBlocknumberForCombination(poolAddress, combination, PRICE_JSON);
  const INDEX = blockNumbers.indexOf(LAST_STORED_BLOCK_NUMBER_FOR_COMBINATION);
  blockNumbers = blockNumbers.splice(INDEX + 1);

  // removing dupes caused by multiple tx in the same block
  blockNumbers = blockNumbers.filter((num, index) => blockNumbers.indexOf(num) === index);

  let counter = 1;
  for (const BLOCK_NUMBER of blockNumbers) {
    let unixtime;
    dataALL[poolAddress].forEach((element) => {
      if (element.blockNumber === BLOCK_NUMBER) {
        unixtime = element.unixtime;
      }
    });

    if (!hasEntryForUnixTime(combination, unixtime)) return 0;

    let dy;
    if (combination.type === "original") {
      dy = await web3Call(CONTRACT, "get_dy", [COIN_ID_PRICE_OF, COIN_ID_PRICE_IN, dx], BLOCK_NUMBER);
      dy = dy / 10 ** CURVE_JSON[poolAddress].decimals[COIN_ID_PRICE_IN];
      if (dy == null) {
        console.log("dy = null COIN_ID_PRICE_OF", COIN_ID_PRICE_OF, "COIN_ID_PRICE_IN", COIN_ID_PRICE_IN, "dx", dx, "BLOCK_NUMBER", BLOCK_NUMBER);
      } else {
        DATA.push({ [unixtime]: dy });
      }
    }

    if (combination.type === "reversed") {
      dy = priceArrayOriginal.find((item) => Object.keys(item)[0] == unixtime)[unixtime];
      if (dy) {
        dy = 1 / dy;
        DATA.push({ [unixtime]: dy });
      }
    }

    // saving each 100 fetches
    if (counter % 100 === 0) {
      console.log(counter + "/" + blockNumbers.length, " | ", PRICE_OF + "/" + PRICE_IN, " | unixtime", unixtime, " | dy", dy);
      PRICE_JSON[poolAddress][PAIR_ID].data = DATA;
      fs.writeFileSync("prices.json", JSON.stringify(PRICE_JSON, null, 4));
    }
    counter += 1;
  }

  // final save at end of collection for a certain combination
  fs.writeFileSync("prices.json", JSON.stringify(PRICE_JSON, null, 4));
  return blockNumbers.length;
}

async function priceCollectionAllCombinations(poolAddress) {
  bootPriceJSON();

  // the stored JSON with the processed tx-log
  const DATA_ALL = JSON.parse(fs.readFileSync("processed_tx_log_all.json"));

  // JSON with the combinations of pool token
  const PRICE_JSON = JSON.parse(fs.readFileSync("prices.json"));

  const CHECK = [];

  const CURVE_JSON = JSON.parse(fs.readFileSync("curve_pool_data.json"));

  // eg sUSD in DAI, USDT in sUSD, ...
  for (const combination of PRICE_JSON[poolAddress]) {
    const state = await priceCollectionOneCombination(poolAddress, combination, DATA_ALL, PRICE_JSON, CURVE_JSON);
    CHECK.push(state);
  }
  return CHECK;
}

async function savePriceEntry(poolAddress, blockNumber, unixtime) {
  bootPriceJSON();
  const PRICE_JSON = JSON.parse(fs.readFileSync("prices.json"));
  let res = [];
  for (const COMBINATION of PRICE_JSON[poolAddress]) {
    const HAS_UNIXTIME = COMBINATION.data.some((item) => {
      return Object.keys(item)[0] == unixtime;
    });
    if (HAS_UNIXTIME) continue;

    const CURVE_JSON = JSON.parse(fs.readFileSync("curve_pool_data.json"));
    const CONTRACT = await getContract(await getABI(poolAddress), poolAddress);
    const PRICE_OF = COMBINATION.priceOf;
    const PRICE_IN = COMBINATION.priceIn;
    const NAME_COMBO = [PRICE_OF, PRICE_IN];

    // pairID is inside price.json, and which place the token-combination is located. example: {"priceOf": "DAI","priceIn": "USDC"},{"priceOf": "DAI","priceIn": "USDT"}
    const PAIR_ID = PRICE_JSON[poolAddress].findIndex((item) => {
      return item.priceOf === PRICE_OF && item.priceIn === PRICE_IN;
    });

    const COIN_ID_PRICE_OF = CURVE_JSON[poolAddress].coin_names.indexOf(PRICE_OF);
    const DECIMALS_PRICE_OF = CURVE_JSON[poolAddress].decimals[COIN_ID_PRICE_OF];
    let dx = "1";
    for (let i = 0; i < DECIMALS_PRICE_OF; i++) {
      dx += "0";
    }

    const COIN_ID_PRICE_IN = CURVE_JSON[poolAddress].coin_names.indexOf(PRICE_IN);

    // in case the prices got fetched for price coin0 in coin1, and we want the price of coin1 in coin0
    // pairIdOriginal is the index of the coin0 in coin1 pair in the array (will get used later to invert the price on)
    let pairIdOriginal;
    let priceArrayOriginal;
    if (COMBINATION.type === "reversed") {
      pairIdOriginal = PRICE_JSON[poolAddress].findIndex((item) => {
        return item.priceIn === PRICE_OF && item.priceOf === PRICE_IN;
      });
      priceArrayOriginal = PRICE_JSON[poolAddress][pairIdOriginal].data;
    }

    const DATA = PRICE_JSON[poolAddress][PAIR_ID].data;

    if (COMBINATION.type === "original") {
      let dy;
      for (let i = 0; i < MAX_RETRIES; i++) {
        try {
          dy = await web3Call(CONTRACT, "get_dy", [COIN_ID_PRICE_OF, COIN_ID_PRICE_IN, dx], blockNumber);
          break;
        } catch (error) {
          await errHandler(error);
        }
      }
      dy = dy / 10 ** CURVE_JSON[poolAddress].decimals[COIN_ID_PRICE_IN];
      if (dy == null) {
        console.log("dy = null COIN_ID_PRICE_OF", COIN_ID_PRICE_OF, "COIN_ID_PRICE_IN", COIN_ID_PRICE_IN, "dx", dx, "BLOCK_NUMBER", blockNumber);
      } else {
        const ENTRY = { [unixtime]: dy };
        DATA.push(ENTRY);
        res.push({ [NAME_COMBO]: ENTRY });
      }
    }

    if (COMBINATION.type === "reversed") {
      let dy;
      try {
        dy = priceArrayOriginal.find((item) => Object.keys(item)[0] == unixtime)[unixtime];
      } catch (err) {
        console.log("dy not found for price of", COMBINATION.priceOf, "in", COMBINATION.priceIn, "at unixtime", unixtime);
      }
      if (dy == null || !dy) {
        console.log("dy = null COIN_ID_PRICE_OF", COIN_ID_PRICE_OF, "COIN_ID_PRICE_IN", COIN_ID_PRICE_IN, "dx", dx, "BLOCK_NUMBER", blockNumber);
      } else {
        dy = 1 / dy;
        const ENTRY = { [unixtime]: dy };
        DATA.push(ENTRY);
        res.push({ [NAME_COMBO]: ENTRY });
      }
    }

    PRICE_JSON[poolAddress][PAIR_ID].data = DATA;
    fs.writeFileSync("prices.json", JSON.stringify(PRICE_JSON, null, 4));
  }
  return res;
}

async function priceCollectionMain(poolAddress) {
  while (true) {
    const check = await priceCollectionAllCombinations(poolAddress);
    // check is used to repeat the price collection cycle as long as the last cycle wasn't an empty fetch => up to date
    if (check.every((element) => element === 0)) break;
  }
  console.log("collection of prices complete for pool", poolAddress);
}

// used to forward the correct priceOf priceIn price-array to the client
function readPriceArray(poolAddress, priceOf, priceIn) {
  const PRICE_JSON = JSON.parse(fs.readFileSync("prices.json"));
  const COMBINATION_ID = PRICE_JSON[poolAddress].findIndex((item) => {
    return item.priceOf === priceOf && item.priceIn === priceIn;
  });
  const entry = PRICE_JSON[poolAddress][COMBINATION_ID];
  return entry.data;
}

function hasEntryForUnixTime(combination, unixtime) {
  const priceEntries = combination.data || [];
  if (binarySearch(priceEntries, unixtime)) {
    return true;
  }
  return false;
}

function binarySearch(arr, x) {
  let left = 0;
  let right = arr.length - 1;
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (arr[mid][x] === undefined) {
      if (x < Object.keys(arr[mid])[0]) {
        right = mid - 1;
      } else {
        left = mid + 1;
      }
    } else {
      return true;
    }
  }
  return false;
}

module.exports = {
  priceCollectionAllCombinations,
  priceCollectionOneCombination,
  findLastStoredBlocknumberForCombination,
  findLastStoredUnixtimeForCombination,
  bootPriceJSON,
  priceCollectionMain,
  savePriceEntry,
  readPriceArray,
};
