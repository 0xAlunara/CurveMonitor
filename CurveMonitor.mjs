import { Server } from "socket.io";

/* eslint-disable no-debugger, quote-props */
/* eslint-disable no-debugger, object-shorthand */

import fs from "fs";
import https from "https";
import Web3 from "web3";
import dotenv from "dotenv";

dotenv.config();

const tempTxHashStorage = [];
let tempMevStorage = [];

import {
  getUnixtime,
  getABI,
  getCurvePools,
  isNativeEthAddress,
  isNullAddress,
  isCurveRegistryExchange,
  is3PoolDepositZap,
  isZapFor3poolMetapools,
  isSwap,
  isRemoval,
  isDeposit,
  isTokenExchangeUnderlying,
  formatForPrint,
  getTokenAddress,
  countUniqueTxHashes,
  getTokenName,
  buildPoolName,
  getCleanedTokenAmount,
  wait,
} from "./Utils/GenericUtils.mjs";

import {
  setProvider,
  getContract,
  getTx,
  getCurrentBlockNumber,
  getBlock,
  getBlockUnixtime,
  getTokenTransfers,
  isCupsErr,
  checkForTokenExchange,
  checkForTokenExchangeUnderlying,
} from "./Utils/Web3CallUtils.mjs";

import { saveTxEntry, findLastProcessedEvent, collection, getStartBlock, getHolderFee } from "./Utils/StorageUtils.mjs";

import {
  getDeltaMevBot,
  tokenExchangeCaseMultiple,
  tokenExchangeCaseUnderlying,
  tokenExchangeCaseSingle,
  victimTxCaseExchangeUnderlying,
  victimTxCaseTokenExchangeUnderlying,
  victimTxCaseDeposit,
  victimTxCaseRemoval,
  victimTxCaseSwap,
} from "./Utils/TransactionLogicUtils.mjs";

// utils for price-data
import { priceCollectionMain, savePriceEntry, bootPriceJSON, convertToUSD } from "./Utils/PriceUtils.mjs";

// utils for pool-balances
import { fetchBalancesOnce, bootBalancesJSON, balancesCollectionMain } from "./Utils/BalancesUtils.mjs";

// utils to create messages for the socket
import { httpSocketSetup, httpsSocketSetup } from "./Utils/SocketUtils.mjs";

// utils to fetch and store bonding curves
import { updateBondingCurvesForPool } from "./Utils/BondingCurveUtils.mjs";

import ABI_DECODER from "abi-decoder";
ABI_DECODER.addABI(await getABI("ABI_REGISTRY_EXCHANGE"));
ABI_DECODER.addABI(await getABI("ABI_METAPOOL"));
ABI_DECODER.addABI(await getABI("ABI_THREEPOOL_ZAP"));
ABI_DECODER.addABI(await getABI("ABI_3POOL_DEPOSIT_ZAP"));
ABI_DECODER.addABI(await getABI("ABI_ZAP_FOR_3POOL_METAPOOLS"));

import EventEmitter from "events";
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

let wsKEY1;
let wsKEY2;
let wsKEY3;
let wsKEY4;
let wsKEY5;

function initWeb3Sockets(type) {
  if (type === "telegramBot") {
    wsKEY1 = setProvider(process.env.wsKEY1);
    wsKEY2 = setProvider(process.env.wsKEY2);
    wsKEY3 = setProvider(process.env.wsKEY3);
    wsKEY4 = setProvider(process.env.wsKEY4);
    wsKEY5 = setProvider(process.env.wsKEY5);
  }
  if (type === "dashboard") {
    wsKEY1 = setProvider(process.env.wsKEY6);
    wsKEY2 = setProvider(process.env.wsKEY7);
    wsKEY3 = setProvider(process.env.wsKEY8);
    wsKEY4 = setProvider(process.env.wsKEY9);
    wsKEY5 = setProvider(process.env.wsKEY10);
  }
}

const web3 = new Web3(new Web3.providers.WebsocketProvider(process.env.web3, options));

