import { createRequire } from "module"
var require = createRequire(import.meta.url)

const io = require("socket.io-client")

let whiteListedPoolAddress = "0xA5407eAE9Ba41422680e2e00537571bcC53efBfD"

let poolAddress = whiteListedPoolAddress

const pool_socket = io.connect("http://localhost:2424/" + poolAddress)

pool_socket.on("message", data => {
	// handle JSON-data here
	console.log(data)
})