import { createRequire } from "module";
var require = createRequire(import.meta.url);

import { Server } from "socket.io";

/* eslint-disable no-debugger, quote-props */
/* eslint-disable no-debugger, object-shorthand */

const fs = require("fs");
const https = require("https");
const Web3 = require("web3");

const tempTxHashStorage = [];

require("dotenv").config();

const genericUtils = require("./generic_utils.js");
const getCurrentTime = genericUtils.getCurrentTime;
const getUnixtime = genericUtils.getUnixtime;
const getABI = genericUtils.getABI;
const getCurvePools = genericUtils.getCurvePools;
const isNativeEthAddress = genericUtils.isNativeEthAddress;
const isNullAddress = genericUtils.isNullAddress;
const isCurveRegistryExchange = genericUtils.isCurveRegistryExchange;
const is3CrvToken = genericUtils.is3CrvToken;
const isCrvRenWSBTC = genericUtils.isCrvRenWSBTC;
const isCrvFrax = genericUtils.isCrvFrax;
const is3PoolDepositZap = genericUtils.is3PoolDepositZap;
const isZapFor3poolMetapools = genericUtils.isZapFor3poolMetapools;
const isSwap = genericUtils.isSwap;
const isRemoval = genericUtils.isRemoval;
const isDeposit = genericUtils.isDeposit;
const isTokenExchangeUnderlying = genericUtils.isTokenExchangeUnderlying;
const formatForPrint = genericUtils.formatForPrint;
const getTokenAddress = genericUtils.getTokenAddress;
const countUniqueTxHashes = genericUtils.countUniqueTxHashes;
const getTokenName = genericUtils.getTokenName;
const buildPoolName = genericUtils.buildPoolName;
const getCleanedTokenAmount = genericUtils.getCleanedTokenAmount;

const web3CallUtils = require("./web3_call_utils.js");
const setProvider = web3CallUtils.setProvider;
const getContract = web3CallUtils.getContract;
const web3Call = web3CallUtils.web3Call;
const getTx = web3CallUtils.getTx;
const getCurrentBlockNumber = web3CallUtils.getCurrentBlockNumber;
const getBlock = web3CallUtils.getBlock;
const getBlockUnixtime = web3CallUtils.getBlockUnixtime;
const getTokenTransfers = web3CallUtils.getTokenTransfers;
const errHandler = web3CallUtils.errHandler;
const isCupsErr = web3CallUtils.isCupsErr;
const checkForTokenExchange = web3CallUtils.checkForTokenExchange;
const checkForTokenExchangeUnderlying = web3CallUtils.checkForTokenExchangeUnderlying;
const getPriceFromUniswapV3 = web3CallUtils.getPriceFromUniswapV3;

const storageUtils = require("./storage_utils.js");
const saveTxEntry = storageUtils.saveTxEntry;
const findLastProcessedEvent = storageUtils.findLastProcessedEvent;
const collection = storageUtils.collection;
const getStartBlock = storageUtils.getStartBlock;

const transactionLogicUtils = require("./transaction_logic_utils.js");
const getDeltaMevBot = transactionLogicUtils.getDeltaMevBot;
const tokenExchangeCaseMultiple = transactionLogicUtils.tokenExchangeCaseMultiple;
const tokenExchangeCase3Pool = transactionLogicUtils.tokenExchangeCase3Pool;
const tokenExchangeCase3BtcMetapool = transactionLogicUtils.tokenExchangeCase3BtcMetapool;
const tokenExchangeCaseFraxbp = transactionLogicUtils.tokenExchangeCaseFraxbp;
const tokenExchangeCaseSingle = transactionLogicUtils.tokenExchangeCaseSingle;
const victimTxCaseExchangeUnderlying = transactionLogicUtils.victimTxCaseExchangeUnderlying;
const victimTxCaseTokenExchangeUnderlying = transactionLogicUtils.victimTxCaseTokenExchangeUnderlying;
const victimTxCaseDeposit = transactionLogicUtils.victimTxCaseDeposit;
const victimTxCaseRemoval = transactionLogicUtils.victimTxCaseRemoval;
const victimTxCaseSwap = transactionLogicUtils.victimTxCaseSwap;

// utils for price-data
const priceUtils = require("./price_utils.js");
const priceCollectionMain = priceUtils.priceCollectionMain;
const savePriceEntry = priceUtils.savePriceEntry;

// utils for pool-balances
const balancesUtils = require("./balances_utils.js");
const fetchBalancesOnce = balancesUtils.fetchBalancesOnce;
const balancesCollectionMain = balancesUtils.balancesCollectionMain;

// utils to create messages for the socket
const socketUtils = require("./socket_utils");
const httpSocketSetup = socketUtils.httpSocketSetup;
const httpsSocketSetup = socketUtils.httpsSocketSetup;

// utils to fetch and store bonding curves
const bondingCurveUtils = require("./bonding_curve_utils.js");
const updateBondingCurvesForPool = bondingCurveUtils.updateBondingCurvesForPool;

const ABI_DECODER = require("abi-decoder");
ABI_DECODER.addABI(await getABI("ABI_REGISTRY_EXCHANGE"));
ABI_DECODER.addABI(await getABI("ABI_METAPOOL"));
ABI_DECODER.addABI(await getABI("ABI_THREEPOOL_ZAP"));
ABI_DECODER.addABI(await getABI("ABI_3POOL_DEPOSIT_ZAP"));
ABI_DECODER.addABI(await getABI("ABI_ZAP_FOR_3POOL_METAPOOLS"));

const EventEmitter = require("events");
const emitter = new EventEmitter();

const options = {
  // Enable auto reconnection
  reconnect: {
    auto: true,
    delay: 89, // ms
    maxAttempts: 2500,
    onTimeout: false,
  },
};
console.clear();

// can be either set1 or set2, one set consists of 5 alchemy api keys. We need one set for the telegram bot and another set for the curve monitor
// set 1 = telegram bot
// set 2 = curve monitor
const keySet = 2;

let wsKEY1;
let wsKEY2;
let wsKEY3;
let wsKEY4;
let wsKEY5;

if (keySet === 1) {
  wsKEY1 = setProvider(process.env.wsKEY1);
  wsKEY2 = setProvider(process.env.wsKEY2);
  wsKEY3 = setProvider(process.env.wsKEY3);
  wsKEY4 = setProvider(process.env.wsKEY4);
  wsKEY5 = setProvider(process.env.wsKEY5);
}
if (keySet === 2) {
  wsKEY1 = setProvider(process.env.wsKEY6);
  wsKEY2 = setProvider(process.env.wsKEY7);
  wsKEY3 = setProvider(process.env.wsKEY8);
  wsKEY4 = setProvider(process.env.wsKEY9);
  wsKEY5 = setProvider(process.env.wsKEY10);
}

const web3 = new Web3(new Web3.providers.WebsocketProvider(process.env.web3, options));

const ADDRESS_THREEPOOL = "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7";
const ADDRESS_TRICRYPTO_2 = "0xD51a44d3FaE010294C616388b506AcdA1bfAAE46";
const ADDRESS_sUSD_V2_SWAP = "0xA5407eAE9Ba41422680e2e00537571bcC53efBfD";
const ADDRESS_ETH = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

