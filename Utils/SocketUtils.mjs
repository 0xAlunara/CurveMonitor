import fs from "fs";
import https from "https";

import { getCurvePools } from "./GenericUtils.mjs";
import { readBalancesArray } from "./BalancesUtils.mjs";

// utils for price-data
import { readPriceArray } from "./PriceUtils.mjs";

// for the search bar on the landing page
import { search } from "./SearchUtils.mjs";

// utils to fetch and store bonding curves
import { getBondingCurveForPoolAndCombination } from "./BondingCurveUtils.mjs";

async function httpSocketSetup(Server, emitter, whiteListedPoolAddress) {
  const io = new Server(2424, {
    cors: {
      origin: "http://localhost:2424",
      methods: ["GET", "POST"],
    },
  });

  await initSocketMessages(io, emitter, whiteListedPoolAddress);
  await startLandingSocket(io);
}

async function httpsSocketSetup(Server, emitter, whiteListedPoolAddress) {
  const httpsServer = https.createServer({
    key: fs.readFileSync("/home/transactions/certs/privkey1.pem"),
    cert: fs.readFileSync("/home/transactions/certs/cert1.pem"),
    ca: fs.readFileSync("/home/transactions/certs/fullchain1.pem"),
  });

  const io = new Server(httpsServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    requestCert: false,
    rejectUnauthorized: false,
  });

  await initSocketMessages(io, emitter, whiteListedPoolAddress);
  await startLandingSocket(io);

  httpsServer.listen(2053);
}

async function startLandingSocket(io) {
  const LANDING_SOCKET = io.of("/");
  LANDING_SOCKET.on("connection", async (socket) => {
    console.log("landing_socket connected");
    socket.on("search", (data) => {
      try {
        const res = search(data);
        socket.emit("search_res", res);
      } catch (err) {
        console.log("err in search:", err.message);
      }
    });
    socket.on("ping", () => {
      socket.emit("pong");
    });
    socket.on("disconnect", () => {
      console.log("client disconnected from landing page");
    });
  });
}

// making use of socket.io rooms
async function manageUpdates(POOL_SOCKET, emitter, POOL_ADDRESS, timeFrame, priceCombination) {
  emitter.on("General Pool Update" + POOL_ADDRESS, async (data) => {
    console.log("General Pool Update", data);
    POOL_SOCKET.in(POOL_ADDRESS).emit("Update Table-ALL", data.all);
    POOL_SOCKET.in(POOL_ADDRESS).emit("Update Volume-Chart", data.volume);
    if (data.price.length !== 0) POOL_SOCKET.in(POOL_ADDRESS).emit("Update Price-Chart", data.price);
    if (data.balances.length !== 0) POOL_SOCKET.in(POOL_ADDRESS).emit("Update Balance-Chart", data.balances);
    if (data.tvl.length !== 0) POOL_SOCKET.in(POOL_ADDRESS).emit("Update TVL-ALL", data.tvl);
  });

  emitter.on("Update Table-MEV" + POOL_ADDRESS, async (data) => {
    POOL_SOCKET.in(POOL_ADDRESS).emit("Update Table-MEV", data);
  });

  // messages once all data is ready
  emitter.on("all events fetched and processed" + POOL_ADDRESS, () => {
    sendDefaultInitMessage(POOL_SOCKET, POOL_ADDRESS, timeFrame, priceCombination);
  });
}

function sendDefaultInitMessage(POOL_SOCKET, POOL_ADDRESS, timeFrame, priceCombination) {
  sendTableData(POOL_SOCKET, POOL_ADDRESS);
  sendPriceData(timeFrame, POOL_SOCKET, POOL_ADDRESS, priceCombination);
  sendBalanceData(timeFrame, POOL_SOCKET, POOL_ADDRESS);
  sendVolumeData(timeFrame, POOL_SOCKET, POOL_ADDRESS);
  sendTVLData(timeFrame, POOL_SOCKET, POOL_ADDRESS);
  sendBondingCurve(POOL_SOCKET, POOL_ADDRESS, priceCombination);
}

/**
 * on pool connect:
 * send table data full (so one month)
 * send data cut for 1 month for: price chart (later balances and more)
 * then socket.on("timePeriod") => send data for: price chart (later balances and more)
 */

