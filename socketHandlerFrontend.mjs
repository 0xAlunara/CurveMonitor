import { createRequire } from "module"
var require = createRequire(import.meta.url)

const io = require("socket.io-client")

let whiteListedPoolAddress = "0xA5407eAE9Ba41422680e2e00537571bcC53efBfD"

let poolAddress = whiteListedPoolAddress

const pool_socket = io.connect("http://localhost:2424/" + poolAddress)

pool_socket.on("message", data => {
	console.log(data)
})

pool_socket.on("initial_all", data => {
	// handle JSON-data here
	//console.log(data)
	console.log("initial_all")
})

pool_socket.on("initial_mev", data => {
	// handle JSON-data here
	//console.log(data)
	console.log("initial_mev")
})

pool_socket.on("latest", data => {
	// handle JSON-data here
	//console.log(data)
	console.log("latest")
})