const TRICRYPTO_2 = await getContract(await getABI("ABI_TRICRYPTO"), ADDRESS_TRICRYPTO_2);
const CHAINLINK_EUR_USD_PRICE_FEED = await getContract(await getABI("ABI_Chainlink_EUR_USD_Price_Feed"), "0xb49f677943BC038e9857d61E7d053CaA2C1734C1");

async function get3CrvPrice() {
  const ABI_FRAX_3CRV = await getABI("ABI_FRAX_3CRV");
  const FRAX_3CRV = await getContract(ABI_FRAX_3CRV, "0xd632f22692FaC7611d2AA1C0D552930D43CAEd3B");
  return Number((await web3Call(FRAX_3CRV, "get_dy", [1, 0, "1000000000000000000"])) / 1e18);
}

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

// runs through the stored txHashes once a minute, and removes the ones that are older than 15 seconds
// reason for this is to not confuse swap_underlyings with deposits or withdrawals
function cleanTxHashStorage() {
  for (let i = 0; i < tempTxHashStorage.length; i++) {
    const NOW = getUnixtime();
    const STORED_TIME = tempTxHashStorage[i].time;
    const SECONDS_PAST = NOW - STORED_TIME;
    if (SECONDS_PAST >= 15) {
      tempTxHashStorage.splice(i, 1);
    }
  }
}
setInterval(cleanTxHashStorage, 60000);

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
  return conversionRate ? amount * conversionRate : "unknown dollar amount";
}

// the Buffer consists of tx, which might be part of a sandwich, since they show up one by one, we need to store them for a bit.
async function buildMessageFromBuffer(i) {
  const E = mevTxBuffer[i].extraData;
  const BLOCK_NUMBER = mevTxBuffer[i].data.blockNumber;
  if (isSwap(mevTxBuffer[i].type)) {
    return await buildSwapMessage(BLOCK_NUMBER, E.soldAmount, E.boughtAmount, E.tokenSoldName, E.tokenBoughtName, E.poolAddress, E.txHash, E.buyer, E.position, E.poolName);
  }
  if (isRemoval(mevTxBuffer[i].type)) {
    return await buildRemovalMessage(BLOCK_NUMBER, E.coinAmount, E.tokenRemovedName, E.poolAddress, E.txHash, E.agentAddress, E.position);
  }
  if (isDeposit(mevTxBuffer[i].type)) {
    return await buildDepositMessage(BLOCK_NUMBER, E.coinArray, E.poolAddress, E.txHash, E.agentAddress, E.position);
  }
}

// tx that had been stored as pot. sandwich-tx, but were in fact not part of sandwich, are getting processed as normal tx from here on out
async function cleanMevTxBuffer(BRAND_NEW_BLOCK) {
  while (true) {
    if (mevTxBuffer.length === 0) break;
    if (mevTxBuffer[0].blockNumber < BRAND_NEW_BLOCK) {
      if (!tempTxHashStorage.find((tx) => tx.txHash === mevTxBuffer[0].txHash)) {
        await buildMessageFromBuffer(0);
        tempTxHashStorage.push({
          txHash: mevTxBuffer[0].txHash,
          time: getUnixtime(),
        });
      }
      mevTxBuffer.shift();
    } else {
      break;
    }
  }
}

async function subscribeToNewBlocks() {
  web3.eth.subscribe("newBlockHeaders", async function (error, result) {
    if (error) {
      console.error(error);
    } else {
      const BRAND_NEW_BLOCK = result.number;
      // cleaning every 2nd block
      if (BRAND_NEW_BLOCK % 2 === 0) {
        await cleanMevTxBuffer(BRAND_NEW_BLOCK);
      }
    }
  });
}

const mevTxBuffer = [];
async function mevBuffer(blockNumber, position, txHash, type, extraData, isSwapUnderlying, data) {
  // first we need to solve multiple blocks getting jammed together:
  if (mevTxBuffer.length !== 0) {
    for (let i = 0; i < mevTxBuffer.length; i++) {
      // going through the elements in mevTxBuffer, to find old entries and clear them
      if (mevTxBuffer[i].data.blockNumber !== blockNumber) {
        console.log("missmatching block found, cleaning");
        await buildMessageFromBuffer(i);
        mevTxBuffer.splice(i, 1);
      }
    }
  }

  for (const entry of mevTxBuffer) {
    if (entry.txHash === txHash) {
      // if newPool and oldPool of the same tx are the same: remove doubling
      const NEW_POOL = data.address;
      const OLD_POOL = entry.data.address;
      if (NEW_POOL === OLD_POOL) return; // same txHash and same pool. Remaining edge case: multiple swaps in the same pool in the same transaction
    }
  }

  mevTxBuffer.push({
    blockNumber,
    position,
    txHash,
    type,
    extraData,
    isSwapUnderlying,
    data,
  });

  const NUM_UNIQUE_TX_HASHES = countUniqueTxHashes(mevTxBuffer);

  if (NUM_UNIQUE_TX_HASHES === 3) {
    // fully scouted sandwich
    mevTxBuffer.sort(function (a, b) {
      return a.position - b.position;
    });

    const BUYER_0 = mevTxBuffer[0].extraData.buyer;
    const BUYER_2 = mevTxBuffer[2].extraData.buyer;

    if (BUYER_0 !== BUYER_2) return;

    await processFullSandwich(mevTxBuffer);
  }
}