const ADDRESS_sUSD_V2_SWAP = "0xA5407eAE9Ba41422680e2e00537571bcC53efBfD";
const ADDRESS_ETH = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

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

// the Buffer consists of tx, which might be part of a sandwich, since they show up one by one, we need to store them for a bit.
async function buildMessageFromBuffer(i) {
  const E = mevTxBuffer[i].extraData;
  const BLOCK_NUMBER = mevTxBuffer[i].data.blockNumber;
  if (isSwap(mevTxBuffer[i].type)) {
    return await buildSwapMessage(
      BLOCK_NUMBER,
      E.soldAddress,
      E.soldAmount,
      E.boughtAddress,
      E.boughtAmount,
      E.tokenSoldName,
      E.tokenBoughtName,
      E.poolAddress,
      E.txHash,
      E.buyer,
      E.to,
      E.position,
      E.poolName
    );
  }
  if (isRemoval(mevTxBuffer[i].type)) {
    return await buildRemovalMessage(BLOCK_NUMBER, E.coinAmount, E.tokenRemovedName, E.poolAddress, E.txHash, E.agentAddress, E.position, E.removedAddress);
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
  try {
    web3.eth.subscribe("newBlockHeaders", async function (error, result) {
      if (error) {
        console.error("err in subscribeToNewBlocks", error);
      } else {
        const BRAND_NEW_BLOCK = result.number;
        // cleaning every 2nd block
        if (BRAND_NEW_BLOCK % 2 === 0) {
          await cleanMevTxBuffer(BRAND_NEW_BLOCK);
        }
      }
    });
  } catch (err) {
    console.log("err in subscribeToNewBlocks", err.message);
  }
}

let mevTxBuffer = [];
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

  if (mevTxBuffer.length === 4) {
    let poolOccurrences = countPoolOccurrences(mevTxBuffer);
    mevTxBuffer = filterTransactionsByTopRankedPool(mevTxBuffer, poolOccurrences);
  }

  let numUniqueTxHashes = countUniqueTxHashes(mevTxBuffer);

  if (numUniqueTxHashes === 3) {
    await wait(4000); // giving time to catch tx4, in case there is one
    // fully scouted sandwich
    mevTxBuffer.sort(function (a, b) {
      return a.position - b.position;
    });

    try {
      let x = mevTxBuffer[0].extraData.buyer;
      if (!x) return;
    } catch (error) {
      return;
    }
    try {
      let x = mevTxBuffer[1].extraData.buyer;
      if (!x) return;
    } catch (error) {
      return;
    }

    const BUYER_0 = mevTxBuffer[0].extraData.buyer;
    const BUYER_2 = mevTxBuffer[2].extraData.buyer;

    if (BUYER_0 !== BUYER_2) return;

    const POOL_0 = mevTxBuffer[0].data.address;
    const POOL_1 = mevTxBuffer[1].data.address;
    const POOL_2 = mevTxBuffer[2].data.address;

    if (POOL_0 === POOL_1 && POOL_1 === POOL_2) {
      await processFullSandwich(mevTxBuffer);
    } else {
      mevTxBuffer = [mevTxBuffer[0], mevTxBuffer[2]];
      numUniqueTxHashes = 2;
    }
  }
}

function filterTransactionsByTopRankedPool(mevTxBuffer, poolOccurrences) {
  const topRankedPoolName = poolOccurrences[0].poolName;
  const filteredTxBuffer = mevTxBuffer.filter((tx) => tx.extraData.poolName === topRankedPoolName);

  return filteredTxBuffer;
}

function countPoolOccurrences(mevTxBuffer) {
  const poolNameOccurrences = {};

  for (let i = 0; i < mevTxBuffer.length; i++) {
    const poolName = mevTxBuffer[i].extraData.poolName;

    if (!poolNameOccurrences[poolName]) {
      poolNameOccurrences[poolName] = 1;
    } else {
      poolNameOccurrences[poolName]++;
    }
  }

  const poolOccurrencesArray = [];

  for (const [poolName, numberOfOccurances] of Object.entries(poolNameOccurrences)) {
    poolOccurrencesArray.push({
      poolName: poolName,
      numberOfOccurances: numberOfOccurances,
    });
  }

  return poolOccurrencesArray;
}

