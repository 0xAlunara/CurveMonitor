import fs from "fs";
import Web3 from "web3";

import { getABI } from "./GenericUtils.mjs";
import { getCurrentBlockNumber } from "./Web3CallUtils.mjs";

import { config } from "dotenv";
config();

const options = {
  // Enable auto reconnection
  reconnect: {
    auto: true,
    delay: 10000, // ms
    maxAttempts: 50,
    onTimeout: false,
  },
};

const web3HTTP = new Web3(new Web3.providers.HttpProvider(process.env.web3HTTP, options));

function getContract(abi, address) {
  return new web3HTTP.eth.Contract(abi, address);
}

function getCurvePools() {
  const CURVE_JSON = JSON.parse(fs.readFileSync("./JSON/CurvePoolData.json"));

  const CURVE_POOLS = [];

  for (const POOL in CURVE_JSON) {
    CURVE_POOLS.push(POOL);
  }
  return CURVE_POOLS;
}

// takes the raw, unprocessed event logs
// sorts the events, adds or removes information, and stores the data for both the generic table and the mev table
function saveTxEntry(poolAddress, entry) {
  let path;
  if (entry.type === "sandwich") {
    path = "./JSON/ProcessedTxLogMEV.json";
  } else {
    path = "./JSON/ProcessedTxLogAll.json";
  }

  let tradeData;
  try {
    tradeData = JSON.parse(fs.readFileSync(path));
  } catch (err) {
    tradeData = {};
  }

  if (typeof tradeData[poolAddress] === "undefined") {
    tradeData[poolAddress] = [];
  }

  // check if the tx had been saved before
  if (entry.type === "sandwich") {
    const BLOCK_NUMBER = entry.txHash;
    for (const ENTRY of tradeData[poolAddress]) {
      if (BLOCK_NUMBER === ENTRY.blockNumber) return;
    }
  } else {
    const TX_HASH = entry.txHash;
    for (const ENTRY of tradeData[poolAddress]) {
      if (TX_HASH === ENTRY.txHash) return;
    }
  }

  tradeData[poolAddress].push(entry);
  fs.writeFileSync(path, JSON.stringify(tradeData, null, 2));
}

// finds the last event that has been processed for a given pool, so find the starting point for processing the raw event log
async function findLastProcessedEvent(poolAddress) {
  const PROCESSED_TX_LOG_ALL = JSON.parse(fs.readFileSync("./JSON/ProcessedTxLogAll.json"));
  const TX_ARRAY = PROCESSED_TX_LOG_ALL[poolAddress];
  const BIGGEST_BLOCK_NUMBER = TX_ARRAY.reduce((max, current) => {
    return Math.max(max, current.blockNumber);
  }, 0);
  // + 1 to not scan the last block twice
  return BIGGEST_BLOCK_NUMBER + 1;
}

