const fs = require("fs");

const https = require("https");

const genericUtils = require("./generic_utils.js");
const getCurvePools = genericUtils.getCurvePools;

const balancesUtils = require("./balances_utils.js");
const readBalancesArray = balancesUtils.readBalancesArray;

// utils for price-data
const priceUtils = require("./price_utils.js");
const readPriceArray = priceUtils.readPriceArray;

// for the search bar on the landing page
const searchUtils = require("./search_utils.js");
const search = searchUtils.search;

// utils to fetch and store bonding curves
const bondingCurveUtils = require("./bonding_curve_utils.js");
const getBondingCurveForPoolAndCombination = bondingCurveUtils.getBondingCurveForPoolAndCombination;

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
    if (POOL_ADDRESS !== whiteListedPoolAddress) continue;
    const POOL_SOCKET = io.of("/" + POOL_ADDRESS);

    const CURVE_JSON = JSON.parse(fs.readFileSync("curve_pool_data.json"));
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
        [_timeFrame, ...priceCombination] = data;
        sendPriceData(_timeFrame, socket, POOL_ADDRESS, _priceCombination);
        sendBondingCurve(socket, POOL_ADDRESS, _priceCombination);
      });

      // next block is for when a user plays with the time-span tabulator
      socket.on("day", () => {
        sendData("day", socket, POOL_ADDRESS, priceCombination);
      });

      socket.on("week", () => {
        sendData("week", socket, POOL_ADDRESS, priceCombination);
      });

      socket.on("month", () => {
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

// sends the inital data for the table-view (tx history for a given pool)
function sendTableData(socket, poolAddress) {
  const CURRENT_TIME = new Date().getTime() / 1000;
  const DAYS = 31;
  const STARTING_POINT = CURRENT_TIME - DAYS * 24 * 60 * 60;

  const DATA_ALL = JSON.parse(fs.readFileSync("processed_tx_log_all.json"));
  const DATA_MEV = JSON.parse(fs.readFileSync("processed_tx_log_mev.json"));

  const TRIMMED_DATA_ALL = DATA_ALL[poolAddress].filter((entry) => entry.unixtime >= STARTING_POINT);
  const TRIMMED_DATA_MEV = DATA_MEV[poolAddress].filter((entry) => entry.unixtime >= STARTING_POINT);

  socket.emit("table_all", TRIMMED_DATA_ALL);
  socket.emit("table_mev", TRIMMED_DATA_MEV);
}

// trimmes down the message for the frontend to ship only data of last 24h, week, or month
function sendPriceData(timeFrame, socket, poolAddress, priceCombination) {
  const STARTING_POINT = getStartingPoint(timeFrame);

  const PRICE_OF = priceCombination[0];
  const PRICE_IN = priceCombination[1];
  const DATA = readPriceArray(poolAddress, PRICE_OF, PRICE_IN);

  const TRIMMED_DATA = DATA.filter((item) => Object.keys(item)[0] >= STARTING_POINT);
  socket.emit("price_chart_combination", priceCombination);
  socket.emit("price_chart", TRIMMED_DATA);
}

function getStartingPoint(timeFrame) {
  const CURRENT_TIME = new Date().getTime() / 1000;
  let days;
  if (timeFrame === "day") days = 1;
  if (timeFrame === "week") days = 7;
  if (timeFrame === "month") days = 31;
  return CURRENT_TIME - days * 24 * 60 * 60;
}

function sendBalanceData(timeFrame, socket, poolAddress) {
  const STARTING_POINT = getStartingPoint(timeFrame);

  const DATA = readBalancesArray(poolAddress);

  const TRIMMED_DATA = DATA.filter((item) => Object.keys(item)[0] >= STARTING_POINT);
  socket.emit("balances_chart", TRIMMED_DATA);
}

function sendVolumeData(timeFrame, socket, poolAddress) {
  const STARTING_POINT = getStartingPoint(timeFrame);

  // first getting trimmed processedTxLog
  const DATA_ALL = JSON.parse(fs.readFileSync("processed_tx_log_all.json"));
  const TRIMMED_DATA_ALL = DATA_ALL[poolAddress].filter((entry) => entry.unixtime >= STARTING_POINT);

  // then making vol-arr out of it
  const DATA = [];
  for (const ENTRY of TRIMMED_DATA_ALL) {
    let vol = ENTRY.tradeDetails.valueUSD;
    if (!vol && vol !== 0) vol = ENTRY.tradeDetails[0].valueUSD;
    DATA.push({ [ENTRY.unixtime]: vol });
  }
  socket.emit("volume_chart", DATA);
}

function sendTVLData(timeFrame, socket, poolAddress) {
  const STARTING_POINT = getStartingPoint(timeFrame);

  const BALANCES = readBalancesArray(poolAddress);
  const TRIMMED_BALANCES = BALANCES.filter((item) => Object.keys(item)[0] >= STARTING_POINT);

  const DATA = TRIMMED_BALANCES.map((obj) => {
    const KEY = Object.keys(obj)[0];
    const SUM = obj[KEY].reduce((a, b) => a + b, 0);
    return { [KEY]: SUM };
  });

  socket.emit("tvl_chart", DATA);
}

function sendBondingCurve(socket, poolAddress, priceCombination) {
  const BONDING_CURVE = getBondingCurveForPoolAndCombination(poolAddress, priceCombination);
  socket.emit("bonding_curve", BONDING_CURVE);
}

module.exports = {
  httpSocketSetup,
  httpsSocketSetup,
};