async function processFullSandwich(mevTxBuffer) {
  console.log("\nprocessFullSandwich");

  if (mevTxBuffer.some((tx) => tempMevStorage.includes(tx.txHash))) return; // exact sandwich had been processed already

  for (var i = 0; i < mevTxBuffer.length; i++) {
    tempMevStorage.push(mevTxBuffer[i].txHash);
  }

  let deltaVictim, coinNameBot, peacefulAmountOut, name, messagePosition1, messageVictim;

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
  } else {
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

  const UNIXTIME = await getBlockUnixtime(messagePosition0[1].blockNumber);
  const MEV_ENTRY = {
    type: "sandwich",
    blockNumber: messagePosition0[1].blockNumber,
    unixtime: UNIXTIME,
    profit: parseFloat(DELTA_MEV_BOT.replace(/,/g, "")),
    profitUnit: coinNameBot,
    loss: parseFloat(deltaVictim.replace(/,/g, "")),
    lossUnit: name,
    tx: [messagePosition0[1], messageVictim[1], messagePosition1[1]],
  };

  const POOL_ADDRESS = messagePosition0[0];
  emitter.emit("Update Table-MEV" + POOL_ADDRESS, MEV_ENTRY);

  if (writeToFile) saveTxEntry(POOL_ADDRESS, MEV_ENTRY);

  mevTxBuffer.length = 0;
  tempMevStorage.length = 0;
}

let prevTxHash;
async function buildSwapMessage(
  blockNumber,
  soldAddress,
  soldAmount,
  boughtAddress,
  boughtAmount,
  tokenSoldName,
  tokenBoughtName,
  poolAddress,
  txHash,
  buyer,
  to,
  position,
  poolName
) {
  if (txHash === prevTxHash) return;
  prevTxHash = txHash;

  let dollarAmount = await convertToUSD(tokenSoldName, soldAmount);
  if (!dollarAmount) dollarAmount = await convertToUSD(tokenBoughtName, boughtAmount);

  if (isNaN(dollarAmount)) {
    console.log("undefined dollarAmount when swapping", tokenSoldName, "to", tokenBoughtName);
    return "abort";
  }

  // adding fee
  let holderFee = getHolderFee(dollarAmount, poolAddress);

  dollarAmount = formatForPrint(dollarAmount);
  holderFee = formatForPrint(holderFee);

  soldAmount = formatForPrint(soldAmount);
  boughtAmount = formatForPrint(boughtAmount);

  console.log("sold", soldAmount, tokenSoldName, "bought", boughtAmount, tokenBoughtName, "(" + dollarAmount + "$)");

  const UNIXTIME = await getBlockUnixtime(blockNumber);
  const ENTRY = {
    type: "swap",
    txHash: txHash,
    blockNumber: blockNumber,
    position: position,
    trader: buyer,
    tradeDetails: {
      amountIn: parseFloat(soldAmount.replace(/,/g, "")),
      nameIn: tokenSoldName,
      amountOut: parseFloat(boughtAmount.replace(/,/g, "")),
      nameOut: tokenBoughtName,
      feeUSD: parseFloat(holderFee.replace(/,/g, "")),
      valueUSD: parseFloat(dollarAmount.replace(/,/g, "")),
    },
    unixtime: UNIXTIME,
  };

  if (writeToFile) {
    saveTxEntry(poolAddress, ENTRY);

    const PRICE_ENTRY = await savePriceEntry(poolAddress, blockNumber, UNIXTIME);
    const BALANCES_ENTRY = await fetchBalancesOnce(poolAddress, blockNumber);
    const VOLUME_ENTRY = { [UNIXTIME]: parseFloat(dollarAmount.replace(/,/g, "")) };
    const BALANCES = Object.values(BALANCES_ENTRY)[0];

    let tvlEntry = [];
    if (BALANCES_ENTRY.length !== 0) {
      const TVL = BALANCES.reduce((a, b) => a + b, 0);
      tvlEntry = { [UNIXTIME]: TVL };
    }

    if (!isCollecting) {
      await updateBondingCurvesForPool(poolAddress);

      const UPDATE = {
        all: ENTRY,
        unixtime: UNIXTIME,
        price: PRICE_ENTRY,
        balances: BALANCES_ENTRY,
        volume: VOLUME_ENTRY,
        tvl: tvlEntry,
      };

      emitter.emit("General Pool Update" + poolAddress, UPDATE);
    }
  }
  return [poolAddress, ENTRY];
}

