import { createRequire } from "module"
var require = createRequire(import.meta.url)

const io = require("socket.io-client")

let whiteListedPoolAddress = "0xA5407eAE9Ba41422680e2e00537571bcC53efBfD"

let poolAddress = whiteListedPoolAddress

//let timeFrame = "day"
let timeFrame = "week"
//let timeFrame = "month"

const pool_socket = io.connect("http://localhost:2424/" + poolAddress)

pool_socket.on("message", data => {
	console.log(data)
})

pool_socket.on("initial_all", data => {
	// handle JSON-data here
	console.log("initial_all")
	//console.log(data)
})

pool_socket.on("initial_mev", data => {
	// handle JSON-data here
	console.log("initial_mev")
	//console.log(data)
})

pool_socket.on("latest", data => {
	// handle JSON-data here
	//console.log(data)
	console.log("latest")
})

// emit(timeFrame) not to be used on init connection (defaults to 1 month). Only used when a user starts changing time-spans
pool_socket.emit(timeFrame)
