const fs = require("fs")
const axios = require("axios")

const Web3 = require("web3")

const options = {
	// Enable auto reconnection
	reconnect: {
		auto: true,
		delay: 10000, // ms
		maxAttempts: 50,
		onTimeout: false
	}
}
const apiKeys = require('./api_keys')
const web3HTTP = new Web3(new Web3.providers.HttpProvider(apiKeys.web3HTTP, options))

function set(abi,address) {
	return new web3HTTP.eth.Contract(abi, address)
}

function getCurvePools(){
    let curveJSON = JSON.parse(fs.readFileSync("CurvePoolData.json"))

    let CurvePools = []

    for(var pool in curveJSON){
        CurvePools.push(pool)
    }
    return CurvePools
}

async function getABI(poolAddress){

    try{
        var abiDataBase = JSON.parse(fs.readFileSync("abiDataBase.json"))
    } catch (err) {
        var abiDataBase = {}
    }

    let poolABI = abiDataBase[poolAddress]

    if(typeof poolABI == "undefined"){
        let url = 'https://api.etherscan.io/api?module=contract&action=getabi&address='+ poolAddress + '&apikey=' + apiKeys.etherscanAPI_key
        let poolABI = (await axios.get(url)).data.result
        abiDataBase[poolAddress] = poolABI
        fs.writeFileSync("abiDataBase.json", JSON.stringify(abiDataBase, null, 4))
        return JSON.parse(poolABI)
    }else{
        return JSON.parse(poolABI)
    }
}

// takes the raw, unprocessed event logs
// sorts the events, adds or removes information, and stores the data for both the generic table and the mev table
function processEntry(poolAddress, entry){
    //console.log("\npoolAddress",poolAddress,"entry",entry)

    let type = entry.type
    console.log(type)

    if(entry.type == "sandwich"){
        var fileName = "processedTxLog_MEV.json"
    } else {
        var fileName = "processedTxLog_ALL.json"
    }

    try {
        var tradeData = JSON.parse(fs.readFileSync(fileName))
    } catch(err) {
        var tradeData = {}
    }

    if(typeof tradeData[poolAddress] == "undefined"){
        tradeData[poolAddress] = []
    }

    // check if the tx had been saved before
    if(entry.type == "sandwich"){
        let blockNumber = entry.txHash
        for(const entry of tradeData[poolAddress]) {
            if(blockNumber == entry.blockNumber) return
        }
    } else {
        let txHash = entry.txHash
        for(const entry of tradeData[poolAddress]) {
            if(txHash == entry.txHash) return
        }
    }

    tradeData[poolAddress].push(entry)
    fs.writeFileSync(fileName, JSON.stringify(tradeData, null, 4))
}

// finds the last event that has been processed for a given pool, so find the starting point for processing the raw event log
async function findLastProcessedEvent(poolAddress){
	let processedTxLog_ALL = JSON.parse(fs.readFileSync("processedTxLog_ALL.json"))
    let txArray = processedTxLog_ALL[poolAddress]
    let biggestBlockNumber = txArray.reduce((max, current) => {
        return Math.max(max, current.blockNumber)
    }, 0)
    // + 1 to not scan the last block twice
    return biggestBlockNumber + 1
}

