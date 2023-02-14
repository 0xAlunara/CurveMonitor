const fs = require("fs");
const axios = require("axios");
require("dotenv").config();

const ADDRESS_THREEPOOL = "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7";
const ADDRESS_TRICRYPTO_2 = "0xD51a44d3FaE010294C616388b506AcdA1bfAAE46";
const ADDRESS_sUSD_V2_SWAP = "0xA5407eAE9Ba41422680e2e00537571bcC53efBfD";

const options = {
  // Enable auto reconnection
  reconnect: {
    auto: true,
    delay: 89, // ms
    maxAttempts: 50,
    onTimeout: false,
  },
};

const Web3 = require("web3");
const web3HTTP = new Web3(new Web3.providers.HttpProvider(process.env.web3HTTP, options));

async function getContract(abi, address) {
  return new web3HTTP.eth.Contract(abi, address);
}

function getCurvePools() {
  const CURVE_JSON = JSON.parse(fs.readFileSync("curve_pool_data.json"));

  const CURVE_POOLS = [];

  for (const POOL in CURVE_JSON) {
    CURVE_POOLS.push(POOL);
  }
  return CURVE_POOLS;
}

function getPoolVersion(poolAddress) {
  const CURVE_JSON = JSON.parse(fs.readFileSync("curve_pool_data.json"));
  return CURVE_JSON[poolAddress].version;
}

function formatForPrint(someNumber) {
  someNumber = Math.abs(someNumber);
  if (someNumber > 100) {
    someNumber = Number(Number(someNumber).toFixed(0)).toLocaleString();
  } else if (someNumber > 5) {
    someNumber = Number(Number(someNumber).toFixed(2)).toLocaleString();
  } else {
    someNumber = Number(Number(someNumber).toFixed(3)).toLocaleString();
  }
  return someNumber;
}

function getCurrentTime() {
  const DATE = new Date();
  let hours = DATE.getHours();
  let minutes = DATE.getMinutes();
  let seconds = DATE.getSeconds();
  let milliseconds = DATE.getMilliseconds();

  hours = hours < 10 ? "0" + hours : hours;
  minutes = minutes < 10 ? "0" + minutes : minutes;
  seconds = seconds < 10 ? "0" + seconds : seconds;
  milliseconds = milliseconds < 100 ? "0" + milliseconds : milliseconds;

  return `${hours}:${minutes}:${seconds}:${milliseconds}`;
}

function getUnixtime(){
  return Math.floor(new Date().getTime() / 1000);
}

async function getABI(poolAddress) {
  let abiDataBase;
  try {
    abiDataBase = JSON.parse(fs.readFileSync("abi_db.json"));
  } catch (err) {
    console.log("err reading abi_db.json in utils.js", err);
  }

  const ABI = abiDataBase[poolAddress];

  if (!ABI) {
    const URL = "https://api.etherscan.io/api?module=contract&action=getabi&address=" + poolAddress + "&apikey=" + process.env.etherscanAPI_key;
    const ABI = (await axios.get(URL)).data.result;
    abiDataBase[poolAddress] = ABI;
    fs.writeFileSync("abi_db.json", JSON.stringify(abiDataBase, null, 4));
    return JSON.parse(ABI);
  } else {
    try {
      return JSON.parse(ABI);
    } catch (err) {
      return ABI;
    }
  }
}

function isNativeEthAddress(address) {
  return address.toLowerCase() === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
}

function isNullAddress(address) {
  return address.toLowerCase() === "0x0000000000000000000000000000000000000000";
}

function isCurveRegistryExchange(address) {
  return address.toLowerCase() === "0x55b916ce078ea594c10a874ba67ecc3d62e29822";
}

function is3CrvToken(address) {
  return address.toLowerCase() === "0x6c3f90f043a72fa612cbac8115ee7e52bde6e490";
}

function isCrvRenWSBTC(address) {
  return address.toLowerCase() === "0x075b1bb99792c9e1041ba13afef80c91a1e70fb3";
}

function isCrvFrax(address) {
  return address.toLowerCase() === "0x3175df0976dfa876431c2e9ee6bc45b65d3473cc";
}

function is3PoolDepositZap(address) {
  return address.toLowerCase() === "0xa79828df1850e8a3a3064576f380d90aecdd3359";
}

function isZapFor3poolMetapools(address) {
  return address.toLowerCase() === "0x97adc08fa1d849d2c48c5dcc1dab568b169b0267";
}

function isSwap(tx) {
  return tx === "classicCurveMonitor";
}

function isRemoval(tx) {
  return tx === "Removal";
}

function isDeposit(tx) {
  return tx === "Deposit";
}

function isTokenExchangeUnderlying(tx) {
  return tx === "TokenExchangeUnderlying";
}