async function buildRemovalMessage(blockNumber, coinAmount, tokenRemovedName, poolAddress, txHash, agentAddress, position, removedAddress) {
  let dollarAmount = await convertToUSD(tokenRemovedName, coinAmount);

  if (isNaN(dollarAmount)) return "abort";
  dollarAmount = formatForPrint(dollarAmount);

  coinAmount = formatForPrint(coinAmount);
  let poolName = await buildPoolName(poolAddress);

  console.log("removed", coinAmount, tokenRemovedName, "from", poolName, "(" + dollarAmount + "$)");

  const stakedTokenArray = [];
  stakedTokenArray.push({
    amountOut: parseFloat(coinAmount.replace(/,/g, "")),
    nameOut: tokenRemovedName,
    valueUSD: parseFloat(dollarAmount.replace(/,/g, "")),
  });

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

  if (writeToFile) {
    saveTxEntry(poolAddress, ENTRY);
    const PRICE_ENTRY = await savePriceEntry(poolAddress, blockNumber, UNIXTIME);
    const BALANCES_ENTRY = await fetchBalancesOnce(poolAddress, blockNumber);
    const VOLUME_ENTRY = { [UNIXTIME]: parseFloat(dollarAmount.replace(/,/g, "")) };
    const BALANCES = Object.values(BALANCES_ENTRY)[0];

    let tvlEntry = [];
    if (BALANCES_ENTRY.length !== 0) {
      const TVL = BALANCES.reduce((a, b) => a + b, 0);
      tvlEntry = { [UNIXTIME]: TVL };
    }

    if (!isCollecting) {
      await updateBondingCurvesForPool(poolAddress);

      const UPDATE = {
        all: ENTRY,
        unixtime: UNIXTIME,
        price: PRICE_ENTRY,
        balances: BALANCES_ENTRY,
        volume: VOLUME_ENTRY,
        tvl: tvlEntry,
      };

      emitter.emit("General Pool Update" + poolAddress, UPDATE);
    }
  }
  return [poolAddress, ENTRY];
}

