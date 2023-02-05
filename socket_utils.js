
const fs = require("fs")

const https = require("https")

const generic_utils = require("./generic_utils.js")
const getCurvePools = generic_utils.getCurvePools

const balances_utils = require("./balances_utils.js")
const readBalancesArray = balances_utils.readBalancesArray

// utils for price-data
const price_utils = require("./price_utils.js")
const readPriceArray = price_utils.readPriceArray

// for the search bar on the landing page
const search_utils = require("./search_utils.js")
const search = search_utils.search

async function http_SocketSetup(Server,emitter,whiteListedPoolAddress) {

	const io = new Server(2424, {
		cors: {
			origin: "http://localhost:2424",
			methods: ["GET", "POST"]
		}
	})

	await initSocketMessages(io,emitter,whiteListedPoolAddress)
	await startLandingSocket(io)
}

async function https_SocketSetup(Server,emitter,whiteListedPoolAddress) {

	const httpsServer = https.createServer({
		key: fs.readFileSync("/home/transactions/certs/privkey1.pem"),
		cert: fs.readFileSync("/home/transactions/certs/cert1.pem"),
		ca: fs.readFileSync("/home/transactions/certs/fullchain1.pem")
	})

	const io = new Server(httpsServer, {
		cors: {
			origin: "*",
			methods: ["GET", "POST"]
		},
		requestCert: false,
		rejectUnauthorized: false,
	})
	
	await initSocketMessages(io,emitter,whiteListedPoolAddress)
	await startLandingSocket(io)

	httpsServer.listen(2053)
}

async function startLandingSocket(io){
	const landing_socket = io.of("/" )
	landing_socket.on("connection", async (socket) => {
		console.log("landing_socket connected")
		socket.on("search", (data) => {
			try{
				let res = search(data)
				socket.emit("search_res", res)
			}catch(err){
				console.log("err in search:",err.message)
			}
		})
		socket.on("ping", () => {
			socket.emit("pong")
		})
		socket.on("disconnect", () => {
			console.log("client disconnected from landing page")
		})
	})
}

// making use of socket.io rooms
async function manageUpdates(io,emitter,poolAddress){
	emitter.on("Update Table-ALL" + poolAddress, async (data) => {
		io.in(poolAddress).emit("Update Table-ALL" + poolAddress,data)
	})
	emitter.on("Update Table-MEV" + poolAddress, async (data) => {
		io.in(poolAddress).emit("Update Table-MEV" + poolAddress,data)
	})
	emitter.on("Update Price-Chart" + poolAddress, async (unixtime) => {
		io.in(poolAddress).emit("Update Price-Char" + poolAddress,unixtime)
	})
	emitter.on("Update Balance-Chart" + poolAddress, async (data) => {
		io.in(poolAddress).emit("Update Balance-Chart" + poolAddress,data)
	})
	emitter.on("Update TVL-Chart" + poolAddress, async (data) => {
		io.in(poolAddress).emit("Update TVL-ALL" + poolAddress,data)
	})
	emitter.on("Update Volume-Chart" + poolAddress, async (data) => {
		io.in(poolAddress).emit("Update Volume-Chart" + poolAddress,data)
	})
}

/**
 * on pool connect: 
 * send table data full (so one month)
 * send data cut for 1 month for: price chart (later balances and more)
 * then socket.on("timePeriod") => send data for: price chart (later balances and more)
 */ 

