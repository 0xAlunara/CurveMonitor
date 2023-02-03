const Web3 = require("web3")
const fs = require("fs")

const apiKeys = require('./api_keys')

const generic_utils = require("./generic_utils.js")
const getCurvePools = generic_utils.getCurvePools
const getABI = generic_utils.getABI
const errHandler = generic_utils.errHandler

// to deal with compute units / s
let maxRetries = 12

const options = {
	// Enable auto reconnection
	reconnect: {
		auto: true,
		delay: 89, // ms
		maxAttempts: 50,
		onTimeout: false
	}
}

const web3HTTP = new Web3(new Web3.providers.HttpProvider(apiKeys.web3HTTP, options))
const web3HTTP_llamarpc = new Web3(new Web3.providers.HttpProvider("https://eth.llamarpc.com/rpc/"+apiKeys.web3_llamarpc))

function setLlamaRPC(abi,address){
	return new web3HTTP_llamarpc.eth.Contract(abi, address)
}

function set(abi,address) {
	return new web3HTTP.eth.Contract(abi, address)
}


function bootPriceJSON(){
	let curveJSON = JSON.parse(fs.readFileSync("CurvePoolData.json"))
	let priceJSON
	try{
		priceJSON = JSON.parse(fs.readFileSync("prices.json"))
	} catch (err){
		priceJSON = {}
	}

	let pools = getCurvePools()
	for (const poolAddress of pools) {
		if (typeof priceJSON[poolAddress] !== "undefined") continue
		let originalArray = []
		let reversedArray  = []
		let nameArray = curveJSON[poolAddress].coin_names
		for (let i = 0; i < nameArray.length; i++) {
			for (let j = i + 1; j < nameArray.length; j++) {
				originalArray.push({
					type: "original",
					priceOf: nameArray[i],
					priceIn: nameArray[j],
					data: []
				})
				reversedArray.push({
					type: "reversed",
					priceOf: nameArray[j],
					priceIn: nameArray[i],
					data: []
				})
			}
		}
		let finalArray = originalArray.concat(reversedArray)
		priceJSON[poolAddress] = finalArray
	}
	fs.writeFileSync("prices.json", JSON.stringify(priceJSON, null, 4))
}

function findLastStoredUnixtimeForCombination(poolAddress,combination,priceJSON){
	let priceOf = combination.priceOf
	let priceIn = combination.priceIn
	let pairID = priceJSON[poolAddress].findIndex(item => {
		return item.priceOf == priceOf && item.priceIn == priceIn
	})
	let data = priceJSON[poolAddress][pairID].data
	if (data.length==0) return 0
	return Number((Object.keys(data[data.length-1]))[0])
}

function findLastStoredBlocknumberForCombination(poolAddress,combination,priceJSON){
	let lastStoredUnixtimeForCombination = findLastStoredUnixtimeForCombination(poolAddress,combination,priceJSON)
	if (lastStoredUnixtimeForCombination == 0) return 0
	let dataALL = JSON.parse(fs.readFileSync("processedTxLog_ALL.json"))
	let blockNumber = (dataALL[poolAddress].find(tx => tx.unixtime === lastStoredUnixtimeForCombination)).blockNumber
	return blockNumber
}

// for one pool for one specific token-combination (eg sUSD price in USDC), fetches historical prices
// input is the json with the processed tx-log, where the blockNumbers are used as relevant blocks to fetch the prices for
// stores the result as a json in a file
async function priceCollection_OneCombination(poolAddress,combination,dataALL,priceJSON){

	let curveJSON = JSON.parse(fs.readFileSync("CurvePoolData.json"))
	let CONTRACT = setLlamaRPC(await getABI(poolAddress),poolAddress)
	let priceOf = combination.priceOf
	let priceIn = combination.priceIn

	// pairID is inside price.json, at which place the token-combination is located. example: {"priceOf": "DAI","priceIn": "USDC"},{"priceOf": "DAI","priceIn": "USDT"}
	let pairID = priceJSON[poolAddress].findIndex(item => {
		return item.priceOf == priceOf && item.priceIn == priceIn
	})

	let coinID_priceOf = curveJSON[poolAddress].coin_names.indexOf(priceOf)
	let decimals_priceOf = curveJSON[poolAddress].decimals[coinID_priceOf]
	let dx = "1"
	for(var i = 0; i < decimals_priceOf; i++){dx+="0"}

	let coinID_priceIn = curveJSON[poolAddress].coin_names.indexOf(priceIn)

	// in case the prices got fetched for price coin0 in coin1, and we want the price of coin1 in coin0
	// pairId_Original is the index of the coin0 in coin1 pair in the array (will get used later to invert the price on)
	let pairId_Original
	let priceArray_Original
	if (combination.type == "reversed"){
		pairId_Original = priceJSON[poolAddress].findIndex(item => {
			return item.priceIn == priceOf && item.priceOf == priceIn
		})
		priceArray_Original = priceJSON[poolAddress][pairId_Original].data
	}

	let data = priceJSON[poolAddress][pairID].data

	// blockNumbers will be the array of missing blocks, input being the tx-logs
	let blockNumbers = dataALL[poolAddress].map(obj => obj.blockNumber)
	let lastStoredBlocknumberForCombination = findLastStoredBlocknumberForCombination(poolAddress,combination,priceJSON)
	let index = blockNumbers.indexOf(lastStoredBlocknumberForCombination)
	blockNumbers = blockNumbers.splice(index+1)

	// removing dupes caused by multiple tx in the same block
	blockNumbers = blockNumbers.filter((num, index) => blockNumbers.indexOf(num) === index)

	let counter = 1
	for (const blockNumber of blockNumbers) {

		let unixtime
		dataALL[poolAddress].forEach(element => {
			if (element.blockNumber === blockNumber) {
				unixtime = element.unixtime
			}
		})

		let dy

		if (combination.type == "original") {
			dy = await CONTRACT.methods.get_dy(coinID_priceOf,coinID_priceIn,dx).call({block:blockNumber})
			dy = dy / 10**curveJSON[poolAddress].decimals[coinID_priceIn]
			data.push({[unixtime]:dy})
		}

		if (combination.type == "reversed") {
			dy = (priceArray_Original.find(item => Object.keys(item)[0] == unixtime))[unixtime]
			dy = 1/dy
			data.push({[unixtime]:dy})
		}

		// saving each 100 fetches
		if (counter % 100 == 0){
			console.log(counter + "/" + blockNumbers.length, " | ", priceOf + "/" + priceIn," | unixtime",unixtime, " | dy",dy)
			priceJSON[poolAddress][pairID].data = data
			fs.writeFileSync("prices.json", JSON.stringify(priceJSON, null, 4))
		}
		counter +=1
	}

	// final save at end of collection for a certain combination
	fs.writeFileSync("prices.json", JSON.stringify(priceJSON, null, 4))
	return blockNumbers.length
}