// using the metaregistry to get the array which holds the tokenAddresses of the Tokens of the Pool
async function getCoins(poolAddress) {
  const CURVE_JSON = JSON.parse(fs.readFileSync("curve_pool_data.json"));
  if (CURVE_JSON[poolAddress]) {
    return CURVE_JSON[poolAddress].coins;
  } else {
    const CURVE_POOLS = getCurvePools();
    for (const POOL in CURVE_POOLS) {
      if (CURVE_POOLS[POOL].toLowerCase() === poolAddress) {
        return CURVE_JSON[CURVE_POOLS[POOL]].coins;
      }
    }
  }
}

// Function to retrieve the addresses of the effected token
async function getTokenAddress(poolAddress, id) {
  const COINS = await getCoins(poolAddress);
  return COINS[id];
}

async function findCoinId(poolAddress, tokenAddress) {
  for (let i = 0; i < 100; i++) {
    const RETURNED_ADDRESS = await getTokenAddress(poolAddress, i);
    if (RETURNED_ADDRESS.toUpperCase() === tokenAddress.toUpperCase()) return i;
    if (isNullAddress(RETURNED_ADDRESS)) return 0; // metapool coin case a la LUSD/3Pool
  }
}

async function getTokenDecimals(tokenAddress) {
  if (isNativeEthAddress(tokenAddress)) return 18;

  tokenAddress = tokenAddress.toLowerCase();
  const CURVE_JSON = JSON.parse(fs.readFileSync("curve_pool_data.json"));
  for (const [key, value] of Object.entries(CURVE_JSON)) {
    const INDEX = value.coins.map((str) => str.toLowerCase()).indexOf(tokenAddress);
    if (INDEX !== -1) {
      return value.decimals[INDEX];
    }
  }
  return null;
}

// using the metaregistry to get the LP Token Address from the Pool (used to spot transfer- "mint" -events)
async function getLpToken(poolAddress) {
  const CURVE_JSON = JSON.parse(fs.readFileSync("curve_pool_data.json"));
  return CURVE_JSON[poolAddress].lp_token;
}

async function getBasePool(poolAddress) {
  const CURVE_JSON = JSON.parse(fs.readFileSync("curve_pool_data.json"));
  return CURVE_JSON[poolAddress].base_pool;
}

function countUniqueTxHashes(arr) {
  const TX_HASHES = arr.map((obj) => obj.txHash);
  const UNIQUE_TX_HASHES = new Set(TX_HASHES);
  return UNIQUE_TX_HASHES.size;
}

async function getTokenName(tokenAddress) {
  if (tokenAddress === "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE") return "ETH";
  if (tokenAddress === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee") return "ETH";

  // local storage check up
  tokenAddress = tokenAddress.toLowerCase();
  const CURVE_JSON = JSON.parse(fs.readFileSync("curve_pool_data.json"));
  for (const [key, value] of Object.entries(CURVE_JSON)) {
    const INDEX = value.coins.map((str) => str.toLowerCase()).indexOf(tokenAddress.toLowerCase());
    if (INDEX !== -1) {
      return value.coin_names[INDEX];
    }
  }
  return null;
}

async function buildPoolName(poolAddress) {
  if (poolAddress === ADDRESS_THREEPOOL) return "3Pool";
  if (poolAddress === ADDRESS_sUSD_V2_SWAP) return "sUSD v2 Swap";
  if (poolAddress === ADDRESS_TRICRYPTO_2) return "tricrypto2";
  let poolName = "";
  let id = 0;
  while (true) {
    const TOKEN_ADDRESS = await getTokenAddress(poolAddress, id);
    if (isNullAddress(TOKEN_ADDRESS)) break;
    if (!TOKEN_ADDRESS) break;
    const TOKEN_NAME = await getTokenName(TOKEN_ADDRESS);
    id += 1;
    poolName += TOKEN_NAME + "/";
  }
  poolName = poolName.slice(0, -1);
  if (poolName.length >= 18) poolName = "Pool";

  if (!poolName || poolName === "undefined") {
    console.log("pool name fetch failed for", poolAddress);
    poolName = "Pool";
  }
  return poolName;
}

async function getCleanedTokenAmount(address, amount) {
  const DECIMALS = await getTokenDecimals(address);
  const CLEANED_TOKENS_SOLD = amount / 10 ** DECIMALS;
  return Number(CLEANED_TOKENS_SOLD);
}

module.exports = {
  getCurrentTime,
  getUnixtime,
  getABI,
  getCurvePools,
  getPoolVersion,
  isNativeEthAddress,
  isNullAddress,
  isCurveRegistryExchange,
  is3CrvToken,
  isCrvRenWSBTC,
  isCrvFrax,
  is3PoolDepositZap,
  isZapFor3poolMetapools,
  isSwap,
  isRemoval,
  isDeposit,
  isTokenExchangeUnderlying,
  formatForPrint,
  getCoins,
  getTokenAddress,
  findCoinId,
  getTokenDecimals,
  getLpToken,
  getBasePool,
  countUniqueTxHashes,
  getTokenName,
  buildPoolName,
  getCleanedTokenAmount
};