async function processFullSandwich(mevTxBuffer) {
  console.log("\nprocessFullSandwich");

  let deltaVictim;
  let coinNameBot;
  let peacefulAmountOut;
  let name;
  let messagePosition1;
  let messageVictim;

  let victimData = mevTxBuffer[1];

  const TOKEN_BOUGHT_NAME = mevTxBuffer[0].extraData.tokenBoughtName;

  let messagePosition0 = await buildMessageFromBuffer(0);
  if (messagePosition0 === "abort") return;

  if (mevTxBuffer.length === 2) {
    // filtering a case of un-related swaps. The token that was bought, has to be the same Token that gets sold afterwards.
    if (TOKEN_BOUGHT_NAME !== mevTxBuffer[1].extraData.tokenSoldName) return;

    messagePosition1 = await buildMessageFromBuffer(1);
    if (messagePosition1 === "abort") return;

    const BLOCK_DATA = await getBlock(mevTxBuffer[0].blockNumber);
    const VICTIM_TX_HASH = BLOCK_DATA.transactions[1 + mevTxBuffer[0].position];
    const VICTIM_TX = await getTx(VICTIM_TX_HASH);
    messageVictim = "messageVictim to" + VICTIM_TX.to;
  } else if (mevTxBuffer.length === 3) {
    if (TOKEN_BOUGHT_NAME !== mevTxBuffer[2].extraData.tokenSoldName) return;

    messageVictim = await buildMessageFromBuffer(1);
    if (messageVictim === "abort") return;

    messagePosition1 = await buildMessageFromBuffer(2);
    if (messagePosition1 === "abort") return;
  } else if (mevTxBuffer.length === 4) {
    if (TOKEN_BOUGHT_NAME !== mevTxBuffer[3].extraData.tokenSoldName) return;

    const POOL_0 = mevTxBuffer[0].data.address;
    const POOL_1 = mevTxBuffer[1].data.address;
    if (POOL_0 === POOL_1) {
      messageVictim = await buildMessageFromBuffer(1);
      victimData = mevTxBuffer[1];
    } else {
      messageVictim = await buildMessageFromBuffer(2);
      victimData = mevTxBuffer[2];
    }
    messagePosition1 = await buildMessageFromBuffer(3);
  }

  // updating the txHashStorage, so messages don't get send multiple time
  for (var i = 0; i < mevTxBuffer.length; i++) {
    tempTxHashStorage.push({
      txHash: mevTxBuffer[i].txHash,
      time: getUnixtime(),
    });
  }

  console.log("\nvictimData", victimData, "\n");

  if (isCurveRegistryExchange(victimData.data.returnValues["0"])) {
    peacefulAmountOut = await victimTxCaseExchangeUnderlying(victimData);
  } else if (isTokenExchangeUnderlying(victimData.isSwapUnderlying)) {
    peacefulAmountOut = await victimTxCaseTokenExchangeUnderlying(victimData);
  } else if (isDeposit(victimData.type)) {
    let res = await victimTxCaseDeposit(victimData);
    deltaVictim = res[0];
    name = res[1];
  } else if (isRemoval(victimData.type)) {
    let res = await victimTxCaseRemoval(victimData);
    deltaVictim = res[0];
    name = res[1];
  } else if (!victimData.isSwapUnderlying) {
    peacefulAmountOut = await victimTxCaseSwap(victimData);
  }

  let DELTA_MEV_BOT;
  const EXTRA_DATA = victimData.extraData;

  if (isSwap(mevTxBuffer[0].type)) {
    if (mevTxBuffer.length === 2 && isSwap(mevTxBuffer[1].type)) {
      name = mevTxBuffer[0].extraData.tokenSoldName;
      DELTA_MEV_BOT = getDeltaMevBot(mevTxBuffer, 1);
    } else if (mevTxBuffer.length === 3 && isSwap(mevTxBuffer[2].type)) {
      coinNameBot = mevTxBuffer[0].extraData.tokenSoldName;
      DELTA_MEV_BOT = getDeltaMevBot(mevTxBuffer, 2);
      if (isSwap(victimData.type)) {
        deltaVictim = formatForPrint(EXTRA_DATA.boughtAmount - peacefulAmountOut);
        name = EXTRA_DATA.tokenBoughtName;
      }
    } else if (mevTxBuffer.length === 4 && isSwap(mevTxBuffer[3].type)) {
      coinNameBot = TOKEN_BOUGHT_NAME;
      DELTA_MEV_BOT = getDeltaMevBot(mevTxBuffer, 3);
      if (isSwap(victimData.type)) {
        deltaVictim = formatForPrint(EXTRA_DATA.boughtAmount - peacefulAmountOut);
        name = EXTRA_DATA.tokenBoughtName;
      }
    }
  }

  if (writeToFile) {
    const UNIXTIME = await getBlockUnixtime(messagePosition0[1].blockNumber);
    const MEV_ENTRY = {
      type: "sandwich",
      blockNumber: messagePosition0[1].blockNumber,
      unixtime: UNIXTIME,
      profit: parseFloat(DELTA_MEV_BOT.replaceAll(",", "")),
      profitUnit: coinNameBot,
      loss: parseFloat(deltaVictim.replaceAll(",", "")),
      lossUnit: name,
      tx: [messagePosition0[1], messageVictim[1], messagePosition1[1]],
    };
    const POOL_ADDRESS = messagePosition0[0];
    emitter.emit("Update Table-MEV" + POOL_ADDRESS, MEV_ENTRY);
    saveTxEntry(POOL_ADDRESS, MEV_ENTRY);
  }

  mevTxBuffer.length = 0;
}

let prevTxHash;
async function buildSwapMessage(blockNumber, soldAmount, boughtAmount, tokenSoldName, tokenBoughtName, poolAddress, txHash, buyer, position, poolName) {
  if (txHash === prevTxHash) return;
  prevTxHash = txHash;
  let holderFee = "-";

  let dollarAmount = await convertToUSD(tokenSoldName, soldAmount);
  if (!dollarAmount) dollarAmount = await convertToUSD(tokenBoughtName, boughtAmount);

  if (isNaN(dollarAmount)) {
    console.log("undefined dollarAmount when swapping", tokenSoldName, "to", tokenBoughtName);
    return "abort";
  }

  // adding fee
  holderFee = (dollarAmount / 100) * 0.04;
  if (poolAddress === ADDRESS_THREEPOOL) holderFee /= 4;

  dollarAmount = formatForPrint(dollarAmount);
  holderFee = formatForPrint(holderFee);

  soldAmount = formatForPrint(soldAmount);
  boughtAmount = formatForPrint(boughtAmount);

  console.log("sold", soldAmount, tokenSoldName, "bought", boughtAmount, tokenBoughtName);

  if (writeToFile) {
    const UNIXTIME = await getBlockUnixtime(blockNumber);
    const ENTRY = {
      type: "swap",
      txHash: txHash,
      blockNumber: blockNumber,
      position: position,
      trader: buyer,
      tradeDetails: {
        amountIn: parseFloat(soldAmount.replaceAll(",", "")),
        nameIn: tokenSoldName,
        amountOut: parseFloat(boughtAmount.replaceAll(",", "")),
        nameOut: tokenBoughtName,
        feeUSD: parseFloat(holderFee.replaceAll(",", "")),
        valueUSD: parseFloat(dollarAmount.replaceAll(",", "")),
      },
      unixtime: UNIXTIME,
    };

    saveTxEntry(poolAddress, ENTRY);
    await savePriceEntry(poolAddress, blockNumber, UNIXTIME);

    const BALANCES_ENTRY = await fetchBalancesOnce(poolAddress, blockNumber);
    const VOLUME_ENTRY = { [UNIXTIME]: parseFloat(dollarAmount.replaceAll(",", "")) };
    const BALANCES = Object.values(BALANCES_ENTRY)[0];
    const TVL = BALANCES.reduce((a, b) => a + b, 0);
    const TVL_ENTRY = { [UNIXTIME]: TVL };

    await updateBondingCurvesForPool(poolAddress);

    const UPDATE = {
      all: ENTRY,
      unixtime: UNIXTIME,
      balances: BALANCES_ENTRY,
      volume: VOLUME_ENTRY,
      tvl: TVL_ENTRY,
    };

    emitter.emit("General Pool Update" + poolAddress, UPDATE);
    return [poolAddress, ENTRY];
  }
}