async function buildDepositMessage(blockNumber, coinArray, poolAddress, txHash, agentAddress, position, to, buyer) {
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
      amountIn: parseFloat(coinAmount.replace(/,/g, "")),
      nameIn: tokenDepositedName,
      valueUSD: Number(dollarAmount),
    });
  }

  let dollarAmount = formatForPrint(dollarAmountTotal);

  if (isNaN(dollarAmountTotal)) {
    console.log("no dollar value known for", tokenDepositedName, "(NaN)", dollarAmountTotal);
    return "abort";
  }
  let poolName = await buildPoolName(poolAddress);

  // removed, too much text for 1.5$ fee on a 5M$ deposit
  // let holderFee = await getFeesSimple(originalPoolAddress, feeArray)

  console.log("deposited", dollarAmount + "$ into", poolName);

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

  if (writeToFile) {
    saveTxEntry(poolAddress, ENTRY);
    const PRICE_ENTRY = await savePriceEntry(poolAddress, blockNumber, UNIXTIME);
    const BALANCES_ENTRY = await fetchBalancesOnce(poolAddress, blockNumber);
    const VOLUME_ENTRY = { [UNIXTIME]: dollarAmountTotal };
    const BALANCES = Object.values(BALANCES_ENTRY)[0];

    let tvlEntry = [];
    if (BALANCES_ENTRY.length !== 0) {
      const TVL = BALANCES.reduce((a, b) => a + b, 0);
      tvlEntry = { [UNIXTIME]: TVL };
    }

    if (!isCollecting) {
      await updateBondingCurvesForPool(poolAddress);

      const UPDATE = {
        all: ENTRY,
        unixtime: UNIXTIME,
        price: PRICE_ENTRY,
        balances: BALANCES_ENTRY,
        volume: VOLUME_ENTRY,
        tvl: tvlEntry,
      };

      emitter.emit("General Pool Update" + poolAddress, UPDATE);
    }
  }
  return [poolAddress, ENTRY];
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
    try {
      CONTRACT_REMOVE_LIQUIDITY.events
        .RemoveLiquidity()
        .on("data", async (data) => {
          await processRemoveLiquidity(data, POOL_ADDRESS);
        })
        .on("error", (error) => {
          console.error("Error in RemoveLiquidity event: ", error);
        });
    } catch (err) {
      console.log("err in fetching events for RemoveLiquidity", err.message);
    }

    // RemoveLiquidityOne
    const CONTRACT_REMOVE_LIQUIDITY_ONE = new wsKEY2.eth.Contract(ABI_REMOVE_LIQUIDITY_ONE, POOL_ADDRESS);
    try {
      CONTRACT_REMOVE_LIQUIDITY_ONE.events
        .RemoveLiquidityOne()
        .on("data", async (data) => {
          await processRemoveLiquidityOne(data, POOL_ADDRESS);
        })
        .on("error", (error) => {
          console.error("Error in RemoveLiquidityOne event: ", error);
        });
    } catch (err) {
      console.log("err in fetching events for RemoveLiquidityOne", err.message);
    }

    // RemoveLiquidityImbalance
    const CONTRACT_REMOVE_LIQUIDITY_IMBALANCE = new wsKEY3.eth.Contract(ABI_REMOVE_LIQUIDITY_IMBALANCE, POOL_ADDRESS);
    try {
      CONTRACT_REMOVE_LIQUIDITY_IMBALANCE.events
        .RemoveLiquidityImbalance()
        .on("data", async (data) => {
          await processRemoveLiquidityImbalance(data, POOL_ADDRESS);
        })
        .on("error", (error) => {
          console.error("Error in RemoveLiquidityImbalance event: ", error);
        });
    } catch (err) {
      console.log("err in fetching events for RemoveLiquidityImbalance", err.message);
    }

    // AddLiquidity
    const CONTRACT_ADD_LIQUIDITY = new wsKEY4.eth.Contract(ABI_ADD_LIQUIDITY, POOL_ADDRESS);
    try {
      CONTRACT_ADD_LIQUIDITY.events
        .AddLiquidity()
        .on("data", async (data) => {
          await new Promise((resolve) => setTimeout(resolve, 5000));
          await processAddLiquidity(data, POOL_ADDRESS);
        })
        .on("error", (error) => {
          console.error("Error in AddLiquidity event: ", error);
        });
    } catch (err) {
      console.log("err in fetching events for AddLiquidity", err.message);
    }

    // TokenExchange
    const CONTRACT_TOKEN_EXCHANGE = new wsKEY5.eth.Contract(ABI_TOKEN_EXCHANGE, POOL_ADDRESS);
    try {
      CONTRACT_TOKEN_EXCHANGE.events
        .TokenExchange()
        .on("data", async (data) => {
          await processTokenExchange(data, POOL_ADDRESS);
        })
        .on("error", (error) => {
          console.error("Error in TokenExchange event: ", error);
        });
    } catch (err) {
      console.log("err in fetching events for TokenExchange", err.message);
    }

    // TokenExchange2
    const CONTRACT_TOKEN_EXCHANGE_2 = new wsKEY1.eth.Contract(ABI_TOKEN_EXCHANGE_2, POOL_ADDRESS);
    try {
      CONTRACT_TOKEN_EXCHANGE_2.events
        .TokenExchange()
        .on("data", async (data) => {
          await processTokenExchange(data, POOL_ADDRESS);
        })
        .on("error", (error) => {
          console.error("Error in TokenExchange2 event: ", error);
        });
    } catch (err) {
      console.log("err in fetching events for TokenExchange2", err.message);
    }

    // TokenExchangeUnderlying
    const CONTRACT_TOKEN_EXCHANGE_UNDERLYING = new wsKEY2.eth.Contract(ABI_EXCHANGE_UNDERLYING, POOL_ADDRESS);
    try {
      CONTRACT_TOKEN_EXCHANGE_UNDERLYING.events
        .TokenExchangeUnderlying()
        .on("data", async (data) => {
          await processTokenExchange(data, POOL_ADDRESS, "TokenExchangeUnderlying");
        })
        .on("error", (error) => {
          console.error("Error in TokenExchangeUnderlying event: ", error);
        });
    } catch (err) {
      console.log("err in fetching events for TokenExchangeUnderlying", err.message);
    }
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
    if (!tokenAddress) break;
    if (isNullAddress(tokenAddress)) break;
    if (isNativeEthAddress(tokenAddress)) ethSpotter = 1;
    const TRANSFER_AMOUNTS = await getTokenTransfers(tokenAddress, blockNumber);
    for (const TRANSFER_AMOUNT of TRANSFER_AMOUNTS) {
      if (TRANSFER_AMOUNT === coinAmount) {
        return tokenAddress;
      }
    }
    id += 1;
  }
  if ((isNullAddress(tokenAddress) || !tokenAddress) && ethSpotter === 1) {
    return ADDRESS_ETH;
  } else {
    return "0 transfers";
  }
}