// 1: removes outdated events
// 2: adds events in the time range of "lastly screened" and "now".
// 3: events stored in "UnprocessedEventLogs.json".json.
async function collection() {
  // collectionState.IsReadycollectingRawLogs is used to give the raw log collection enough time to be processed and saved.
  // only then proceeds with processing the raw logs
  let collectionState;
  try {
    collectionState = JSON.parse(fs.readFileSync("./JSON/CollectorState.json"));
  } catch (err) {
    console.log("can't find file CollectorState.json");
  }

  collectionState.IsReadycollectingRawLogs = false;
  collectionState.rawLogsUpToDate = false;
  fs.writeFileSync("./JSON/CollectorState.json", JSON.stringify(collectionState));

  // loading the file with the stored events, or creating it
  let collectedData;
  try {
    collectedData = JSON.parse(fs.readFileSync("./JSON/UnprocessedEventLogs.json"));
  } catch (err) {
    console.log("no file found called UnprocessedEventLogs.json");
  }

  const EVENT_NAMES = ["RemoveLiquidity", "RemoveLiquidityOne", "RemoveLiquidityImbalance", "AddLiquidity", "TokenExchange", "TokenExchangeUnderlying"];

  await removeOutdatedBlocksRawLog(EVENT_NAMES);
  await removeOutdatedBlocksProcessedLogALL();
  await removeOutdatedBlocksProcessedLogMEV();

  collectedData = JSON.parse(fs.readFileSync("./JSON/UnprocessedEventLogs.json"));

  const CURVE_POOLS = getCurvePools();

  // init the json structure (poolAddresses -> eventNames)
  for (const POOL_ADDRESS of CURVE_POOLS) {
    if (!collectedData[POOL_ADDRESS]) collectedData[POOL_ADDRESS] = {};

    for (const EVENT_NAME of EVENT_NAMES) {
      if (!collectedData[POOL_ADDRESS][EVENT_NAME]) {
        collectedData[POOL_ADDRESS][EVENT_NAME] = [];
      }
    }
  }

  fs.writeFileSync("./JSON/UnprocessedEventLogs.json", JSON.stringify(collectedData, null, 1));

  let i = 0;
  for (const POOL_ADDRESS of CURVE_POOLS) {
    if (POOL_ADDRESS !== "0xA5407eAE9Ba41422680e2e00537571bcC53efBfD") continue; // only does its thing for sUSD
    i += 1;
    const ABI = await getABI(POOL_ADDRESS);

    let fromBlock = findLatestCapturedBlockInRawEventLog(POOL_ADDRESS, EVENT_NAMES);
    if (fromBlock === 0) {
      fromBlock = await getStartBlock();
    }
    fromBlock += 1;
    let toBlock = await getCurrentBlockNumber();
    const MASTER_TO_BLOCK = toBlock;

    // interating over all event-types in a given pool
    for (const eventName of EVENT_NAMES) {
      // ABI does not contain the word <eventName>
      if (!JSON.stringify(ABI).includes(eventName)) continue;

      const CONTRACT = await getContract(ABI, POOL_ADDRESS);
      const MASTER_BLOCK_RANGE = MASTER_TO_BLOCK - fromBlock;
      await fetchEvents(collectedData, CONTRACT, eventName, EVENT_NAMES, MASTER_BLOCK_RANGE, MASTER_TO_BLOCK, POOL_ADDRESS, fromBlock, toBlock, i);
    }
  }
}

// writes events to the log-file.
// search params: pool, eventName, blockRange
async function fetchEvents(collectedData, CONTRACT, eventName, eventNames, masterBlockRange, masterToBlock, poolAddress, fromBlock, toBlock, i, foundEvents) {
  const RESULTS = collectedData[poolAddress][eventName];

  if (!foundEvents) foundEvents = 0;

  let shouldContinue = true;
  let retries = 0;
  while (shouldContinue && retries < 12) {
    await CONTRACT.getPastEvents(eventName, { fromBlock, toBlock }, async function (error, events) {
      if (error) {
        if (error.message.includes("Log response size exceeded")) {
          let blockRange = toBlock - fromBlock;
          blockRange = Number((blockRange / 10).toFixed(0));
          toBlock = fromBlock + blockRange;
          await fetchEvents(collectedData, CONTRACT, eventName, eventNames, masterBlockRange, masterToBlock, poolAddress, fromBlock, toBlock, i, foundEvents);
        } else if (error.message.includes("One of the blocks specified in filter (fromBlock, toBlock or blockHash) cannot be found")) {
          await new Promise((resolve) => setTimeout(resolve, 3000));
          shouldContinue = false;
          await fetchEvents(collectedData, CONTRACT, eventName, eventNames, masterBlockRange, masterToBlock, poolAddress, fromBlock, toBlock, i, foundEvents);
        } else {
          console.log("\nerror in getPastEvents", error.message, "\nfromBlock", fromBlock, "toBlock", toBlock);
        }
      } else {
        shouldContinue = false;
        if (events.length === 0) {
          // => no events left
          fs.writeFileSync("./JSON/UnprocessedEventLogs.json", JSON.stringify(collectedData, null, 1));
          if (eventName === eventNames[eventNames.length - 1]) {
            finalizeCollection("IsReadyCollectingRawLogs");
          }
          return;
        }

        // adding all the events to the results-array
        for (const DATA of events) {
          RESULTS.push(DATA);
        }
        foundEvents += events.length;

        // preparing params for next round
        const LAST_STORED_BLOCK = RESULTS[RESULTS.length - 1].blockNumber;
        fromBlock = LAST_STORED_BLOCK + 1;
        toBlock = masterToBlock;

        // starting a next scan-cycle to slowly catch up to the present blocks
        await fetchEvents(collectedData, CONTRACT, eventName, eventNames, masterBlockRange, masterToBlock, poolAddress, fromBlock, toBlock, i, foundEvents);
      }
    });
    retries++;
    await new Promise((resolve) => setTimeout(resolve, 280));
  }
}

