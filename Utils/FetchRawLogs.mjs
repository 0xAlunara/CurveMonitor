import fs from "fs";

import { getABI, getCurvePools } from "./GenericUtils.mjs";
import { getCurrentBlockNumber, getContract } from "./Web3CallUtils.mjs";

import { config } from "dotenv";
config();

async function getStartBlock(CURRENT_BLOCK) {
  const SECONDS_IN_A_DAY = 86400;
  const TIME_IN_DAYS = 31;
  const SECONDS_TO_COVER = SECONDS_IN_A_DAY * TIME_IN_DAYS;
  const SECONDS_BETWEEN_BLOCKS = 12;
  const TOTAL_BLOCKS_TO_COVER = SECONDS_TO_COVER / SECONDS_BETWEEN_BLOCKS;
  const START_BLOCK = Number((CURRENT_BLOCK - TOTAL_BLOCKS_TO_COVER).toFixed(0));
  return START_BLOCK;
}

function getCollectedData(CURVE_POOLS, EVENT_NAMES) {
  let collectedData;
  try {
    collectedData = JSON.parse(fs.readFileSync("./JSON/UnprocessedEventLogs.json"));
  } catch (error) {
    collectedData = {};
  }
  for (const POOL_ADDRESS of CURVE_POOLS) {
    if (!collectedData[POOL_ADDRESS]) collectedData[POOL_ADDRESS] = {};

    for (const EVENT_NAME of EVENT_NAMES) {
      if (!collectedData[POOL_ADDRESS][EVENT_NAME]) {
        collectedData[POOL_ADDRESS][EVENT_NAME] = [];
      }
    }
  }
  fs.writeFileSync("./JSON/UnprocessedEventLogs.json", JSON.stringify(collectedData, null, 1));
  return collectedData;
}

function findLatestCapturedBlockInRawEventLog(poolAddress, eventNames, collectedData) {
  let latestCapturedBlock = 0;
  for (const EVENT_NAME of eventNames) {
    const EVENT_SPECIFIC_LOG = collectedData[poolAddress][EVENT_NAME];
    if (EVENT_SPECIFIC_LOG.length === 0) continue;
    const BLOCK_NUMBER = EVENT_SPECIFIC_LOG[EVENT_SPECIFIC_LOG.length - 1].blockNumber;
    if (BLOCK_NUMBER > latestCapturedBlock) {
      latestCapturedBlock = BLOCK_NUMBER;
    }
  }
  return latestCapturedBlock;
}

async function collectEventsForName(CONTRACT, eventName, fromBlock, toBlock) {
  let events = [];
  let blockRange = toBlock - fromBlock;
  const HIGHEST_BLOCK = toBlock;

  while (true) {
    let fetchedEvents = await fetchEventOnce(CONTRACT, eventName, fromBlock, toBlock);

    if (typeof fetchedEvents === "string") {
      blockRange = Math.floor(blockRange / 2);
      toBlock = fromBlock + blockRange;
    } else {
      events.push(...fetchedEvents);

      // Check if we've fetched all events within the original block range
      if (toBlock >= HIGHEST_BLOCK) break;

      // If not, move the range forward and continue fetching
      fromBlock = toBlock + 1;
      toBlock = HIGHEST_BLOCK;
    }
  }

  console.log(`collected events ${events.length} for ${eventName}`);
  return events;
}

async function fetchEventOnce(CONTRACT, eventName, fromBlock, toBlock) {
  const EVENT_ARRAY = [];
  try {
    await CONTRACT.getPastEvents(eventName, { fromBlock, toBlock }, async function (error, events) {
      if (error) {
        if (error.message.includes("Log response size exceeded")) {
          return "oversized";
        } else {
          console.log(error);
        }
      } else {
        for (const DATA of events) {
          EVENT_ARRAY.push(DATA);
        }
      }
    });
  } catch (err) {
    if (!err.message.includes("compute units per second capacity")) {
      if (err.message.includes("Log response size exceeded")) return "oversized";
      console.log(err);
    } else {
      await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * (400 - 200 + 1) + 200)));
      return await fetchEventOnce(CONTRACT, eventName, fromBlock, toBlock);
    }
  }
  return EVENT_ARRAY;
}

function addAndWriteEventToRawLog(POOL_ADDRESS, EVENT_NAME, res) {
  let unprocessedEventLogs = JSON.parse(fs.readFileSync("./JSON/UnprocessedEventLogs.json"));
  let prevSavedLogsForPoolAndEvent = unprocessedEventLogs[POOL_ADDRESS][EVENT_NAME];
  if (Array.isArray(res)) {
    unprocessedEventLogs[POOL_ADDRESS][EVENT_NAME] = [...prevSavedLogsForPoolAndEvent, ...res];
  } else {
    unprocessedEventLogs[POOL_ADDRESS][EVENT_NAME] = [...prevSavedLogsForPoolAndEvent, res];
  }
  fs.writeFileSync("./JSON/UnprocessedEventLogs.json", JSON.stringify(unprocessedEventLogs, null, 1));
}

async function collectRawLogs() {
  console.log("started collection of raw logs");
  const CURVE_POOLS = getCurvePools();
  const EVENT_NAMES = ["TokenExchange", "RemoveLiquidity", "RemoveLiquidityOne", "RemoveLiquidityImbalance", "AddLiquidity", "TokenExchangeUnderlying"];

  let collectedData = getCollectedData(CURVE_POOLS, EVENT_NAMES);

  for (const POOL_ADDRESS of CURVE_POOLS) {
    if (POOL_ADDRESS !== "0xA5407eAE9Ba41422680e2e00537571bcC53efBfD") continue;
    const ABI = await getABI(POOL_ADDRESS);

    let toBlock = await getCurrentBlockNumber();

    let fromBlock = findLatestCapturedBlockInRawEventLog(POOL_ADDRESS, EVENT_NAMES, collectedData);
    if (fromBlock === 0) fromBlock = await getStartBlock(toBlock);
    fromBlock += 1;

    for (const EVENT_NAME of EVENT_NAMES) {
      if (!JSON.stringify(ABI).includes(EVENT_NAME)) continue;

      const CONTRACT = await getContract(ABI, POOL_ADDRESS);
      let res = await collectEventsForName(CONTRACT, EVENT_NAME, fromBlock, toBlock);
      addAndWriteEventToRawLog(POOL_ADDRESS, EVENT_NAME, res);
    }
  }
  return true;
}

export { collectRawLogs, addAndWriteEventToRawLog };