// RemoveLiquidity
async function processRemoveLiquidity(data, poolAddress) {
  console.log("\npool", poolAddress, " | block", data.blockNumber.toString(), " | txHash", data.transactionHash, " | RemoveLiquidity");
}

// RemoveLiquidityOne
async function processRemoveLiquidityOne(data, poolAddress) {
  const TX_HASH = data.transactionHash;
  const BLOCK_NUMBER = data.blockNumber;
  const PROVIDER = data.returnValues.provider;
  let type;
  console.log("\npool", poolAddress, " | block", data.blockNumber.toString(), " | txHash", TX_HASH, " | RemoveLiquidityOne");
  if (data.event && data.event === "TokenExchange") return;
  if (CURVE_POOLS.includes(PROVIDER)) {
    const DATA = await checkForTokenExchangeUnderlying(PROVIDER, BLOCK_NUMBER, TX_HASH);
    await processTokenExchange(DATA, PROVIDER, "TokenExchangeUnderlying");
    return;
  }

  let coinAmount = Number(data.returnValues.coin_amount);
  const TOKEN_REMOVED_ADDRESS = await getTokenAddressFromStake(poolAddress, BLOCK_NUMBER, coinAmount);
  if (TOKEN_REMOVED_ADDRESS === "0 transfers") return;
  coinAmount = await getCleanedTokenAmount(TOKEN_REMOVED_ADDRESS, coinAmount);
  const TOKEN_REMOVED_NAME = await getTokenName(TOKEN_REMOVED_ADDRESS);
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
          await buildSwapMessage(
            BLOCK_NUMBER,
            SOLD_ADDRESS,
            soldAmount,
            BOUGHT_ADDRESS,
            boughtAmount,
            TOKEN_SOLD_NAME,
            TOKEN_BOUGHT_NAME,
            _POOL_ADDRESS,
            TX_HASH,
            BUYER,
            TO,
            POSITION,
            POOL_NAME
          );
        } else {
          console.log("blockPosition", POSITION, TX_HASH);
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

  const AGENT_ADDRESS = TX.from;
  const TO = TX.to;
  const POSITION = TX.transactionIndex;

  if (POSITION > 7) {
    tempTxHashStorage.push({
      TX_HASH,
      time: getUnixtime(),
    });
    await buildRemovalMessage(BLOCK_NUMBER, coinAmount, TOKEN_REMOVED_NAME, poolAddress, TX_HASH, AGENT_ADDRESS, POSITION, TOKEN_REMOVED_ADDRESS);
  } else {
    console.log("blockPosition", POSITION, TX_HASH);
    const extraData = {
      coinAmount: coinAmount,
      tokenRemovedName: TOKEN_REMOVED_NAME,
      removedAddress: TOKEN_REMOVED_ADDRESS,
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
  console.log("\npool", poolAddress, " | block", data.blockNumber.toString(), " | txHash", data.transactionHash, " | RemoveLiquidityImbalance");

  const CURVE_JSON = JSON.parse(fs.readFileSync("./JSON/CurvePoolData.json"));

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
  const TOKEN_REMOVED_ADDRESS = CURVE_JSON[poolAddress].coins[i];
  const TOKEN_REMOVED_NAME = CURVE_JSON[poolAddress].coin_names[i];
  const AGENT_ADDRESS = TX.from;
  const TO = TX.to;

  coinAmount = await getCleanedTokenAmount(TOKEN_REMOVED_ADDRESS, coinAmount);

  if (POSITION > 7) {
    tempTxHashStorage.push({
      TX_HASH,
      time: getUnixtime(),
    });
    await buildRemovalMessage(BLOCK_NUMBER, coinAmount, TOKEN_REMOVED_NAME, poolAddress, TX_HASH, AGENT_ADDRESS, POSITION, TOKEN_REMOVED_ADDRESS);
  } else {
    console.log("blockPosition", POSITION, TX_HASH);
    const extraData = {
      coinAmount: coinAmount,
      tokenRemovedName: TOKEN_REMOVED_NAME,
      removedAddress: TOKEN_REMOVED_ADDRESS,
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
  console.log("\npool", poolAddress, " | block", data.blockNumber.toString(), " | txHash", TX_HASH, " | AddLiquidity");

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
    console.log("blockPosition", POSITION, TX_HASH);
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
  if (isTokenExchangeUnderlying(data.event)) {
    type = "TokenExchangeUnderlying";
  } else {
    type = "TokenExchange";
  }
  console.log("\npool", poolAddress, " | block", data.blockNumber.toString(), " | txHash", TX_HASH, " |", type);

  const TX = await getTx(TX_HASH);
  const TO = TX.to;
  const BLOCK_NUMBER = TX.blockNumber;
  const POSITION = TX.transactionIndex;
  const BUYER = TX.from;
  const DECODED_TX = ABI_DECODER.decodeMethod(TX.input);

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
  } else if (isTokenExchangeUnderlying(type)) {
    res = await tokenExchangeCaseUnderlying(BLOCK_NUMBER, TX, TO, SOLD_ID, TOKENS_SOLD, BOUGHT_ID, TOKENS_BOUGHT, poolAddress);
  } else {
    res = await tokenExchangeCaseSingle(SOLD_ID, TOKENS_SOLD, BOUGHT_ID, TOKENS_BOUGHT, poolAddress);
  }

  let [soldAmount, boughtAmount, tokenSoldName, soldAddress, tokenBoughtName, boughtAddress] = res;

  if (POSITION > 7) {
    tempTxHashStorage.push({
      TX_HASH,
      time: getUnixtime(),
    });
    await buildSwapMessage(BLOCK_NUMBER, soldAddress, soldAmount, boughtAddress, boughtAmount, tokenSoldName, tokenBoughtName, poolAddress, TX_HASH, BUYER, TO, POSITION, poolName);
  } else {
    console.log("blockPosition", POSITION, TX_HASH);
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

async function searchEventsInBlock(blockNumber, UNPROCESSED_EVENT_LOGS, EVENT_NAMES) {
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
  const UNPROCESSED_EVENT_LOGS = JSON.parse(fs.readFileSync("./JSON/UnprocessedEventLogs.json"));
  const EVENT_NAMES = ["RemoveLiquidity", "RemoveLiquidityOne", "RemoveLiquidityImbalance", "AddLiquidity", "TokenExchange", "TokenExchangeUnderlying"];

  let lastPercentage = 0;
  let i = 0;

  for (let blockNumber = firstBlock; blockNumber < firstBlock + range; blockNumber++) {
    await cleanMevTxBuffer(blockNumber);
    const PERCENTAGE = Number(((i / range) * 100).toFixed(0));

    if (PERCENTAGE !== lastPercentage) {
      //console.log("processing",PERCENTAGE, "%");
      lastPercentage = PERCENTAGE;
    }

    await searchEventsInBlock(blockNumber, UNPROCESSED_EVENT_LOGS, EVENT_NAMES);
    i += 1;
  }
}

async function collectionCycle(nextBlockToProceedProcessing, range) {
  await collection();

  //  this loop is used to give the raw log collection enough time to be processed and saved.
  while (true) {
    const IS_COLLECTING = JSON.parse(fs.readFileSync("./JSON/CollectorState.json"));
    if (!IS_COLLECTING.collectingRawLog) break;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  await searchFromLogsInRange(nextBlockToProceedProcessing, range);
}

/**
 * goal: up to date json with sorted and processed transaction-lists
 * 1: removes entries older than x days (31 for mvp) from the file which stores the raw, unprocessed events (UnprocessedEventLogs.json)
 * 2: adds raw log entries to the file
 * 3: processes the newly added events and stores the processed data in ProcessedTxLogAll.json & ProcessedTxLogMEV.json
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
  bootPriceJSON();
  bootBalancesJSON();
  // using socket.io, this function will iterate over all pools and create and open a custom sockets per pool, for the frontend to connect to.
  if (MODE === "local") {
    await httpSocketSetup(Server, emitter, whiteListedPoolAddress);
  }
  if (MODE === "https") {
    await httpsSocketSetup(Server, emitter, whiteListedPoolAddress);
  }

  await priceCollectionMain(whiteListedPoolAddress);
  await balancesCollectionMain(whiteListedPoolAddress);

  isCollecting = true;
  writeToFile = true;

  let latestBlock = 0;
  let latestBlockAfterProcessing = 10;

  const MAX_TRIES = 12;
  let tryCount = 0;

  while (latestBlockAfterProcessing > latestBlock + 5 && tryCount < MAX_TRIES) {
    latestBlock = await getCurrentBlockNumber();
    await collectionMain();
    await priceCollectionMain(whiteListedPoolAddress);
    await balancesCollectionMain(whiteListedPoolAddress);
    latestBlockAfterProcessing = await getCurrentBlockNumber();
    tryCount++;
  }

  console.log("all events fetched and processed");

  await updateBondingCurvesForPool(whiteListedPoolAddress);

  // sending out the data
  emitter.emit("all events fetched and processed" + whiteListedPoolAddress);
  isCollecting = false;

  await activateRealTimeMonitoring(singlePoolModus, whiteListedPoolAddress);
  await subscribeToNewBlocks(); // should be active by default, unless during some tests
}

let isCollecting;

// toggle to write the trades to the json
let writeToFile;

// for mvp, only listens to new events on a single poolAddress
let singlePoolModus = true;

// sUSD pool for mvp
let whiteListedPoolAddress = ADDRESS_sUSD_V2_SWAP;

// show ExchangeMultiple zoomed into target pool (for susd in mvp)
let zoom = true;

// const MODE = "local";
const MODE = "https";
console.log(MODE + "-mode");

// choosing key-sets
initWeb3Sockets("dashboard");

await CurveMonitor();
