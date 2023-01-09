import { createRequire } from "module"
var require = createRequire(import.meta.url)

const io = require("socket.io-client")

let poolAddress = "0x80466c64868E1ab14a1Ddf27A676C3fcBE638Fe5"

const demo_socket = io.connect("http://localhost:2424/" + poolAddress + "_token_price")

demo_socket.on("message", data => {
	// handle JSON-data here
	console.log(data)
})