// removes outdated events
// adds events in the time range of "lastly screened" and "now".
// events stored in "unprocessedEventLogs.json".json. 
async function collection(isCollecting){

	// collectionState.collectingRawLogs is used to give the raw log collection enough time to be processed and saved.
	// only then proceeds with processing the raw logs
	try{
		var collectionState = JSON.parse(fs.readFileSync("collectorState.json"))
	} catch (err) {
		var collectionState = {}
		fs.writeFileSync("collectorState.json", JSON.stringify(collectionState))
	}

	collectionState["collectingRawLogs"] = true
	collectionState["rawLogsUpToDate"] = false
	fs.writeFileSync("collectorState.json", JSON.stringify(collectionState))

	// loading the file with the stored events, or creating it
	try{
		var collectedData = JSON.parse(fs.readFileSync("unprocessedEventLogs.json"))
	} catch (err) {
		var collectedData = {}
		fs.writeFileSync("unprocessedEventLogs.json", "{}")
	}

    let eventNames = [
		"RemoveLiquidity",
		"RemoveLiquidityOne",
		"RemoveLiquidityImbalance",
		"AddLiquidity",
		"TokenExchange",
		"TokenExchangeUnderlying"
	]

	await removeOutdatedBlocksRawLog(eventNames)
	await removeOutdatedBlocksProcessedLog_ALL(eventNames)
	await removeOutdatedBlocksProcessedLog_MEV(eventNames)

	collectedData = JSON.parse(fs.readFileSync("unprocessedEventLogs.json"))

	let CurvePools = getCurvePools()

	// init the json structure (poolAddresses -> eventNames)
	for(const poolAddress of CurvePools){
		if(typeof collectedData[poolAddress] == "undefined") collectedData[poolAddress] = {}

		for(const eventName of eventNames) {
			if(typeof collectedData[poolAddress][eventName] == "undefined") {
				collectedData[poolAddress][eventName] = []
			}
		}
	}

	fs.writeFileSync("unprocessedEventLogs.json", JSON.stringify(collectedData, null, 1))

	let i = 0
	for(const poolAddress of CurvePools){
		if(poolAddress!=="0xA5407eAE9Ba41422680e2e00537571bcC53efBfD") continue // only does its thing for sUSD
		i+=1
		let ABI = await getABI(poolAddress)

		let fromBlock = findLatestCapturedBlockInRawEventLog(poolAddress,eventNames)
		if(fromBlock==0){
			fromBlock = await getStartBlock()
		}
		fromBlock+=1
		let toBlock = await web3HTTP.eth.getBlockNumber()
		const masterToBlock = toBlock

		// interating over all event-types in a given pool
		for (const eventName of eventNames){

			// ABI does not contain the word <eventName>
			if (!JSON.stringify(ABI).includes(eventName)) continue

			let CONTRACT = set(ABI, poolAddress)
			const masterBlockRange = masterToBlock - fromBlock
			await fetchEvents(collectedData,CONTRACT,eventName,eventNames,masterBlockRange,masterToBlock,poolAddress,fromBlock,toBlock,i)
		}
	}
}

// writes events to the log-file.
// search params: pool, eventName, blockRange
async function fetchEvents(collectedData, CONTRACT,eventName,eventNames,masterBlockRange,masterToBlock,poolAddress,fromBlock,toBlock,i,foundEvents){
	let results = collectedData[poolAddress][eventName]
	let CurvePools = getCurvePools()

	if(typeof foundEvents == "undefined"){
		foundEvents = 0
	}
	try{
		await CONTRACT.getPastEvents(eventName, { fromBlock: fromBlock, toBlock: toBlock }, async function (errors, events) {
			if (errors) {
				let message = errors.message
				const shortenErrMessage = message.slice(0, 42)
				if(shortenErrMessage == "Returned error: Log response size exceeded"){
					//console.log("Log response size exceeded")
					let blockRange = toBlock-fromBlock
					blockRange = Number((blockRange/10).toFixed(0))
					toBlock = fromBlock + blockRange
					await fetchEvents(collectedData, CONTRACT,eventName,eventNames,masterBlockRange,masterToBlock,poolAddress,fromBlock,toBlock,i,foundEvents)
				}
			} else {

				// no events left
				if(events.length==0) {
					fs.writeFileSync("unprocessedEventLogs.json", JSON.stringify(collectedData, null, 1))
					console.log(i+"/"+CurvePools.length,foundEvents,"events added for",poolAddress,eventName)
					if(eventName == eventNames[eventNames.length-1]){
						console.log("\ncollection of raw logs complete for",poolAddress,"\n")
						var collectionState = {
							"collectingRawLogs":false
						}
						fs.writeFileSync("collectorState.json", JSON.stringify(collectionState))
					}
					//console.log(foundEvents,"events added for",poolAddress,eventName)
					return
				}

				// adding all the events to the results-array
				for(const data of events) {
					results.push(data)
				}
				foundEvents+=events.length

				// preparing params for next round
				let lastStoredBlock = results[results.length-1].blockNumber
				fromBlock = lastStoredBlock+1
				toBlock = masterToBlock

				// starting a next scan-cycle to slowly creep up to the present blocks
				await fetchEvents(collectedData,CONTRACT,eventName,eventNames,masterBlockRange,masterToBlock,poolAddress,fromBlock,toBlock,i,foundEvents)
			}
		})
	}catch(err){
		//console.log(err.message)
	}
}

// finds the block which was created 31 days ago
// used as the starting point for the event-collection
async function getStartBlock(){
	let secondsInADay = 86400
	let timeHorizonInDays = 31
	let secondsToCover = secondsInADay * timeHorizonInDays
	let secondsBetweenBlocks = 12.05
	let totalBlocksToCover = secondsToCover / secondsBetweenBlocks
	let currentBlock = await web3HTTP.eth.getBlockNumber()
	let startBlock = Number((currentBlock - totalBlocksToCover).toFixed(0))
	return startBlock
}