// finds the block which was created 31 days ago
// used as the starting point for the event-collection
async function getStartBlock() {
  const SECONDS_IN_A_DAY = 86400;
  const TIME_IN_DAYS = 31;
  const SECONDS_TO_COVER = SECONDS_IN_A_DAY * TIME_IN_DAYS;
  const SECONDS_BETWEEN_BLOCKS = 12;
  const TOTAL_BLOCKS_TO_COVER = SECONDS_TO_COVER / SECONDS_BETWEEN_BLOCKS;
  const CURRENT_BLOCK = await getCurrentBlockNumber();
  const START_BLOCK = Number((CURRENT_BLOCK - TOTAL_BLOCKS_TO_COVER).toFixed(0));
  return START_BLOCK;
}

// this function removes events older than 31 days from the raw log-file.
// might get removed in the future.
async function removeOutdatedBlocksRawLog(eventNames) {
  let collectedData;
  try {
    collectedData = JSON.parse(fs.readFileSync("./JSON/UnprocessedEventLogs.json"));
  } catch (err) {
    collectedData = {};
    fs.writeFileSync("./JSON/UnprocessedEventLogs.json", "{}");
  }

  let total = 0;
  let outdated = 0;
  const START_BLOCK = await getStartBlock();
  for (const POOL_ADDRESS in collectedData) {
    for (const EVENT_NAME of eventNames) {
      const EVENT_SPECIFIC_LOG = collectedData[POOL_ADDRESS][EVENT_NAME];
      for (let i = 0; i < EVENT_SPECIFIC_LOG.length; i++) {
        const EVENT = EVENT_SPECIFIC_LOG[i];
        const BLOCK_NUMBER = EVENT.blockNumber;
        if (BLOCK_NUMBER <= START_BLOCK) {
          outdated += 1;
          EVENT_SPECIFIC_LOG.splice(i, 1);
          i--; // Decrement the index to account for the removed element
        }
        total += 1;
      }
    }
  }
  fs.writeFileSync("./JSON/UnprocessedEventLogs.json", JSON.stringify(collectedData, null, 1));
  console.log(total, "entries for unprocessedEventLogs");
}

// this function removes events older than 31 days from the processed tx log-file.
// might get removed in the future.
async function removeOutdatedBlocksProcessedLogALL() {
  let collectedData;
  try {
    collectedData = JSON.parse(fs.readFileSync("./JSON/ProcessedTxLogAll.json"));
  } catch (err) {
    collectedData = {};
    fs.writeFileSync("./JSON/ProcessedTxLogAll.json", "{}");
  }

  let total = 0;
  let outdated = 0;
  const START_BLOCK = await getStartBlock();
  for (const POOL_ADDRESS in collectedData) {
    const POOL_SPECIFIC_LOG = collectedData[POOL_ADDRESS];
    for (let i = 0; i < POOL_SPECIFIC_LOG.length; i++) {
      const EVENT = POOL_SPECIFIC_LOG[i];
      const BLOCK_NUMBER = EVENT.blockNumber;
      if (BLOCK_NUMBER <= START_BLOCK) {
        outdated += 1;
        POOL_SPECIFIC_LOG.splice(i, 1);
        i--; // Decrement the index to account for the removed element
      }
      total += 1;
    }
  }
  fs.writeFileSync("./JSON/ProcessedTxLogAll.json", JSON.stringify(collectedData, null, 1));
  console.log(total, "entries for processedTxLog_ALL");
}

