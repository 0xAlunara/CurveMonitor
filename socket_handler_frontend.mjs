import { createRequire } from "module";
const require = createRequire(import.meta.url);

const io = require("socket.io-client");

console.clear();

const LANDING_SOCKET = io.connect("http://localhost:2424/");

// example for user input in search bar.
// LANDING_SOCKET.emit("search","frax")

// example for search_res:  [{ '0xd632f22692FaC7611d2AA1C0D552930D43CAEd3B': 'FRAX/3Crv' },{...}]
LANDING_SOCKET.on("search_res", (data) => {
  console.log("search_res", data);
});

// Ping-Pong:
setInterval(() => {
  LANDING_SOCKET.emit("ping");
}, 2 * 1000); // pings every 2 seconds

LANDING_SOCKET.on("pong", () => {
  // console.log("pong") // => server alive
});

// setting up the socket for sUSD
const WHITELISTED_POOL = "0xA5407eAE9Ba41422680e2e00537571bcC53efBfD";
const POOL_ADDRESS = WHITELISTED_POOL;
const POOL_SOCKET = io.connect("http://localhost:2424/" + POOL_ADDRESS);

POOL_SOCKET.on("token names inside pool", (data) => {
  console.log("\ntoken names inside pool", data);
});

POOL_SOCKET.on("message", (data) => {
  console.log(data);
});

/**
 * sending out full data on init connect
 */
POOL_SOCKET.on("table_all", (data) => {
  // handle JSON-data here
  console.log("\n<table_all>", data.length, "entries send");
  // console.log(data)
});

POOL_SOCKET.on("table_mev", (data) => {
  // handle JSON-data here
  console.log("<table_mev>", data.length, "entries send");
  // console.log(data)
});

// example for price_chart_combination: [ 'sUSD', 'USDC' ] => price of sUSD in USDC (default)
POOL_SOCKET.on("price_chart_combination", (data) => {
  console.log("\nprice_chart_combinations:", data);
});

// example for price_chart:  [ { '1675078547': 1.00078609029431 },{ '1675081511': 1.0007863914931368 },{...} ]
POOL_SOCKET.on("price_chart", (data) => {
  // handle JSON-data here
  console.log("\n<price_chart>", data.length, "entries send");
});

// example for balances_chart: [ { '1672493903': [ 18636729, 18298801, 17929766, 16040727 ] },{ '1672494839': [ 18636729, 18298801, 17929766, 16040727 ] },{...} ]
POOL_SOCKET.on("balances_chart", (data) => {
  // handle JSON-data here
  console.log("\n<balances_chart>", data.length, "entries send");
});

// example for volume_chart:  [ { '1675078547': 865 },{ '1675081511': 1216 },{...} ]
POOL_SOCKET.on("volume_chart", (data) => {
  // handle JSON-data here
  console.log("\n<volume_chart>", data.length, "entries send");
});

// example for tvl_chart:  [ { '1675078547': 70906023 },{ '1675081511': 70904179 },{...} ]
POOL_SOCKET.on("tvl_chart", (data) => {
  // handle JSON-data here
  console.log("\n<tvl_chart>", data.length, "entries send");
});

POOL_SOCKET.on("bonding_curve", (data) => {
  // handle JSON-data here
  console.log("\n<bonding_curve>", data);
});

/**
 * Updates, only latest entry, without history
 */

POOL_SOCKET.on("Update Table-ALL", (data) => {
  // handle JSON-data here
  console.log("Update Table-ALL", data);
});

POOL_SOCKET.on("Update Table-MEV", (data) => {
  // handle JSON-data here
  console.log("Update Table-MEV", data);
});

POOL_SOCKET.on("Update Price-Chart", (data) => {
  // handle JSON-data here
  console.log("Update Price-Chart", data);
});

POOL_SOCKET.on("Update Balance-Chart", (data) => {
  // handle JSON-data here
  console.log("Update Balance-Chart", data);
});

POOL_SOCKET.on("Update Volume-Chart", (data) => {
  // handle JSON-data here
  console.log("Update Volume-Chart", data);
});

POOL_SOCKET.on("Update TVL-Chart", (data) => {
  // handle JSON-data here
  console.log("Update TVL-Chart", data);
});

const timeFrame = "day";
// let timeFrame = "week"
// let timeFrame = "month"

// POOL_SOCKET.emit(timeFrame) not to be used on init connection (defaults to 1 month). Only used when a user starts changing time-spans
// POOL_SOCKET.emit(timeFrame)

// example for price-combination-request
POOL_SOCKET.emit("new combination", ["day", "sUSD", "USDC"]);