async function initSocketMessages(io, emitter, whiteListedPoolAddress) {
  const POOLS = getCurvePools();
  for (const POOL_ADDRESS of POOLS) {
    // if (POOL_ADDRESS !== whiteListedPoolAddress) continue;
    const POOL_SOCKET = io.of("/" + POOL_ADDRESS);

    const CURVE_JSON = JSON.parse(fs.readFileSync("./JSON/CurvePoolData.json"));
    const COIN_NAMES = CURVE_JSON[POOL_ADDRESS].coin_names;

    // eg [ 'sUSD', 'DAI' ] => price of sUSD in DAI
    let priceCombination = [COIN_NAMES[COIN_NAMES.length - 1], COIN_NAMES[0]];
    if (POOL_ADDRESS === "0xA5407eAE9Ba41422680e2e00537571bcC53efBfD") priceCombination = ["sUSD", "USDC"];

    // default view is set to one month of data
    let timeFrame = "month";

    await manageUpdates(POOL_SOCKET, emitter, POOL_ADDRESS, timeFrame, priceCombination);

    POOL_SOCKET.on("connection", async (socket) => {
      socket.join(POOL_ADDRESS);
      socket.send("successfully connected to socket for " + POOL_ADDRESS);
      console.log(POOL_ADDRESS, "socket connected");

      // sending the array of token names, used in the price chart switch (priceOf: [...] priceIn: [...] on the UI)
      socket.emit("token names inside pool", COIN_NAMES);

      sendDefaultInitMessage(POOL_SOCKET, POOL_ADDRESS, timeFrame, priceCombination);

      // example for data: ["week", "sUSD", "USDC"];
      socket.on("new combination", (data) => {
        let _timeFrame;
        let _priceCombination;
        [_timeFrame, ..._priceCombination] = data;
        sendPriceData(_timeFrame, socket, POOL_ADDRESS, _priceCombination);
        sendBondingCurve(socket, POOL_ADDRESS, _priceCombination);
      });

      // next block is for when a user plays with the time-span tabulator
      socket.on("day", () => {
        console.log("received request for timeframe: day");
        sendData("day", socket, POOL_ADDRESS, priceCombination);
      });

      socket.on("week", () => {
        console.log("received request for timeframe: week");
        sendData("week", socket, POOL_ADDRESS, priceCombination);
      });

      socket.on("month", () => {
        console.log("received request for timeframe: month");
        sendData("month", socket, POOL_ADDRESS, priceCombination);
      });

      socket.on("disconnect", () => {
        console.log("client disconnected");
      });
    });
  }
}

function sendData(timeFrame, socket, poolAddress, priceCombination) {
  sendPriceData(timeFrame, socket, poolAddress, priceCombination);
  sendBalanceData(timeFrame, socket, poolAddress);
  sendVolumeData(timeFrame, socket, poolAddress);
  sendTVLData(timeFrame, socket, poolAddress);
}

// Table
function sendTableData(socket, poolAddress) {
  const CURRENT_TIME = new Date().getTime() / 1000;
  const DAYS = 31;
  const STARTING_POINT = CURRENT_TIME - DAYS * 24 * 60 * 60;

  const DATA_ALL = JSON.parse(fs.readFileSync("./JSON/ProcessedTxLogAll.json"));
  const DATA_MEV = JSON.parse(fs.readFileSync("./JSON/ProcessedTxLogMEV.json"));

  let trimmedDataALL = DATA_ALL[poolAddress].filter((entry) => entry.unixtime >= STARTING_POINT);
  let trimmedDataMEV = DATA_MEV[poolAddress].filter((entry) => entry.unixtime >= STARTING_POINT);

  const NUMBER_OF_MAX_ENTRIES = 250;
  if (trimmedDataALL.length > NUMBER_OF_MAX_ENTRIES) trimmedDataALL = trimmedDataALL.slice(-NUMBER_OF_MAX_ENTRIES);
  if (trimmedDataMEV.length > NUMBER_OF_MAX_ENTRIES) trimmedDataMEV = trimmedDataMEV.slice(-NUMBER_OF_MAX_ENTRIES);

  socket.emit("table_all", trimmedDataALL);
  socket.emit("table_mev", trimmedDataMEV);
}