async function priceCollection_AllCombinations(poolAddress){
	bootPriceJSON()

	// the stored JSON with the processed tx-log 
	let dataALL = JSON.parse(fs.readFileSync("processedTxLog_ALL.json"))

	// JSON with the combinations of pool token
	let priceJSON = JSON.parse(fs.readFileSync("prices.json"))

	let check = []

	// eg sUSD in DAI, USDT in sUSD, ...
	for(const combination of priceJSON[poolAddress]) {
		let state = await priceCollection_OneCombination(poolAddress,combination,dataALL,priceJSON)
		check.push(state)
	}
	return check
}

async function savePriceEntry(poolAddress, blockNumber,unixtime){
	let priceJSON = JSON.parse(fs.readFileSync("prices.json"))
	for(const combination of priceJSON[poolAddress]) {
		let hasUnixtime = combination.data.some(item => {
			return Object.keys(item)[0] == unixtime
		})
		if (hasUnixtime) return

		let curveJSON = JSON.parse(fs.readFileSync("CurvePoolData.json"))
		let CONTRACT = set(await getABI(poolAddress),poolAddress)
		let priceOf = combination.priceOf
		let priceIn = combination.priceIn
	
		// pairID is inside price.json, and which place the token-combination is located. example: {"priceOf": "DAI","priceIn": "USDC"},{"priceOf": "DAI","priceIn": "USDT"}
		let pairID = priceJSON[poolAddress].findIndex(item => {
			return item.priceOf == priceOf && item.priceIn == priceIn
		})
	
		let coinID_priceOf = curveJSON[poolAddress].coin_names.indexOf(priceOf)
		let decimals_priceOf = curveJSON[poolAddress].decimals[coinID_priceOf]
		let dx = "1"
		for(var i = 0; i < decimals_priceOf; i++){dx+="0"}
	
		let coinID_priceIn = curveJSON[poolAddress].coin_names.indexOf(priceIn)
	
		// in case the prices got fetched for price coin0 in coin1, and we want the price of coin1 in coin0
		// pairId_Original is the index of the coin0 in coin1 pair in the array (will get used later to invert the price on)
		let pairId_Original
		let priceArray_Original
		if (combination.type == "reversed"){
			pairId_Original = priceJSON[poolAddress].findIndex(item => {
				return item.priceIn == priceOf && item.priceOf == priceIn
			})
			priceArray_Original = priceJSON[poolAddress][pairId_Original].data
		}
	
		let data = priceJSON[poolAddress][pairID].data
	
		if (combination.type == "original") {
			let dy
			for (let i = 0; i < maxRetries; i++) {
				try {
					dy = await CONTRACT.methods.get_dy(coinID_priceOf,coinID_priceIn,dx).call({block:blockNumber})
					break
				} catch(error){await errHandler(error)}
			}
			dy = dy / 10**curveJSON[poolAddress].decimals[coinID_priceIn]
			data.push({[unixtime]:dy})
		}

		if (combination.type == "reversed") {
			let dy = (priceArray_Original.find(item => Object.keys(item)[0] == unixtime))[unixtime]
			dy = 1/dy
			data.push({[unixtime]:dy})
		}
	
		priceJSON[poolAddress][pairID].data = data
		fs.writeFileSync("prices.json", JSON.stringify(priceJSON, null, 4))
	}
}

async function priceCollectionMain(poolAddress){
	while(true){
		let check = await priceCollection_AllCombinations(poolAddress)
		// check is used to repeat the price collection cycle as long as the last cycle wasn't an empty fetch => up to date
		if (check.every(element => element == 0)) break
	}
	console.log("collection of prices complete for pool", poolAddress)
}

// used to forward the correct priceOf priceIn price-array to the client
function readPriceArray(poolAddress,priceOf,priceIn){
	let priceJSON = JSON.parse(fs.readFileSync("prices.json"))
	let combinationID = priceJSON[poolAddress].findIndex(item => {
		return item.priceOf == priceOf && item.priceIn == priceIn
	})
	let entry = priceJSON[poolAddress][combinationID]
	return entry.data
}

module.exports = {
	priceCollection_AllCombinations,
	priceCollection_OneCombination,
	findLastStoredBlocknumberForCombination,
	findLastStoredUnixtimeForCombination,
	bootPriceJSON,
	priceCollectionMain,
	savePriceEntry,
	readPriceArray
}