async function buildRemovalMessage(blockNumber, coinAmount, tokenRemovedName, poolAddress, txHash, agentAddress, position) {
  let dollarAmount = await convertToUSD(tokenRemovedName, coinAmount);
  if (isNaN(dollarAmount)) return "abort";
  dollarAmount = formatForPrint(dollarAmount);

  coinAmount = formatForPrint(coinAmount);
  let poolName = await buildPoolName(poolAddress);

  console.log("removed", coinAmount, tokenRemovedName, "from", poolName);

  const stakedTokenArray = [];
  stakedTokenArray.push({
    amountOut: parseFloat(coinAmount.replaceAll(",", "")),
    nameOut: tokenRemovedName,
    valueUSD: parseFloat(dollarAmount.replaceAll(",", "")),
  });

  if (writeToFile) {
    const UNIXTIME = await getBlockUnixtime(blockNumber);
    const ENTRY = {
      type: "remove",
      txHash: txHash,
      blockNumber: blockNumber,
      position: position,
      trader: agentAddress,
      tradeDetails: stakedTokenArray,
      unixtime: UNIXTIME,
    };

    saveTxEntry(poolAddress, ENTRY);
    await savePriceEntry(poolAddress, blockNumber, UNIXTIME);

    const BALANCES_ENTRY = await fetchBalancesOnce(poolAddress, blockNumber);
    const VOLUME_ENTRY = { [UNIXTIME]: parseFloat(dollarAmount.replaceAll(",", "")) };

    const BALANCES = Object.values(BALANCES_ENTRY)[0];
    const TVL = BALANCES.reduce((a, b) => a + b, 0);
    const TVL_ENTRY = { [UNIXTIME]: TVL };

    await updateBondingCurvesForPool(poolAddress);

    const UPDATE = {
      all: ENTRY,
      unixtime: UNIXTIME,
      balances: BALANCES_ENTRY,
      volume: VOLUME_ENTRY,
      tvl: TVL_ENTRY,
    };

    emitter.emit("General Pool Update" + poolAddress, UPDATE);
    return [poolAddress, ENTRY];
  }
}

async function buildDepositMessage(blockNumber, coinArray, poolAddress, txHash, agentAddress, position) {
  const DEPOSITED_TOKEN_ARRAY = [];
  let dollarAmountTotal = 0;
  let tokenDepositedName;
  for (const COIN of coinArray) {
    tokenDepositedName = COIN.tokenDepositedName;
    let coinAmount = COIN.coinAmount;

    if (Number(coinAmount) === 0) continue;

    let dollarAmount = await convertToUSD(tokenDepositedName, coinAmount);
    if (!dollarAmount) {
      dollarAmount = coinAmount;
      console.log("no dollar value known for", tokenDepositedName, "(undefined)");
      return "abort";
    }

    dollarAmountTotal += Number(dollarAmount);

    coinAmount = formatForPrint(coinAmount);

    DEPOSITED_TOKEN_ARRAY.push({
      amountIn: parseFloat(coinAmount.replaceAll(",", "")),
      nameIn: tokenDepositedName,
      valueUSD: Number(dollarAmount),
    });
  }

  if (isNaN(dollarAmountTotal)) {
    console.log("no dollar value known for", tokenDepositedName, "(NaN)", dollarAmountTotal);
    return "abort";
  }

  let dollarAmount = formatForPrint(dollarAmountTotal);
  let poolName = await buildPoolName(poolAddress);

  // removed, too much text for 1.5$ fee on a 5M$ deposit
  // let holderFee = await getFeesSimple(originalPoolAddress, feeArray)

  console.log("deposited", dollarAmount + "$ into", poolName);

  if (writeToFile) {
    const UNIXTIME = await getBlockUnixtime(blockNumber);
    const ENTRY = {
      type: "deposit",
      txHash: txHash,
      blockNumber: blockNumber,
      position: position,
      trader: agentAddress,
      tradeDetails: DEPOSITED_TOKEN_ARRAY,
      unixtime: UNIXTIME,
    };

    saveTxEntry(poolAddress, ENTRY);
    await savePriceEntry(poolAddress, blockNumber, UNIXTIME);

    const BALANCES_ENTRY = await fetchBalancesOnce(poolAddress, blockNumber);
    const VOLUME_ENTRY = { [UNIXTIME]: dollarAmountTotal };

    const BALANCES = Object.values(BALANCES_ENTRY)[0];
    const TVL = BALANCES.reduce((a, b) => a + b, 0);
    const TVL_ENTRY = { [UNIXTIME]: TVL };

    await updateBondingCurvesForPool(poolAddress);

    const UPDATE = {
      all: ENTRY,
      unixtime: UNIXTIME,
      balances: BALANCES_ENTRY,
      volume: VOLUME_ENTRY,
      tvl: TVL_ENTRY,
    };

    emitter.emit("General Pool Update" + poolAddress, UPDATE);
    return [poolAddress, ENTRY];
  }
}

const ABI_TOKEN_EXCHANGE = await getABI("ABI_TOKEN_EXCHANGE");
const ABI_TOKEN_EXCHANGE_2 = await getABI("ABI_TOKEN_EXCHANGE_2");
const ABI_EXCHANGE_UNDERLYING = await getABI("ABI_EXCHANGE_UNDERLYING");
const ABI_ADD_LIQUIDITY = await getABI("ABI_ADD_LIQUIDITY");
const ABI_REMOVE_LIQUIDITY = await getABI("ABI_REMOVE_LIQUIDITY");
const ABI_REMOVE_LIQUIDITY_ONE = await getABI("ABI_REMOVE_LIQUIDITY_ONE");
const ABI_REMOVE_LIQUIDITY_IMBALANCE = await getABI("ABI_REMOVE_LIQUIDITY_IMBALANCE");

const CURVE_POOLS = getCurvePools();