// Price
function sendPriceData(timeFrame, socket, poolAddress, priceCombination) {
  const STARTING_POINT = getStartingPoint(timeFrame);

  const PRICE_OF = priceCombination[0];
  const PRICE_IN = priceCombination[1];
  const DATA = readPriceArray(poolAddress, PRICE_OF, PRICE_IN);

  let trimmedData = DATA.filter((item) => Object.keys(item)[0] >= STARTING_POINT);
  console.log(trimmedData);

  let durationInMinutes;
  if (timeFrame === "day") durationInMinutes = 45 / 30; // prints 1000 points / 1.5 minutes
  if (timeFrame === "week") durationInMinutes = 45 / 4; // prints 1000 points / 11 minutes
  if (timeFrame === "month") durationInMinutes = 45; // prints 1000 points / 45 minutes

  trimmedData = compressPriceChart(trimmedData, durationInMinutes);
  console.log("trimmedData", trimmedData);
  socket.emit("price_chart_combination", priceCombination);
  socket.emit("price_chart", trimmedData);
}

// Volume
function sendVolumeData(timeFrame, socket, poolAddress) {
  const STARTING_POINT = getStartingPoint(timeFrame);

  // first getting trimmed processedTxLog
  const DATA_ALL = JSON.parse(fs.readFileSync("./JSON/ProcessedTxLogAll.json"));
  const TRIMMED_DATA_ALL = DATA_ALL[poolAddress].filter((entry) => entry.unixtime >= STARTING_POINT);

  // then making vol-arr out of it
  let data = [];
  for (const ENTRY of TRIMMED_DATA_ALL) {
    let vol = ENTRY.tradeDetails.valueUSD;
    if (!vol && vol !== 0) vol = ENTRY.tradeDetails[0].valueUSD;
    data.push({ [ENTRY.unixtime]: vol });
  }

  let durationInMinutes;
  if (timeFrame === "day") durationInMinutes = 45 / 30; // prints 1000 points / 1.5 minutes
  if (timeFrame === "week") durationInMinutes = 45 / 4; // prints 1000 points / 11 minutes
  if (timeFrame === "month") durationInMinutes = 45; // prints 1000 points / 45 minutes

  data = compressVolumeChart(data, durationInMinutes);
  socket.emit("volume_chart", data);
}

function sendBalanceData(timeFrame, socket, poolAddress) {
  const STARTING_POINT = getStartingPoint(timeFrame);

  const DATA = readBalancesArray(poolAddress);

  let trimmedData = DATA.filter((item) => Object.keys(item)[0] >= STARTING_POINT);

  let durationInMinutes;
  if (timeFrame === "day") durationInMinutes = 45 / 30; // prints 1000 points / 1.5 minutes
  if (timeFrame === "week") durationInMinutes = 45 / 4; // prints 1000 points / 11 minutes
  if (timeFrame === "month") durationInMinutes = 45; // prints 1000 points / 45 minutes

  trimmedData = compressBalancesChart(trimmedData, durationInMinutes);

  socket.emit("balances_chart", trimmedData);
}

// TVL
function sendTVLData(timeFrame, socket, poolAddress) {
  const STARTING_POINT = getStartingPoint(timeFrame);

  const BALANCES = readBalancesArray(poolAddress);
  const TRIMMED_BALANCES = BALANCES.filter((item) => Object.keys(item)[0] >= STARTING_POINT);

  let data = TRIMMED_BALANCES.map((obj) => {
    const KEY = Object.keys(obj)[0];
    const SUM = obj[KEY].reduce((a, b) => a + b, 0);
    return { [KEY]: SUM };
  });

  let durationInMinutes;
  if (timeFrame === "day") durationInMinutes = 45 / 30; // prints 1000 points / 1.5 minutes
  if (timeFrame === "week") durationInMinutes = 45 / 4; // prints 1000 points / 11 minutes
  if (timeFrame === "month") durationInMinutes = 45; // prints 1000 points / 45 minutes

  data = compressTVLChart(data, durationInMinutes);

  socket.emit("tvl_chart", data);
}

function sendBondingCurve(socket, poolAddress, priceCombination) {
  const BONDING_CURVE = getBondingCurveForPoolAndCombination(poolAddress, priceCombination);
  socket.emit("bonding_curve", BONDING_CURVE);
}

function getStartingPoint(timeFrame) {
  const CURRENT_TIME = new Date().getTime() / 1000;
  let days;
  if (timeFrame === "day") days = 1;
  if (timeFrame === "week") days = 7;
  if (timeFrame === "month") days = 31;
  return CURRENT_TIME - days * 24 * 60 * 60;
}