async function initSocketMessages(io,emitter,whiteListedPoolAddress){
	let pools = getCurvePools()
	for (const poolAddress of pools) {
		if (poolAddress!== whiteListedPoolAddress) continue
		const pool_socket = io.of("/" + poolAddress)

		await manageUpdates(io,emitter,poolAddress)

		pool_socket.on("connection", async (socket) => {
			socket.join(poolAddress)
			socket.send("successfully connected to socket for " + poolAddress)
			console.log(poolAddress, "socket connected")

			//sending the array of token names, used in the price chart switch (priceOf: [...] priceIn: [...] on the UI)
			let curveJSON = JSON.parse(fs.readFileSync("CurvePoolData.json"))
			let coin_names = curveJSON[poolAddress].coin_names
			socket.emit("token names inside pool", coin_names)

			// eg [ 'sUSD', 'DAI' ] => price of sUSD in DAI
			let price_combination = [coin_names[coin_names.length-1],coin_names[0]]
			if (poolAddress == "0xA5407eAE9Ba41422680e2e00537571bcC53efBfD") price_combination = [ 'sUSD', 'USDC' ]

			// needed for when a user changes coins in the price chart, to keep track in which 
			let timeFrame = "month"

			socket.on("priceOf", (priceOf) => {
				price_combination[0] = priceOf
				//socket.emit("search_res", res)
			})

			socket.on("priceIn", (priceIn) => {
				price_combination[1] = priceIn
				//socket.emit("search_res", res)
			})

			// messages on connect
			sendTableData(socket,poolAddress)
			sendPriceData(timeFrame,socket,poolAddress,price_combination)
			sendBalanceData(timeFrame,socket,poolAddress)
			// sendTVLData()
			// sendVolumeData()

			// next block is for when a user plays with the time-span tabulator
			socket.on("day", () => {
				timeFrame = "day"
				sendPriceData(timeFrame,socket,poolAddress,price_combination)
				sendBalanceData(timeFrame,socket,poolAddress)
				// sendTVLData()
				// sendVolumeData()
			})
			socket.on("week", () => {
				timeFrame = "week"
				sendPriceData(timeFrame,socket,poolAddress,price_combination)
				sendBalanceData(timeFrame,socket,poolAddress)
				// sendTVLData()
				// sendVolumeData()
			})
			socket.on("month", () => {
				timeFrame = "month"
				sendPriceData(timeFrame,socket,poolAddress,price_combination)
				sendBalanceData(timeFrame,socket,poolAddress)
				// sendTVLData()
				// sendVolumeData()
			})
			
			socket.on("disconnect", () => {
				console.log("client disconnected")
			})

		})
	}
}

// sends the inital data for the table-view (tx history for a given pool)
function sendTableData(socket,poolAddress){
	let currentTime = new Date().getTime() / 1000
	var days = 31
	let startingPoint = currentTime - (days * 24 * 60 * 60)

	let dataALL = JSON.parse(fs.readFileSync("processedTxLog_ALL.json"))
	let dataMEV = JSON.parse(fs.readFileSync("processedTxLog_MEV.json"))

	let trimmedDataALL = dataALL[poolAddress].filter(entry => entry.unixtime >= startingPoint)
	let trimmedDataMEV = dataMEV[poolAddress].filter(entry => entry.unixtime >= startingPoint)

	socket.emit("table_all", trimmedDataALL)
	socket.emit("table_mev", trimmedDataMEV)
}

// trimmes down the message for the frontend to ship only data of last 24h, week, or month
function sendPriceData(timeFrame,socket,poolAddress,price_combination){
	let currentTime = new Date().getTime() / 1000

	if (timeFrame == "day") var days = 1
	if (timeFrame == "week") var days = 7
	if (timeFrame == "month") var days = 31

	let startingPoint = currentTime - (days * 24 * 60 * 60)

	let priceOf = price_combination[0]
	let priceIn = price_combination[1]
	let data = readPriceArray(poolAddress,priceOf,priceIn)

	let trimmedData = data.filter(item => Object.keys(item)[0] >= startingPoint)
	socket.emit("price_chart_combination", price_combination)
	socket.emit("price_chart", trimmedData)
}

function sendBalanceData(timeFrame,socket,poolAddress){
	let currentTime = new Date().getTime() / 1000

	if (timeFrame == "day") var days = 1
	if (timeFrame == "week") var days = 7
	if (timeFrame == "month") var days = 31

	let startingPoint = currentTime - (days * 24 * 60 * 60)

	let data = readBalancesArray(poolAddress)

	let trimmedData = data.filter(item => Object.keys(item)[0] >= startingPoint)
	socket.emit("balances_chart", trimmedData)
}

module.exports = {
    http_SocketSetup,
    https_SocketSetup
}