// first wave of susbscribing to Token Exchanges
async function activateRealTimeMonitoring(singlePoolModus, whiteListedPoolAddress) {
  console.log("Real-Time-Monitoring active\n");
  for (const POOL_ADDRESS of CURVE_POOLS) {
    if (singlePoolModus) {
      // for mvp modus, we only listen to events on a single pool (susd -> whiteListedPoolAddress)
      if (POOL_ADDRESS.toLocaleLowerCase() !== whiteListedPoolAddress.toLocaleLowerCase()) continue;
    }

    // RemoveLiquidity
    const CONTRACT_REMOVE_LIQUIDITY = new wsKEY1.eth.Contract(ABI_REMOVE_LIQUIDITY, POOL_ADDRESS);
    CONTRACT_REMOVE_LIQUIDITY.events
      .RemoveLiquidity()
      .on("data", async (data) => {
        console.log(getCurrentTime(), "event at CONTRACT_REMOVE_LIQUIDITY");
        await processRemoveLiquidity(data, POOL_ADDRESS);
      })
      .on("error", (error) => {
        console.error("Error in RemoveLiquidity event: ", error);
      });

    // RemoveLiquidityOne
    const CONTRACT_REMOVE_LIQUIDITY_ONE = new wsKEY2.eth.Contract(ABI_REMOVE_LIQUIDITY_ONE, POOL_ADDRESS);
    CONTRACT_REMOVE_LIQUIDITY_ONE.events
      .RemoveLiquidityOne()
      .on("data", async (data) => {
        console.log(getCurrentTime(), "event at CONTRACT_REMOVE_LIQUIDITY_ONE");
        await processRemoveLiquidityOne(data, POOL_ADDRESS);
      })
      .on("error", (error) => {
        console.error("Error in RemoveLiquidityOne event: ", error);
      });

    // RemoveLiquidityImbalance
    const CONTRACT_REMOVE_LIQUIDITY_IMBALANCE = new wsKEY3.eth.Contract(ABI_REMOVE_LIQUIDITY_IMBALANCE, POOL_ADDRESS);
    CONTRACT_REMOVE_LIQUIDITY_IMBALANCE.events
      .RemoveLiquidityImbalance()
      .on("data", async (data) => {
        console.log(getCurrentTime(), "event at CONTRACT_REMOVE_LIQUIDITY_IMBALANCE");
        await processRemoveLiquidityImbalance(data, POOL_ADDRESS);
      })
      .on("error", (error) => {
        console.error("Error in RemoveLiquidityImbalance event: ", error);
      });

    // AddLiquidity
    const CONTRACT_ADD_LIQUIDITY = new wsKEY4.eth.Contract(ABI_ADD_LIQUIDITY, POOL_ADDRESS);
    CONTRACT_ADD_LIQUIDITY.events
      .AddLiquidity()
      .on("data", async (data) => {
        console.log(getCurrentTime(), "event at CONTRACT_ADD_LIQUIDITY");
        await new Promise((resolve) => setTimeout(resolve, 5000));
        await processAddLiquidity(data, POOL_ADDRESS);
      })
      .on("error", (error) => {
        console.error("Error in AddLiquidity event: ", error);
      });

    // TokenExchange
    const CONTRACT_TOKEN_EXCHANGE = new wsKEY5.eth.Contract(ABI_TOKEN_EXCHANGE, POOL_ADDRESS);
    CONTRACT_TOKEN_EXCHANGE.events
      .TokenExchange()
      .on("data", async (data) => {
        console.log(getCurrentTime(), "event at CONTRACT_TOKEN_EXCHANGE");
        await processTokenExchange(data, POOL_ADDRESS);
      })
      .on("error", (error) => {
        console.error("Error in TokenExchange event: ", error);
      });

    // TokenExchange2
    const CONTRACT_TOKEN_EXCHANGE_2 = new wsKEY1.eth.Contract(ABI_TOKEN_EXCHANGE_2, POOL_ADDRESS);
    CONTRACT_TOKEN_EXCHANGE_2.events
      .TokenExchange()
      .on("data", async (data) => {
        console.log(getCurrentTime(), "event at CONTRACT_TOKEN_EXCHANGE_2");
        await processTokenExchange(data, POOL_ADDRESS);
      })
      .on("error", (error) => {
        console.error("Error in TokenExchange2 event: ", error);
      });

    // TokenExchangeUnderlying
    const CONTRACT_TOKEN_EXCHANGE_UNDERLYING = new wsKEY2.eth.Contract(ABI_EXCHANGE_UNDERLYING, POOL_ADDRESS);
    CONTRACT_TOKEN_EXCHANGE_UNDERLYING.events
      .TokenExchangeUnderlying()
      .on("data", async (data) => {
        console.log(getCurrentTime(), "event at CONTRACT_TOKEN_EXCHANGE_UNDERLYING");
        await processTokenExchange(data, POOL_ADDRESS, "TokenExchangeUnderlying");
      })
      .on("error", (error) => {
        console.error("Error in TokenExchangeUnderlying event: ", error);
      });
  }
}

// builds a string of fee amounts and the connected token, avoiding dollar for now
async function getFeesSimple(poolAddress, feeArray) {
  let feeString = "";
  for (let i = 0; i < feeArray.length; i++) {
    const TOKEN_ADDRESS = await getTokenAddress(poolAddress, i);
    const AMOUNT = await getCleanedTokenAmount(TOKEN_ADDRESS, feeArray[i]);
    const NAME = await getTokenName(TOKEN_ADDRESS);
    feeString += formatForPrint(AMOUNT) + " " + NAME + " | ";
  }
  feeString = feeString.substring(0, feeString.length - 3);
  return "<i>" + feeString + "</i>";
}

async function getTokenAddressFromStake(poolAddress, blockNumber, coinAmount) {
  let id = 0;
  let ethSpotter = 0;
  let tokenAddress;
  while (true) {
    tokenAddress = await getTokenAddress(poolAddress, id);
    if (isNativeEthAddress(tokenAddress)) ethSpotter = 1;
    if (isNullAddress(tokenAddress)) break;
    const TRANSFER_AMOUNTS = await getTokenTransfers(tokenAddress, blockNumber);
    for (const TRANSFER_AMOUNT of TRANSFER_AMOUNTS) {
      if (TRANSFER_AMOUNT === coinAmount) {
        return tokenAddress;
      }
    }
    id += 1;
  }
  if (isNullAddress(tokenAddress) && ethSpotter === 1) {
    return ADDRESS_ETH;
  }
}

// RemoveLiquidity
async function processRemoveLiquidity(data, poolAddress) {
  console.log("\npool", poolAddress, " | txHash", data.transactionHash, " | RemoveLiquidity");
}