function compressPriceChart(priceChart, durationInMinutes) {
  const DURATION_IN_SECONDS = durationInMinutes * 60;
  const HALF_INTERVAL_IN_SECONDS = DURATION_IN_SECONDS / 2;

  let chunkedData = [];
  let currentIntervalStart = null;
  let currentIntervalPrices = [];
  let previousAvgPrice = null;

  for (let i = 0; i < priceChart.length; i++) {
    let unixtime = parseInt(Object.keys(priceChart[i])[0]);
    let price = Object.values(priceChart[i])[0];

    if (currentIntervalStart === null) {
      currentIntervalStart = unixtime - (unixtime % DURATION_IN_SECONDS);
    }

    while (unixtime >= currentIntervalStart + DURATION_IN_SECONDS) {
      let avgPrice;
      if (currentIntervalPrices.length > 0) {
        avgPrice = currentIntervalPrices.reduce((a, b) => a + b, 0) / currentIntervalPrices.length;
        previousAvgPrice = avgPrice;
      } else {
        avgPrice = previousAvgPrice;
      }
      chunkedData.push({ [currentIntervalStart + HALF_INTERVAL_IN_SECONDS]: avgPrice });

      // Start the next interval
      currentIntervalStart += DURATION_IN_SECONDS;
      currentIntervalPrices = [];
    }

    currentIntervalPrices.push(price);
  }

  // Process the last interval
  if (currentIntervalPrices.length > 0) {
    let avgPrice = currentIntervalPrices.reduce((a, b) => a + b, 0) / currentIntervalPrices.length;
    chunkedData.push({ [currentIntervalStart + HALF_INTERVAL_IN_SECONDS]: avgPrice });
  } else if (previousAvgPrice !== null) {
    chunkedData.push({ [currentIntervalStart + HALF_INTERVAL_IN_SECONDS]: previousAvgPrice });
  }

  return chunkedData;
}

function compressVolumeChart(volumeData, durationInMinutes) {
  const DURATION_IN_SECONDS = durationInMinutes * 60;
  const HALF_DURATION_IN_SECONDS = DURATION_IN_SECONDS / 2;

  const FIRST_TIMESTAMP_RAW = parseInt(Object.keys(volumeData[0])[0]) - HALF_DURATION_IN_SECONDS;
  const FIRST_TIMESTAMP = FIRST_TIMESTAMP_RAW - (FIRST_TIMESTAMP_RAW % DURATION_IN_SECONDS);
  const LAST_TIMESTAMP = parseInt(Object.keys(volumeData[volumeData.length - 1])[0]) - HALF_DURATION_IN_SECONDS;

  const GROUPED_VOLUMES = new Map();

  volumeData.forEach((volumeEntry) => {
    const TIMESTAMP = parseInt(Object.keys(volumeEntry)[0]);
    const VOLUME = volumeEntry[TIMESTAMP];
    const ROUNDED_TIMESTAMP = TIMESTAMP - (TIMESTAMP % DURATION_IN_SECONDS) + HALF_DURATION_IN_SECONDS;

    if (!GROUPED_VOLUMES.has(ROUNDED_TIMESTAMP)) {
      GROUPED_VOLUMES.set(ROUNDED_TIMESTAMP, 0);
    }

    GROUPED_VOLUMES.set(ROUNDED_TIMESTAMP, GROUPED_VOLUMES.get(ROUNDED_TIMESTAMP) + VOLUME);
  });

  const COMPRESSED_VOLUME_DATA = [];

  for (let currentTimestamp = FIRST_TIMESTAMP; currentTimestamp <= LAST_TIMESTAMP + DURATION_IN_SECONDS; currentTimestamp += DURATION_IN_SECONDS) {
    const CENTER_TIMESTAMP = currentTimestamp + HALF_DURATION_IN_SECONDS;

    if (GROUPED_VOLUMES.has(CENTER_TIMESTAMP)) {
      const TOTAL_VOLUME = GROUPED_VOLUMES.get(CENTER_TIMESTAMP);
      COMPRESSED_VOLUME_DATA.push({ [CENTER_TIMESTAMP]: TOTAL_VOLUME });
    } else {
      const TIMESTAMP_BEFORE = CENTER_TIMESTAMP - DURATION_IN_SECONDS;
      const TIMESTAMP_AFTER = CENTER_TIMESTAMP + DURATION_IN_SECONDS;

      if (GROUPED_VOLUMES.has(TIMESTAMP_BEFORE) || GROUPED_VOLUMES.has(TIMESTAMP_AFTER)) {
        COMPRESSED_VOLUME_DATA.push({ [CENTER_TIMESTAMP]: 0 });
      }
    }
  }

  return COMPRESSED_VOLUME_DATA;
}

