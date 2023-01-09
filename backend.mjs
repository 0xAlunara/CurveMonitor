import { createRequire } from "module"
var require = createRequire(import.meta.url)

const io = require("socket.io")(2424, {
	cors: {
		origin: "http://localhost:2424",
		methods: ["GET", "POST"]
	}
})

let poolAddress = "0x80466c64868E1ab14a1Ddf27A676C3fcBE638Fe5"


// will use one socket per pool per data-type, eg prices, tvl..
const demo_socket  = io.of("/"+poolAddress+"_token_price")

async function handleSocket(demo_socket){
	demo_socket.on("connection", async (socket)  => {
		socket.send("connected to WS")
		console.log("\nnew client connected")

		// sending out demo messages from the backend
		let i = 0
		while(true){
			if(socket.connected==false){
				socket.disconnect() 
				break
			}

			let message = "push #"+i
			socket.send(message)
			console.log(message)
			await new Promise(resolve => setTimeout(resolve, 400))
			i+=1
		}
	})
}

await handleSocket(demo_socket)