// RemoveLiquidityOne
async function processRemoveLiquidityOne(data, poolAddress) {
  const TX_HASH = data.transactionHash;
  const BLOCK_NUMBER = data.blockNumber;
  const PROVIDER = data.returnValues.provider;
  let type;
  console.log("\npool", poolAddress, " | txHash", TX_HASH, " | RemoveLiquidityOn");
  if (data.event && data.event === "TokenExchange") return;
  if (CURVE_POOLS.includes(PROVIDER)) {
    const DATA = await checkForTokenExchangeUnderlying(PROVIDER, BLOCK_NUMBER, TX_HASH);
    await processTokenExchange(DATA, PROVIDER, "TokenExchangeUnderlying");
    return;
  }
  if (is3PoolDepositZap(PROVIDER)) {
    // Curve Finance: 3Pool Deposit Zap
    console.log("aborting");
    return;
  }
  console.log("proceeding");

  let coinAmount = data.returnValues.coin_amount;
  const REMOVED_ADDRESS = await getTokenAddressFromStake(poolAddress, BLOCK_NUMBER, coinAmount);
  coinAmount = await getCleanedTokenAmount(REMOVED_ADDRESS, coinAmount);
  const TOKEN_REMOVED_NAME = await getTokenName(REMOVED_ADDRESS);
  const TX = await getTx(TX_HASH);

  // might be exchange_multiple
  if (isCurveRegistryExchange(TX.to)) {
    const DECODED_TX = ABI_DECODER.decodeMethod(TX.input);
    const METHOD_NAME = DECODED_TX.name;
    if (METHOD_NAME === "exchange_multiple") {
      const ROUTE = DECODED_TX.params[0].value;
      for (const poolAddress of ROUTE) {
        if (isNullAddress(poolAddress)) continue;
        const DATA = await checkForTokenExchange(poolAddress, BLOCK_NUMBER, TX_HASH);
        if (DATA === "empty") continue;
        await processTokenExchange(DATA, poolAddress);
        return;
      }
    }
  }

  // or just a simple exchange
  if (isZapFor3poolMetapools(TX.to)) {
    const DECODED_TX = ABI_DECODER.decodeMethod(TX.input);
    if (DECODED_TX.name === "exchange") {
      const _POOL_ADDRESS = DECODED_TX.params[0].value;
      const DATA_EXCHANGE = await checkForTokenExchange(_POOL_ADDRESS, BLOCK_NUMBER, TX_HASH);
      if (data !== "empty") {
        const BUYER = TX.from;
        const POSITION = TX.transactionIndex;
        const TO = TX.to;
        const POOL_NAME = await buildPoolName(_POOL_ADDRESS);

        const SOLD_ADDRESS = await getTokenAddress(_POOL_ADDRESS, DECODED_TX.params[1].value);
        const TOKEN_SOLD_NAME = await getTokenName(SOLD_ADDRESS);
        let soldAmount = DATA_EXCHANGE.returnValues.tokens_sold;
        soldAmount = await getCleanedTokenAmount(SOLD_ADDRESS, soldAmount);

        const BOUGHT_ADDRESS = await getTokenAddress(poolAddress, DECODED_TX.params[2].value - 1);
        const TOKEN_BOUGHT_NAME = await getTokenName(BOUGHT_ADDRESS);
        let boughtAmount = data.returnValues.coin_amount;
        boughtAmount = await getCleanedTokenAmount(BOUGHT_ADDRESS, boughtAmount);

        if (POSITION > 7) {
          await buildSwapMessage(BLOCK_NUMBER, soldAmount, boughtAmount, TOKEN_SOLD_NAME, TOKEN_BOUGHT_NAME, _POOL_ADDRESS, TX_HASH, BUYER, POSITION, POOL_NAME);
        } else {
          const extraData = {
            soldAmount: soldAmount,
            boughtAmount: boughtAmount,
            tokenSoldName: TOKEN_SOLD_NAME,
            soldAddress: SOLD_ADDRESS,
            tokenBoughtName: TOKEN_BOUGHT_NAME,
            boughtAddress: BOUGHT_ADDRESS,
            poolAddress: _POOL_ADDRESS,
            txHash: TX_HASH,
            buyer: BUYER,
            to: TO,
            position: POSITION,
            poolName: POOL_NAME,
          };
          await mevBuffer(BLOCK_NUMBER, POSITION, TX_HASH, "classicCurveMonitor", extraData, type, data);
        }
        return;
      }
    }
    if (DECODED_TX.name === "remove_liquidity_one_coin") {
      poolAddress = DECODED_TX.params[0].value;
    }
  }

  try {
    const ABI = [
      {
        stateMutability: "view",
        type: "function",
        name: "pool",
        inputs: [],
        outputs: [{ name: "", type: "address" }],
      },
    ];
    const CONTRACT = await getContract(ABI, data.returnValues.provider);
    let shouldContinue = true;
    for (let i = 0; i < 12 && shouldContinue; i++) {
      try {
        poolAddress = await web3Call(CONTRACT, "pool", []);
        shouldContinue = false;
      } catch (error) {
        if (error.message.startsWith("Returned values aren't valid")) continue;
        await errHandler(error);
      }
    }
  } catch (err) {
    console.log("no pool function found");
  }

  const AGENT_ADDRESS = TX.from;
  const TO = TX.to;
  const POSITION = TX.transactionIndex;

  if (POSITION > 7) {
    tempTxHashStorage.push({
      TX_HASH,
      time: getUnixtime(),
    });
    await buildRemovalMessage(BLOCK_NUMBER, coinAmount, TOKEN_REMOVED_NAME, poolAddress, TX_HASH, AGENT_ADDRESS, POSITION);
  } else {
    const extraData = {
      coinAmount: coinAmount,
      tokenRemovedName: TOKEN_REMOVED_NAME,
      removedAddress: REMOVED_ADDRESS,
      poolAddress: poolAddress,
      txHash: TX_HASH,
      agentAddress: AGENT_ADDRESS,
      to: TO,
      position: POSITION,
    };
    await mevBuffer(BLOCK_NUMBER, POSITION, TX_HASH, "Removal", extraData, type, data);
  }
}

// RemoveLiquidityImbalance
async function processRemoveLiquidityImbalance(data, poolAddress) {
  console.log("\npool", poolAddress, " | txHash", data.transactionHash, " | RemoveLiquidityImbalance");

  const CURVE_JSON = JSON.parse(fs.readFileSync("curve_pool_data.json"));

  let type;

  const TX_HASH = data.transactionHash;
  const TX = await getTx(TX_HASH);
  const POSITION = TX.transactionIndex;
  const BLOCK_NUMBER = data.blockNumber;

  let coinAmount = data.returnValues.token_amounts[0];
  for (var i = 0; i < data.returnValues.token_amounts.length; i++) {
    if (coinAmount < data.returnValues.token_amounts[i]) {
      coinAmount = data.returnValues.token_amounts[i];
    }
  }

  i = data.returnValues.token_amounts.indexOf(coinAmount);
  const REMOVED_ADDRESS = CURVE_JSON[poolAddress].coins[i];
  const TOKEN_REMOVED_NAME = CURVE_JSON[poolAddress].coin_names[i];
  const AGENT_ADDRESS = TX.from;
  const TO = TX.to;

  coinAmount = await getCleanedTokenAmount(REMOVED_ADDRESS, coinAmount);

  if (POSITION > 7) {
    tempTxHashStorage.push({
      TX_HASH,
      time: getUnixtime(),
    });
    await buildRemovalMessage(BLOCK_NUMBER, coinAmount, TOKEN_REMOVED_NAME, poolAddress, TX_HASH, AGENT_ADDRESS, POSITION);
  } else {
    const extraData = {
      coinAmount: coinAmount,
      tokenRemovedName: TOKEN_REMOVED_NAME,
      removedAddress: REMOVED_ADDRESS,
      poolAddress: poolAddress,
      txHash: TX_HASH,
      agentAddress: AGENT_ADDRESS,
      to: TO,
      position: POSITION,
    };
    await mevBuffer(BLOCK_NUMBER, POSITION, TX_HASH, "Removal", extraData, type, data);
  }
}