// this function removes events older than 31 days from the processed tx mev log-file.
// might get removed in the future.
async function removeOutdatedBlocksProcessedLogMEV() {
  let collectedData;
  try {
    collectedData = JSON.parse(fs.readFileSync("./JSON/ProcessedTxLogMEV.json"));
  } catch (err) {
    collectedData = {};
    fs.writeFileSync("./JSON/ProcessedTxLogMEV.json", "{}");
  }

  let total = 0;
  let outdated = 0;
  const START_BLOCK = await getStartBlock();
  for (const POOL_ADDRESS in collectedData) {
    const POOL_SPECIFIC_LOG = collectedData[POOL_ADDRESS];
    for (let i = 0; i < POOL_SPECIFIC_LOG.length; i++) {
      const EVENT = POOL_SPECIFIC_LOG[i];
      const BLOCK_NUMBER = EVENT.blockNumber;
      if (BLOCK_NUMBER <= START_BLOCK) {
        outdated += 1;
        POOL_SPECIFIC_LOG.splice(i, 1);
        i--; // Decrement the index to account for the removed element
      }
      total += 1;
    }
  }
  fs.writeFileSync("./JSON/ProcessedTxLogMEV.json", JSON.stringify(collectedData, null, 1));
  console.log(total, "entries for processedTxLog_MEV");
}

// opens the stored logs for a pool and returns the last block that was saved for that pool.
// used to find the spot in time for which the data-collection should get resumed.
function findLatestCapturedBlockInRawEventLog(poolAddress, eventNames) {
  let latestCapturedBlock = 0;
  const COLLECTED_DATA = JSON.parse(fs.readFileSync("./JSON/UnprocessedEventLogs.json"));
  for (const EVENT_NAME of eventNames) {
    const EVENT_SPECIFIC_LOG = COLLECTED_DATA[poolAddress][EVENT_NAME];
    for (let i = 0; i < EVENT_SPECIFIC_LOG.length; i++) {
      const EVENT = EVENT_SPECIFIC_LOG[i];
      const BLOCK_NUMBER = EVENT.blockNumber;
      if (BLOCK_NUMBER > latestCapturedBlock) {
        latestCapturedBlock = BLOCK_NUMBER;
      }
    }
  }
  return latestCapturedBlock;
}

// returns for example [{ DAI: 18907891 },{ USDC: 18942092 },{ USDT: 17561645 },{ sUSD: 14716529 }]
async function getTokenBalancesInsidePool(provider, poolAddress, blockNumber) {
  const ABI_METAREGISTRY = await getABI("0xF98B45FA17DE75FB1aD0e7aFD971b0ca00e379fC");
  const METAREGISTRY = new provider.eth.Contract(ABI_METAREGISTRY, "0xF98B45FA17DE75FB1aD0e7aFD971b0ca00e379fC");
  let balances = await web3Call(METAREGISTRY, "get_balances", [poolAddress], blockNumber);

  // removing 0,0,0 from the end
  const CURVE_JSON = JSON.parse(fs.readFileSync("./JSON/CurvePoolData.json"));
  const NUMBER_COINS = CURVE_JSON[poolAddress].n_coins;
  const NUMBER_OF_O_ENTRIES = balances.length - NUMBER_COINS;
  balances = balances.filter((balances, i) => i + NUMBER_OF_O_ENTRIES < balances.length);

  // adjusting for decimals to normalize
  for (let i = 0; i < NUMBER_COINS; i++) {
    const DECIMALS = CURVE_JSON[poolAddress].decimals[i];
    const TOKEN_BALANCE = balances[i];
    const NAME = CURVE_JSON[poolAddress].coin_names[i];
    balances[i] = { [NAME]: Number((TOKEN_BALANCE / 10 ** DECIMALS).toFixed(0)) };
  }

  return balances;
}

function finalizeCollection(process) {
  let collectionState = JSON.parse(fs.readFileSync("./JSON/CollectorState.json"));
  collectionState[process] = true;
  fs.writeFileSync("./JSON/CollectorState.json", JSON.stringify(collectionState));
}

export {
  saveTxEntry,
  findLastProcessedEvent,
  collection,
  fetchEvents,
  getStartBlock,
  removeOutdatedBlocksRawLog,
  findLatestCapturedBlockInRawEventLog,
  getTokenBalancesInsidePool,
  finalizeCollection,
};