function compressTVLChart(data, durationInMinutes) {
  const CLUSTERED_DATA = {};
  const DURATION_IN_SECONDS = durationInMinutes * 60;

  data.forEach((dataPoint) => {
    const UNIXTIME = Object.keys(dataPoint)[0];
    const TVL = dataPoint[UNIXTIME];

    // Calculate the "chunk" by dividing the UNIXTIME by the duration and rounding down
    const CHUNK = Math.floor(UNIXTIME / DURATION_IN_SECONDS) * DURATION_IN_SECONDS;

    // If the chunk doesn't exist, initialize it
    if (!CLUSTERED_DATA[CHUNK]) {
      CLUSTERED_DATA[CHUNK] = {
        sum: 0,
        count: 0,
        average: 0,
      };
    }

    // Add the current TVL to the chunk's sum and increment the count
    CLUSTERED_DATA[CHUNK].sum += TVL;
    CLUSTERED_DATA[CHUNK].count++;

    // Calculate the new average for the chunk
    CLUSTERED_DATA[CHUNK].average = CLUSTERED_DATA[CHUNK].sum / CLUSTERED_DATA[CHUNK].count;
  });

  // Convert the object to an array and round the average TVL value
  const RESULT = Object.entries(CLUSTERED_DATA).map(([unixTime, { average }]) => {
    return { [unixTime]: Math.round(average) };
  });

  return RESULT;
}

function compressBalancesChart(trimmedData, durationInMinutes) {
  const DURATION_IN_SECONDS = durationInMinutes * 60;
  const HALF_DURATION_IN_SECONDS = DURATION_IN_SECONDS / 2;
  const CLUSTERED_DATA = [];
  let currentCluster = {};
  let currentUnixTime;

  for (const entry of trimmedData) {
    const UNIXTIME = parseInt(Object.keys(entry)[0]);
    const BALANCES = entry[UNIXTIME];

    if (!currentUnixTime) {
      currentUnixTime = UNIXTIME;
      currentCluster[UNIXTIME + HALF_DURATION_IN_SECONDS] = { count: 1, sums: BALANCES.slice() };
    } else if (UNIXTIME - currentUnixTime < DURATION_IN_SECONDS) {
      currentCluster[currentUnixTime + HALF_DURATION_IN_SECONDS].count++;
      BALANCES.forEach((balance, index) => {
        currentCluster[currentUnixTime + HALF_DURATION_IN_SECONDS].sums[index] += balance;
      });
    } else {
      const AVERAGES = currentCluster[currentUnixTime + HALF_DURATION_IN_SECONDS].sums.map((sum) =>
        Math.round(sum / currentCluster[currentUnixTime + HALF_DURATION_IN_SECONDS].count)
      );
      CLUSTERED_DATA.push({ [currentUnixTime + HALF_DURATION_IN_SECONDS]: AVERAGES });

      // Update currentUnixTime to the next interval
      currentUnixTime += DURATION_IN_SECONDS;

      // If the current entry is not in the new interval, move forward until it is
      while (UNIXTIME - currentUnixTime >= DURATION_IN_SECONDS) {
        currentUnixTime += DURATION_IN_SECONDS;
      }

      currentCluster[currentUnixTime + HALF_DURATION_IN_SECONDS] = { count: 1, sums: BALANCES.slice() };
    }
  }

  // Process the last cluster
  const AVERAGES = currentCluster[currentUnixTime + HALF_DURATION_IN_SECONDS].sums.map((sum) => Math.round(sum / currentCluster[currentUnixTime + HALF_DURATION_IN_SECONDS].count));
  CLUSTERED_DATA.push({ [currentUnixTime + HALF_DURATION_IN_SECONDS]: AVERAGES });

  return CLUSTERED_DATA;
}

export { httpSocketSetup, httpsSocketSetup };