// AddLiquidity
async function processAddLiquidity(data, poolAddress) {
  const ORIGINAL_POOL_ADDRESS = poolAddress;
  const TX_HASH = data.transactionHash;
  const TX = await getTx(TX_HASH);
  const TO = TX.to;
  const AGENT_ADDRESS = TX.from;
  const POSITION = TX.transactionIndex;
  let tokenAmounts = data.returnValues.token_amounts;
  let numberOfCoins = tokenAmounts.length;
  const PROVIDER = data.returnValues.provider;
  const BLOCK_NUMBER = TX.blockNumber;
  let type;
  let decodedTx;

  if (isCurveRegistryExchange(TO)) {
    decodedTx = ABI_DECODER.decodeMethod(TX.input);
    console.log(decodedTx.params[4]);
    if (decodedTx) {
      if (decodedTx.name === "exchange_multiple") {
        if (!isNullAddress(decodedTx.params[4].value[0])) {
          poolAddress = decodedTx.params[4].value[0];
        }
      }
    }
  }

  if (CURVE_POOLS.includes(PROVIDER)) {
    const TEMP_DATA = await checkForTokenExchangeUnderlying(PROVIDER, BLOCK_NUMBER, TX_HASH);
    if (TEMP_DATA !== "empty") {
      data = TEMP_DATA;
      await processTokenExchange(data, PROVIDER);
      return;
    }
  }
  const TEMP_DATA = await checkForTokenExchange(poolAddress, BLOCK_NUMBER, TX_HASH);
  if (TEMP_DATA !== "empty" && TEMP_DATA) {
    data = TEMP_DATA;
    await processTokenExchange(data, poolAddress);
    return;
  }

  // await new Promise(resolve => setTimeout(resolve, 2000))

  for (let i = 0; i < tempTxHashStorage.length; i++) {
    if (data.transactionHash === tempTxHashStorage[i].txHash) return;
  }
  console.log("\npool", poolAddress, " | txHash", TX_HASH, " | AddLiquidity");

  const COIN_ARRAY = [];

  const FEE_ARRAY = data.returnValues.fees;
  let tokenDepositedName;
  let depositedAddress;
  let realPool;

  // (Curve Finance: 3Pool Deposit Zap)
  if (is3PoolDepositZap(TO)) {
    decodedTx = ABI_DECODER.decodeMethod(TX.input);
    realPool = decodedTx.params[0].value;
    tokenAmounts = decodedTx.params[1].value;
    numberOfCoins = tokenAmounts.length;
    for (let i = 0; i < numberOfCoins; i++) {
      if (tokenAmounts[i] === 0) continue;
      let coinAmount = Number(tokenAmounts[i]);
      if (i === 0) {
        depositedAddress = await getTokenAddress(realPool, i);
      } else {
        depositedAddress = await getTokenAddress(poolAddress, i - 1);
      }
      tokenDepositedName = await getTokenName(depositedAddress);
      coinAmount = await getCleanedTokenAmount(depositedAddress, coinAmount);
      COIN_ARRAY.push({
        tokenDepositedName,
        coinAmount,
        depositedAddress,
      });
    }
    // Zap for 3pool metapools
  } else if (isZapFor3poolMetapools(TO)) {
    decodedTx = ABI_DECODER.decodeMethod(TX.input);
    if (decodedTx.name === "exchange") return;
    if (decodedTx.name !== "add_liquidity") {
      console.log("something went wrong at Zap for 3pool metapools");
      return;
    }
    realPool = decodedTx.params[0].value;
    tokenAmounts = decodedTx.params[1].value;
    numberOfCoins = tokenAmounts.length;
    for (let i = 0; i < numberOfCoins; i++) {
      if (tokenAmounts[i] === 0) continue;
      let coinAmount = Number(tokenAmounts[i]);
      if (i === 0) {
        depositedAddress = await getTokenAddress(realPool, i);
      } else {
        depositedAddress = await getTokenAddress(poolAddress, i - 1);
      }
      tokenDepositedName = await getTokenName(depositedAddress);
      coinAmount = await getCleanedTokenAmount(depositedAddress, coinAmount);
      COIN_ARRAY.push({
        tokenDepositedName,
        coinAmount,
        depositedAddress,
      });
    }
  } else {
    for (let i = 0; i < numberOfCoins; i++) {
      let coinAmount = Number(tokenAmounts[i]);
      const DEPOSITED_ADDRESS = await getTokenAddress(poolAddress, i);
      tokenDepositedName = await getTokenName(DEPOSITED_ADDRESS);
      coinAmount = await getCleanedTokenAmount(DEPOSITED_ADDRESS, coinAmount);
      COIN_ARRAY.push({
        tokenDepositedName,
        coinAmount,
        DEPOSITED_ADDRESS,
      });
    }

    const ABI = [
      {
        stateMutability: "view",
        type: "function",
        name: "pool",
        inputs: [],
        outputs: [{ name: "", type: "address" }],
      },
    ];
    const CONTRACT = await getContract(ABI, data.returnValues.provider);
    let _POOL_ADDRESS;
    let shouldContinue = true;
    for (let i = 0; i < 12 && shouldContinue; i++) {
      _POOL_ADDRESS = await CONTRACT.methods
        .pool()
        .call()
        .catch(async (error) => {
          if (!isCupsErr(error)) shouldContinue = false;
          await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * (400 - 200 + 1) + 200)));
        });
    }
    //
    if (_POOL_ADDRESS) poolAddress = _POOL_ADDRESS;
  }

  if (isZapFor3poolMetapools(TO) || is3PoolDepositZap(TO)) poolAddress = realPool;

  if (POSITION > 7) {
    tempTxHashStorage.push({
      TX_HASH,
      time: getUnixtime(),
    });
    buildDepositMessage(BLOCK_NUMBER, COIN_ARRAY, poolAddress, TX_HASH, AGENT_ADDRESS, POSITION);
  } else {
    const extraData = {
      coinArray: COIN_ARRAY,
      originalPoolAddress: ORIGINAL_POOL_ADDRESS,
      feeArray: FEE_ARRAY,
      poolAddress: poolAddress,
      txHash: TX_HASH,
      agentAddress: AGENT_ADDRESS,
      to: TO,
      position: POSITION,
    };
    await mevBuffer(BLOCK_NUMBER, POSITION, TX_HASH, "Deposit", extraData, type, data);
  }
}

// TokenExchange
async function processTokenExchange(data, poolAddress, type) {
  const TX_HASH = data.transactionHash;
  if (isTokenExchangeUnderlying(data.event)) type = "TokenExchangeUnderlying";
  console.log("\npool", poolAddress, " | txHash", TX_HASH, " | TokenExchange");

  const TX = await getTx(TX_HASH);
  const TO = TX.to;
  const BLOCK_NUMBER = TX.blockNumber;
  const POSITION = TX.transactionIndex;
  const BUYER = TX.from;
  const DECODED_TX = ABI_DECODER.decodeMethod(TX.input);
  const TOKEN_1_ADDRESS = await getTokenAddress(poolAddress, 1);

  let exchangeMultipleCheck;
  if (DECODED_TX) {
    exchangeMultipleCheck = DECODED_TX.name;
    data.hacked_data = DECODED_TX.params;
  }

  let poolName = await buildPoolName(poolAddress);
  let res;

  const RETURNED_VALUES = data.returnValues;
  const SOLD_ID = RETURNED_VALUES.sold_id;
  const TOKENS_SOLD = RETURNED_VALUES.tokens_sold;
  const BOUGHT_ID = RETURNED_VALUES.bought_id;
  const TOKENS_BOUGHT = RETURNED_VALUES.tokens_bought;

  if (exchangeMultipleCheck === "exchange_multiple" && !zoom) {
    poolName = "Pool";
    res = await tokenExchangeCaseMultiple(BLOCK_NUMBER, DECODED_TX);
  } else if (isTokenExchangeUnderlying(type) && is3CrvToken(TOKEN_1_ADDRESS)) {
    res = await tokenExchangeCase3Pool(BLOCK_NUMBER, TX, TO, SOLD_ID, TOKENS_SOLD, BOUGHT_ID, TOKENS_BOUGHT, poolAddress);
  } else if (isTokenExchangeUnderlying(type) && SOLD_ID !== 0 && isCrvRenWSBTC(TOKEN_1_ADDRESS)) {
    res = await tokenExchangeCase3BtcMetapool(BLOCK_NUMBER, SOLD_ID, TOKENS_SOLD, BOUGHT_ID, TOKENS_BOUGHT, poolAddress);
  } else if (isTokenExchangeUnderlying(type) && SOLD_ID !== 0 && isCrvFrax(TOKEN_1_ADDRESS)) {
    res = await tokenExchangeCaseFraxbp(BLOCK_NUMBER, SOLD_ID, TOKENS_SOLD, BOUGHT_ID, TOKENS_BOUGHT, poolAddress);
  } else {
    res = await tokenExchangeCaseSingle(SOLD_ID, TOKENS_SOLD, BOUGHT_ID, TOKENS_BOUGHT, poolAddress);
  }

  let [soldAmount, boughtAmount, tokenSoldName, soldAddress, tokenBoughtName, boughtAddress] = res;

  if (POSITION > 7) {
    tempTxHashStorage.push({
      TX_HASH,
      time: getUnixtime(),
    });
    await buildSwapMessage(BLOCK_NUMBER, soldAmount, boughtAmount, tokenSoldName, tokenBoughtName, poolAddress, TX_HASH, BUYER, POSITION, poolName);
  } else {
    const extraData = {
      soldAmount: soldAmount,
      boughtAmount: boughtAmount,
      tokenSoldName: tokenSoldName,
      soldAddress: soldAddress,
      tokenBoughtName: tokenBoughtName,
      boughtAddress: boughtAddress,
      poolAddress: poolAddress,
      txHash: TX_HASH,
      buyer: BUYER,
      to: TO,
      position: POSITION,
      poolName: poolName,
    };
    await mevBuffer(BLOCK_NUMBER, POSITION, TX_HASH, "classicCurveMonitor", extraData, type, data);
  }
}

