import { createRequire } from "module"
var require = createRequire(import.meta.url)

const io = require("socket.io-client")

let landing_socket = io.connect("http://localhost:2424/")

// example for user input in search bar.
//landing_socket.emit("search","frax")

// example for search_res:  [{ '0xd632f22692FaC7611d2AA1C0D552930D43CAEd3B': 'FRAX/3Crv' },{...}]
landing_socket.on("search_res", data => {
	console.log("search_res",data)
})

let whiteListedPoolAddress = "0xA5407eAE9Ba41422680e2e00537571bcC53efBfD"

let poolAddress = whiteListedPoolAddress

const pool_socket = io.connect("http://localhost:2424/" + poolAddress)

pool_socket.on("token names inside pool", data => {
	console.log("\ntoken names inside pool", data)
})

pool_socket.on("message", data => {
	console.log(data)
})

/**
 * sending out full data on init connect
 */
pool_socket.on("table_all", data => {
	// handle JSON-data here
	console.log("\n<table_all>", data.length,"entries send")
	//console.log(data)
})

pool_socket.on("table_mev", data => {
	// handle JSON-data here
	console.log("<table_mev>", data.length,"entries send")
	//console.log(data)
})

// example for price_chart_combination: [ 'sUSD', 'USDC' ] => price of sUSD in USDC (default)
pool_socket.on("price_chart_combination", data => {
	console.log("\nprice_chart_combination:s",data)
})

// example for price_chart:  [ { '1675078547': 1.00078609029431 },{ '1675081511': 1.0007863914931368 },{...} ]
pool_socket.on("price_chart", data => {
	// handle JSON-data here
	console.log("<price_chart>", data.length,"entries send")
})

// example for balances_chart: [ { '1672493903': [ 18636729, 18298801, 17929766, 16040727 ] },{ '1672494839': [ 18636729, 18298801, 17929766, 16040727 ] },{...} ]
pool_socket.on("balances_chart", data => {
	// handle JSON-data here
	console.log("\n<balances_chart>", data.length,"entries send")
})


/**
 * Updates, only latest entry, without history
 */

pool_socket.on("\nUpdate Table-ALL", data => {
	// handle JSON-data here
	console.log("Update Table-ALL",data)
})

pool_socket.on("Update Table-MEV", data => {
	// handle JSON-data here
	console.log("Update Table-MEV",data)
})

pool_socket.on("Update Price-Chart", data => {
	// handle JSON-data here
	console.log("Update Price-Chart",data)
})

pool_socket.on("Update Balance-Chart", data => {
	// handle JSON-data here
	console.log("Update Balance-Chart",data)
})

//to-do: Balance-Chart, TVL-Chart, Volume-Chart
/*
pool_socket.on("Update TVL-Chart", data => {
	// handle JSON-data here
	console.log("Update TVL-Chart",data)
})

pool_socket.on("Update Volume-Chart", data => {
	// handle JSON-data here
	console.log("Update Volume-Chart",data)
})
*/

let timeFrame = "day"
//let timeFrame = "week"
//let timeFrame = "month"

// emit(timeFrame) not to be used on init connection (defaults to 1 month). Only used when a user starts changing time-spans
//pool_socket.emit(timeFrame)
