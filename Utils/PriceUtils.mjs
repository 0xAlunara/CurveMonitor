import Web3 from "web3";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

import { getCurvePools, getABI } from "./GenericUtils.mjs";
import { errHandler, getContract, web3Call } from "./Web3CallUtils.mjs";

// to deal with compute units / s
const MAX_RETRIES = 12;

const web3HttpLlamarpc = new Web3(new Web3.providers.HttpProvider("https://eth.llamarpc.com/rpc/" + process.env.web3_llamarpc));

function setLlamaRPC(abi, address) {
  return new web3HttpLlamarpc.eth.Contract(abi, address);
}

function bootPriceJSON() {
  const CURVE_JSON = JSON.parse(fs.readFileSync("./JSON/CurvePoolData.json"));
  let priceJSON;
  try {
    priceJSON = JSON.parse(fs.readFileSync("./JSON/Prices.json"));
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
  fs.writeFileSync("./JSON/Prices.json", JSON.stringify(priceJSON, null, 2));
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
  const DATA_ALL = JSON.parse(fs.readFileSync("./JSON/ProcessedTxLogAll.json"));
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
      fs.writeFileSync("./JSON/Prices.json", JSON.stringify(PRICE_JSON, null, 2));
    }
    counter += 1;
  }

  // final save at end of collection for a certain combination
  fs.writeFileSync("./JSON/Prices.json", JSON.stringify(PRICE_JSON, null, 2));
  return blockNumbers.length;
}

async function priceCollectionAllCombinations(poolAddress) {
  bootPriceJSON();

  // the stored JSON with the processed tx-log
  const DATA_ALL = JSON.parse(fs.readFileSync("./JSON/ProcessedTxLogAll.json"));

  // JSON with the combinations of pool token
  const PRICE_JSON = JSON.parse(fs.readFileSync("./JSON/Prices.json"));

  const CHECK = [];

  const CURVE_JSON = JSON.parse(fs.readFileSync("./JSON/CurvePoolData.json"));

  // eg sUSD in DAI, USDT in sUSD, ...
  for (const combination of PRICE_JSON[poolAddress]) {
    const state = await priceCollectionOneCombination(poolAddress, combination, DATA_ALL, PRICE_JSON, CURVE_JSON);
    CHECK.push(state);
  }
  return CHECK;
}

async function savePriceEntry(poolAddress, blockNumber, unixtime) {
  const PRICE_JSON = JSON.parse(fs.readFileSync("./JSON/Prices.json"));
  const CURVE_JSON = JSON.parse(fs.readFileSync("./JSON/CurvePoolData.json"));
  const CONTRACT = await getContract(await getABI(poolAddress), poolAddress);
  let res = [];
  for (const COMBINATION of PRICE_JSON[poolAddress]) {
    const HAS_UNIXTIME = COMBINATION.data.some((item) => {
      return Object.keys(item)[0] == unixtime;
    });
    if (HAS_UNIXTIME) continue;

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
    fs.writeFileSync("./JSON/Prices.json", JSON.stringify(PRICE_JSON, null, 2));
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
  const PRICE_JSON = JSON.parse(fs.readFileSync("./JSON/Prices.json"));
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

async function convertToUSD(name, amount) {
  const conversionRates = {
    sUSD: 1,
    USDC: 1,
    USDT: 1,
    DAI: 1,
    BUSD: 1,
    FRAX: 1,
    USDP: 1,
    crvFRAX: 1,
    BTC: btcPrice,
    WBTC: btcPrice,
    sBTC: btcPrice,
    ETH: ethPrice,
    WETH: ethPrice,
    stETH: ethPrice,
    wstETH: ethPrice,
    iDA: 0.01,
    iUSDC: 0.01,
    iUSDT: 0.01,
    "3Crv": async () => await get3CrvPrice(),
    CRV: crvPrice,
    agEUR: eurPrice,
    ibEUR: eurPrice,
    sEUR: eurPrice,
    EURS: eurPrice,
    EURN: eurPrice,
    EURT: eurPrice,
  };

  let conversionRate = conversionRates[name];
  if (typeof conversionRate === "function") {
    conversionRate = await conversionRate();
  }
  return conversionRate ? amount * conversionRate : undefined;
}

async function get3CrvPrice() {
  const ABI_FRAX_3CRV = await getABI("ABI_FRAX_3CRV");
  const FRAX_3CRV = await getContract(ABI_FRAX_3CRV, "0xd632f22692FaC7611d2AA1C0D552930D43CAEd3B");
  return Number((await web3Call(FRAX_3CRV, "get_dy", [1, 0, "1000000000000000000"])) / 1e18);
}

const ADDRESS_TRICRYPTO_2 = "0xD51a44d3FaE010294C616388b506AcdA1bfAAE46";
const TRICRYPTO_2 = await getContract(await getABI("ABI_TRICRYPTO"), ADDRESS_TRICRYPTO_2);
const CHAINLINK_EUR_USD_PRICE_FEED = await getContract(await getABI("ABI_Chainlink_EUR_USD_Price_Feed"), "0xb49f677943BC038e9857d61E7d053CaA2C1734C1");

// updating prices
let eurPrice = Number((await web3Call(CHAINLINK_EUR_USD_PRICE_FEED, "latestAnswer", [])) / 1e8);
let btcPrice = Number((await web3Call(TRICRYPTO_2, "price_oracle", [0])) / 1e18);
let ethPrice = Number((await web3Call(TRICRYPTO_2, "price_oracle", [1])) / 1e18);
let crvPrice = ethPrice / (await getPriceFromUniswapV3("0x4c83a7f819a5c37d64b4c5a2f8238ea082fa1f4e"));

async function updatePrices() {
  eurPrice = Number((await web3Call(CHAINLINK_EUR_USD_PRICE_FEED, "latestAnswer", [])) / 1e8);
  ethPrice = Number((await web3Call(TRICRYPTO_2, "price_oracle", [1])) / 1e18);
  btcPrice = Number((await web3Call(TRICRYPTO_2, "price_oracle", [0])) / 1e18);
  crvPrice = ethPrice / (await getPriceFromUniswapV3("0x4c83a7f819a5c37d64b4c5a2f8238ea082fa1f4e"));
}
setInterval(updatePrices, 1 * 60 * 1000);

async function getPriceFromUniswapV3(poolAddress) {
  const ABI_UNISWAP_V3 = await getABI("ABI_UNISWAP_V3");
  const CONTRACT = await getContract(ABI_UNISWAP_V3, poolAddress);
  const slot0 = await web3Call(CONTRACT, "slot0", []);
  try {
    const sqrtPriceX96 = slot0.sqrtPriceX96;
    return sqrtPriceX96 ** 2 / 2 ** 192;
  } catch (error) {
    console.log(error.message, poolAddress, slot0);
  }
}

export {
  priceCollectionAllCombinations,
  priceCollectionOneCombination,
  findLastStoredBlocknumberForCombination,
  findLastStoredUnixtimeForCombination,
  bootPriceJSON,
  priceCollectionMain,
  savePriceEntry,
  readPriceArray,
  convertToUSD,
};