async function searchEventsInBlock(blockNumber) {
  const UNPROCESSED_EVENT_LOGS = JSON.parse(fs.readFileSync("unprocessed_event_logs.json"));
  const EVENT_NAMES = ["RemoveLiquidity", "RemoveLiquidityOne", "RemoveLiquidityImbalance", "AddLiquidity", "TokenExchange", "TokenExchangeUnderlying"];
  const FOUND_EVENTS = [];
  for (const POOL_ADDRESS in UNPROCESSED_EVENT_LOGS) {
    for (const EVENT_NAME of EVENT_NAMES) {
      const EVENT_SPECIFIC_LOG = UNPROCESSED_EVENT_LOGS[POOL_ADDRESS][EVENT_NAME];
      for (const EVENT of EVENT_SPECIFIC_LOG) {
        if (blockNumber === EVENT.blockNumber) {
          FOUND_EVENTS.push(EVENT);
          const EVENT_NAME = EVENT.event;
          if (EVENT_NAME === "RemoveLiquidity") await processRemoveLiquidity(EVENT, POOL_ADDRESS);
          if (EVENT_NAME === "RemoveLiquidityOne") await processRemoveLiquidityOne(EVENT, POOL_ADDRESS);
          if (EVENT_NAME === "RemoveLiquidityImbalance") await processRemoveLiquidityImbalance(EVENT, POOL_ADDRESS);
          if (EVENT_NAME === "AddLiquidity") await processAddLiquidity(EVENT, POOL_ADDRESS);
          if (EVENT_NAME === "TokenExchange") await processTokenExchange(EVENT, POOL_ADDRESS);
          if (isTokenExchangeUnderlying(EVENT_NAME)) await processTokenExchange(EVENT, POOL_ADDRESS, "TokenExchangeUnderlying");
        }
      }
    }
  }
  return FOUND_EVENTS;
}

async function searchFromLogsInRange(firstBlock, range) {
  let lastPercentage = 0;
  let i = 0;
  for (let blockNumber = firstBlock; blockNumber < firstBlock + range; blockNumber++) {
    await cleanMevTxBuffer(blockNumber);
    const PERCENTAGE = Number(((i / range) * 100).toFixed(0));

    if (PERCENTAGE !== lastPercentage) {
      // console.log(percentage, "%")
      lastPercentage = PERCENTAGE;
    }

    await searchEventsInBlock(blockNumber);
    i += 1;
  }
}

async function collectionCycle(nextBlockToProceedProcessing, range) {
  await collection();

  //  this loop is used to give the raw log collection enough time to be processed and saved.
  while (true) {
    const IS_COLLECTING = JSON.parse(fs.readFileSync("collector_state.json"));
    if (!IS_COLLECTING.collectingRawLog) break;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  await searchFromLogsInRange(nextBlockToProceedProcessing, range);
}

/**
 * goal: up to date json with sorted and processed transaction-lists
 * 1: removes entries older than x days (31 for mvp) from the file which stores the raw, unprocessed events (unprocessed_event_logs.json)
 * 2: adds raw log entries to the file
 * 3: processes the newly added events and stores the processed data in processed_tx_log_all.json & processed_tx_log_mev.json
 * 4: repeats the cycle until it is truely up do date
 */
async function collectionMain() {
  let oldRange = 10;

  let nextBlockToProceedProcessing;
  try {
    nextBlockToProceedProcessing = await findLastProcessedEvent(whiteListedPoolAddress);
  } catch (err) {
    nextBlockToProceedProcessing = await getStartBlock();
  }
  const LATEST_BLOCK = await getCurrentBlockNumber();
  const NEW_RANGE = LATEST_BLOCK - nextBlockToProceedProcessing;

  while (NEW_RANGE !== oldRange) {
    oldRange = NEW_RANGE;
    await collectionCycle(nextBlockToProceedProcessing, NEW_RANGE);
  }
}

async function CurveMonitor() {
  // using socket.io, this function will iterate over all pools and create and open a custom sockets per pool, for the frontend to connect to.
  if (MODE === "local") {
    await httpSocketSetup(Server, emitter, whiteListedPoolAddress);
  }
  if (MODE === "https") {
    await httpsSocketSetup(Server, emitter, whiteListedPoolAddress);
  }

  let latestBlock = 0;
  let latestBlockAfterProcessing = 10;

  while (latestBlockAfterProcessing > latestBlock + 2) {
    latestBlock = await getCurrentBlockNumber();
    await collectionMain();
    await priceCollectionMain(whiteListedPoolAddress);
    await balancesCollectionMain(whiteListedPoolAddress);
    latestBlockAfterProcessing = await getCurrentBlockNumber();
  }
  console.log("all events fetched and processed");

  await updateBondingCurvesForPool(whiteListedPoolAddress);
  await activateRealTimeMonitoring(singlePoolModus, whiteListedPoolAddress);
  await subscribeToNewBlocks(); // should be active by default, unless during some tests
}

// toggle to write the trades to the json
let writeToFile = true;

// for mvp, only listens to new events on a single poolAddress
let singlePoolModus = true;

// sUSD pool for mvp
let whiteListedPoolAddress = ADDRESS_sUSD_V2_SWAP;

// show ExchangeMultiple zoomed into target pool (for susd in mvp)
let zoom = true;

// const MODE = "local";
const MODE = "https"
console.log(MODE + "-mode");

await CurveMonitor();