// this function removes events older than 31 days from the raw log-file.
// might get removed in the future. 
async function removeOutdatedBlocksRawLog(eventNames){

    try{
		var collectedData = JSON.parse(fs.readFileSync("unprocessedEventLogs.json"))
	} catch (err) {
		var collectedData = {}
		fs.writeFileSync("unprocessedEventLogs.json", "{}")
	}

	let total = 0
	let outdated = 0
	let startBlock = await getStartBlock()
	for(var poolAddress in collectedData){
        for(const eventName of eventNames){
            let eventSpecificLogs = collectedData[poolAddress][eventName]
            for (let i = 0; i < eventSpecificLogs.length; i++) {
				let event = eventSpecificLogs[i]
				let blockNumber = event.blockNumber
				if(blockNumber<=startBlock){
					outdated+=1
					eventSpecificLogs.splice(i, 1)
        			i-- // Decrement the index to account for the removed element
				}
				total+=1
			}
		}
	}
	fs.writeFileSync("unprocessedEventLogs.json", JSON.stringify(collectedData, null, 1))
	console.log("total events",total,"removed",outdated,"from unprocessedEventLogs")
}

// this function removes events older than 31 days from the processed tx log-file.
// might get removed in the future. 
async function removeOutdatedBlocksProcessedLog_ALL(eventNames){

    try{
		var collectedData = JSON.parse(fs.readFileSync("processedTxLog_ALL.json"))
	} catch (err) {
		var collectedData = {}
		fs.writeFileSync("processedTxLog_ALL.json", "{}")
	}

	let total = 0
	let outdated = 0
	let startBlock = await getStartBlock()
	for(var poolAddress in collectedData){
		let poolSpecificLogs = collectedData[poolAddress]
		for (let i = 0; i < poolSpecificLogs.length; i++) {
			let event = poolSpecificLogs[i]
			let blockNumber = event.blockNumber
			if(blockNumber<=startBlock){
				outdated+=1
				poolSpecificLogs.splice(i, 1)
				i-- // Decrement the index to account for the removed element
			}
			total+=1
		}
	}
	fs.writeFileSync("processedTxLog_ALL.json", JSON.stringify(collectedData, null, 1))
	console.log("total events",total,"removed",outdated,"from processedTxLog_ALL")
}

// this function removes events older than 31 days from the processed tx mev log-file.
// might get removed in the future. 
async function removeOutdatedBlocksProcessedLog_MEV(eventNames){

    try{
		var collectedData = JSON.parse(fs.readFileSync("processedTxLog_MEV.json"))
	} catch (err) {
		var collectedData = {}
		fs.writeFileSync("processedTxLog_MEV.json", "{}")
	}

	let total = 0
	let outdated = 0
	let startBlock = await getStartBlock()
	for(var poolAddress in collectedData){
		let poolSpecificLogs = collectedData[poolAddress]
		for (let i = 0; i < poolSpecificLogs.length; i++) {
			let event = poolSpecificLogs[i]
			let blockNumber = event.blockNumber
			if(blockNumber<=startBlock){
				outdated+=1
				poolSpecificLogs.splice(i, 1)
				i-- // Decrement the index to account for the removed element
			}
			total+=1
		}
	}
	fs.writeFileSync("processedTxLog_MEV.json", JSON.stringify(collectedData, null, 1))
	console.log("total events",total,"removed",outdated,"from processedTxLog_MEV")
}

// opens the stored logs for a pool and returns the last block that was saved for that pool.
// used to find the spot in time for which the data-collection should get resumed.
function findLatestCapturedBlockInRawEventLog(poolAddress,eventNames){

	let latestCapturedBlock = 0
	let collectedData = JSON.parse(fs.readFileSync("unprocessedEventLogs.json"))
	for(const eventName of eventNames){
		let eventSpecificLogs = collectedData[poolAddress][eventName]
		for (let i = 0; i < eventSpecificLogs.length; i++) {
			let event = eventSpecificLogs[i]
			let blockNumber = event.blockNumber
			if(blockNumber>latestCapturedBlock){
				latestCapturedBlock = blockNumber
			}
		}
	}
	return latestCapturedBlock
}

module.exports = {
	getABI,
    getCurvePools,
    processEntry,
    findLastProcessedEvent,
    collection,
    fetchEvents,
    getStartBlock,
    removeOutdatedBlocksRawLog,
    findLatestCapturedBlockInRawEventLog,
}