const fs = require("fs")

const Web3 = require("web3")

const generic_utils = require("./generic_utils.js")
const getABI = generic_utils.getABI

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

let maxRetries = 12
let minRetryDelay = 100
let maxRetryDelay = 200
async function errHandler(error){
	if (error.code !== 429) {
		//console.log(error.message)
		//console.log("err in errHandler", error)
		return
	}
	console.log("err in errHandler", error)
	console.log(error.code)
	let retryDelay = Math.floor(Math.random() * (maxRetryDelay - minRetryDelay + 1) + minRetryDelay);
	await new Promise(resolve => setTimeout(resolve, retryDelay))
}

function getCurvePools(){
    let curveJSON = JSON.parse(fs.readFileSync("CurvePoolData.json"))

    let CurvePools = []

    for(var pool in curveJSON){
        CurvePools.push(pool)
    }
    return CurvePools
}

// takes the raw, unprocessed event logs
// sorts the events, adds or removes information, and stores the data for both the generic table and the mev table
function saveTxEntry(poolAddress, entry){
    //console.log("\npoolAddress",poolAddress,"entry",entry)

    let type = entry.type
    console.log(type)

    if (entry.type == "sandwich"){
        var fileName = "processedTxLog_MEV.json"
    } else {
        var fileName = "processedTxLog_ALL.json"
    }

    try {
        var tradeData = JSON.parse(fs.readFileSync(fileName))
    } catch(err) {
        var tradeData = {}
    }

    if (typeof tradeData[poolAddress] == "undefined"){
        tradeData[poolAddress] = []
    }

    // check if the tx had been saved before
    if (entry.type == "sandwich"){
        let blockNumber = entry.txHash
        for(const entry of tradeData[poolAddress]) {
            if (blockNumber == entry.blockNumber) return
        }
    } else {
        let txHash = entry.txHash
        for(const entry of tradeData[poolAddress]) {
            if (txHash == entry.txHash) return
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
		if (typeof collectedData[poolAddress] == "undefined") collectedData[poolAddress] = {}

		for(const eventName of eventNames) {
			if (typeof collectedData[poolAddress][eventName] == "undefined") {
				collectedData[poolAddress][eventName] = []
			}
		}
	}

	fs.writeFileSync("unprocessedEventLogs.json", JSON.stringify(collectedData, null, 1))

	let i = 0
	for(const poolAddress of CurvePools){
		if (poolAddress!=="0xA5407eAE9Ba41422680e2e00537571bcC53efBfD") continue // only does its thing for sUSD
		i+=1
		let ABI = await getABI(poolAddress)

		let fromBlock = findLatestCapturedBlockInRawEventLog(poolAddress,eventNames)
		if (fromBlock==0){
			fromBlock = await getStartBlock()
		}
		fromBlock+=1
		let toBlock
		for (let i = 0; i < maxRetries; i++) {
			try {
				toBlock = await web3HTTP.eth.getBlockNumber()
				break
			} catch(error){await errHandler(error)}
		}
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

	if (typeof foundEvents == "undefined"){
		foundEvents = 0
	}
	try{
		await CONTRACT.getPastEvents(eventName, { fromBlock: fromBlock, toBlock: toBlock }, async function (errors, events) {
			if (errors) {
				let message = errors.message
				const shortenErrMessage = message.slice(0, 42)
				if (shortenErrMessage == "Returned error: Log response size exceeded"){
					//console.log("Log response size exceeded")
					let blockRange = toBlock-fromBlock
					blockRange = Number((blockRange/10).toFixed(0))
					toBlock = fromBlock + blockRange
					await fetchEvents(collectedData, CONTRACT,eventName,eventNames,masterBlockRange,masterToBlock,poolAddress,fromBlock,toBlock,i,foundEvents)
				} else {
					console.log("error in getPastEvents, err:",errors)
				}
			} else {

				// no events left
				if (events.length==0) {
					fs.writeFileSync("unprocessedEventLogs.json", JSON.stringify(collectedData, null, 1))
					console.log(foundEvents,"events added for",poolAddress,eventName)
					if (eventName == eventNames[eventNames.length-1]){
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
				if (blockNumber<=startBlock){
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
			if (blockNumber<=startBlock){
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
			if (blockNumber<=startBlock){
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
			if (blockNumber>latestCapturedBlock){
				latestCapturedBlock = blockNumber
			}
		}
	}
	return latestCapturedBlock
}

// returns for example [{ DAI: 18907891 },{ USDC: 18942092 },{ USDT: 17561645 },{ sUSD: 14716529 }]
async function getTokenBalancesInsidePool(provider, poolAddress, blockNumber){

	let ABI_METAREGISTRY = [{"name":"CommitNewAdmin","inputs":[{"name":"deadline","type":"uint256","indexed":true},{"name":"admin","type":"address","indexed":true}],"anonymous":false,"type":"event"},{"name":"NewAdmin","inputs":[{"name":"admin","type":"address","indexed":true}],"anonymous":false,"type":"event"},{"stateMutability":"nonpayable","type":"constructor","inputs":[{"name":"_address_provider","type":"address"}],"outputs":[]},{"stateMutability":"nonpayable","type":"function","name":"add_registry_handler","inputs":[{"name":"_registry_handler","type":"address"}],"outputs":[]},{"stateMutability":"nonpayable","type":"function","name":"update_registry_handler","inputs":[{"name":"_index","type":"uint256"},{"name":"_registry_handler","type":"address"}],"outputs":[]},{"stateMutability":"view","type":"function","name":"get_registry_handlers_from_pool","inputs":[{"name":"_pool","type":"address"}],"outputs":[{"name":"","type":"address[10]"}]},{"stateMutability":"view","type":"function","name":"get_base_registry","inputs":[{"name":"registry_handler","type":"address"}],"outputs":[{"name":"","type":"address"}]},{"stateMutability":"view","type":"function","name":"find_pool_for_coins","inputs":[{"name":"_from","type":"address"},{"name":"_to","type":"address"}],"outputs":[{"name":"","type":"address"}]},{"stateMutability":"view","type":"function","name":"find_pool_for_coins","inputs":[{"name":"_from","type":"address"},{"name":"_to","type":"address"},{"name":"i","type":"uint256"}],"outputs":[{"name":"","type":"address"}]},{"stateMutability":"view","type":"function","name":"find_pools_for_coins","inputs":[{"name":"_from","type":"address"},{"name":"_to","type":"address"}],"outputs":[{"name":"","type":"address[]"}]},{"stateMutability":"view","type":"function","name":"get_admin_balances","inputs":[{"name":"_pool","type":"address"}],"outputs":[{"name":"","type":"uint256[8]"}]},{"stateMutability":"view","type":"function","name":"get_admin_balances","inputs":[{"name":"_pool","type":"address"},{"name":"_handler_id","type":"uint256"}],"outputs":[{"name":"","type":"uint256[8]"}]},{"stateMutability":"view","type":"function","name":"get_balances","inputs":[{"name":"_pool","type":"address"}],"outputs":[{"name":"","type":"uint256[8]"}]},{"stateMutability":"view","type":"function","name":"get_balances","inputs":[{"name":"_pool","type":"address"},{"name":"_handler_id","type":"uint256"}],"outputs":[{"name":"","type":"uint256[8]"}]},{"stateMutability":"view","type":"function","name":"get_base_pool","inputs":[{"name":"_pool","type":"address"}],"outputs":[{"name":"","type":"address"}]},{"stateMutability":"view","type":"function","name":"get_base_pool","inputs":[{"name":"_pool","type":"address"},{"name":"_handler_id","type":"uint256"}],"outputs":[{"name":"","type":"address"}]},{"stateMutability":"view","type":"function","name":"get_coin_indices","inputs":[{"name":"_pool","type":"address"},{"name":"_from","type":"address"},{"name":"_to","type":"address"}],"outputs":[{"name":"","type":"int128"},{"name":"","type":"int128"},{"name":"","type":"bool"}]},{"stateMutability":"view","type":"function","name":"get_coin_indices","inputs":[{"name":"_pool","type":"address"},{"name":"_from","type":"address"},{"name":"_to","type":"address"},{"name":"_handler_id","type":"uint256"}],"outputs":[{"name":"","type":"int128"},{"name":"","type":"int128"},{"name":"","type":"bool"}]},{"stateMutability":"view","type":"function","name":"get_coins","inputs":[{"name":"_pool","type":"address"}],"outputs":[{"name":"","type":"address[8]"}]},{"stateMutability":"view","type":"function","name":"get_coins","inputs":[{"name":"_pool","type":"address"},{"name":"_handler_id","type":"uint256"}],"outputs":[{"name":"","type":"address[8]"}]},{"stateMutability":"view","type":"function","name":"get_decimals","inputs":[{"name":"_pool","type":"address"}],"outputs":[{"name":"","type":"uint256[8]"}]},{"stateMutability":"view","type":"function","name":"get_decimals","inputs":[{"name":"_pool","type":"address"},{"name":"_handler_id","type":"uint256"}],"outputs":[{"name":"","type":"uint256[8]"}]},{"stateMutability":"view","type":"function","name":"get_fees","inputs":[{"name":"_pool","type":"address"}],"outputs":[{"name":"","type":"uint256[10]"}]},{"stateMutability":"view","type":"function","name":"get_fees","inputs":[{"name":"_pool","type":"address"},{"name":"_handler_id","type":"uint256"}],"outputs":[{"name":"","type":"uint256[10]"}]},{"stateMutability":"view","type":"function","name":"get_gauge","inputs":[{"name":"_pool","type":"address"}],"outputs":[{"name":"","type":"address"}]},{"stateMutability":"view","type":"function","name":"get_gauge","inputs":[{"name":"_pool","type":"address"},{"name":"gauge_idx","type":"uint256"}],"outputs":[{"name":"","type":"address"}]},{"stateMutability":"view","type":"function","name":"get_gauge","inputs":[{"name":"_pool","type":"address"},{"name":"gauge_idx","type":"uint256"},{"name":"_handler_id","type":"uint256"}],"outputs":[{"name":"","type":"address"}]},{"stateMutability":"view","type":"function","name":"get_gauge_type","inputs":[{"name":"_pool","type":"address"}],"outputs":[{"name":"","type":"int128"}]},{"stateMutability":"view","type":"function","name":"get_gauge_type","inputs":[{"name":"_pool","type":"address"},{"name":"gauge_idx","type":"uint256"}],"outputs":[{"name":"","type":"int128"}]},{"stateMutability":"view","type":"function","name":"get_gauge_type","inputs":[{"name":"_pool","type":"address"},{"name":"gauge_idx","type":"uint256"},{"name":"_handler_id","type":"uint256"}],"outputs":[{"name":"","type":"int128"}]},{"stateMutability":"view","type":"function","name":"get_lp_token","inputs":[{"name":"_pool","type":"address"}],"outputs":[{"name":"","type":"address"}]},{"stateMutability":"view","type":"function","name":"get_lp_token","inputs":[{"name":"_pool","type":"address"},{"name":"_handler_id","type":"uint256"}],"outputs":[{"name":"","type":"address"}]},{"stateMutability":"view","type":"function","name":"get_n_coins","inputs":[{"name":"_pool","type":"address"}],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"view","type":"function","name":"get_n_coins","inputs":[{"name":"_pool","type":"address"},{"name":"_handler_id","type":"uint256"}],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"view","type":"function","name":"get_n_underlying_coins","inputs":[{"name":"_pool","type":"address"}],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"view","type":"function","name":"get_n_underlying_coins","inputs":[{"name":"_pool","type":"address"},{"name":"_handler_id","type":"uint256"}],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"view","type":"function","name":"get_pool_asset_type","inputs":[{"name":"_pool","type":"address"}],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"view","type":"function","name":"get_pool_asset_type","inputs":[{"name":"_pool","type":"address"},{"name":"_handler_id","type":"uint256"}],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"view","type":"function","name":"get_pool_from_lp_token","inputs":[{"name":"_token","type":"address"}],"outputs":[{"name":"","type":"address"}]},{"stateMutability":"view","type":"function","name":"get_pool_from_lp_token","inputs":[{"name":"_token","type":"address"},{"name":"_handler_id","type":"uint256"}],"outputs":[{"name":"","type":"address"}]},{"stateMutability":"view","type":"function","name":"get_pool_params","inputs":[{"name":"_pool","type":"address"}],"outputs":[{"name":"","type":"uint256[20]"}]},{"stateMutability":"view","type":"function","name":"get_pool_params","inputs":[{"name":"_pool","type":"address"},{"name":"_handler_id","type":"uint256"}],"outputs":[{"name":"","type":"uint256[20]"}]},{"stateMutability":"view","type":"function","name":"get_pool_name","inputs":[{"name":"_pool","type":"address"}],"outputs":[{"name":"","type":"string"}]},{"stateMutability":"view","type":"function","name":"get_pool_name","inputs":[{"name":"_pool","type":"address"},{"name":"_handler_id","type":"uint256"}],"outputs":[{"name":"","type":"string"}]},{"stateMutability":"view","type":"function","name":"get_underlying_balances","inputs":[{"name":"_pool","type":"address"}],"outputs":[{"name":"","type":"uint256[8]"}]},{"stateMutability":"view","type":"function","name":"get_underlying_balances","inputs":[{"name":"_pool","type":"address"},{"name":"_handler_id","type":"uint256"}],"outputs":[{"name":"","type":"uint256[8]"}]},{"stateMutability":"view","type":"function","name":"get_underlying_coins","inputs":[{"name":"_pool","type":"address"}],"outputs":[{"name":"","type":"address[8]"}]},{"stateMutability":"view","type":"function","name":"get_underlying_coins","inputs":[{"name":"_pool","type":"address"},{"name":"_handler_id","type":"uint256"}],"outputs":[{"name":"","type":"address[8]"}]},{"stateMutability":"view","type":"function","name":"get_underlying_decimals","inputs":[{"name":"_pool","type":"address"}],"outputs":[{"name":"","type":"uint256[8]"}]},{"stateMutability":"view","type":"function","name":"get_underlying_decimals","inputs":[{"name":"_pool","type":"address"},{"name":"_handler_id","type":"uint256"}],"outputs":[{"name":"","type":"uint256[8]"}]},{"stateMutability":"view","type":"function","name":"get_virtual_price_from_lp_token","inputs":[{"name":"_token","type":"address"}],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"view","type":"function","name":"get_virtual_price_from_lp_token","inputs":[{"name":"_token","type":"address"},{"name":"_handler_id","type":"uint256"}],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"view","type":"function","name":"is_meta","inputs":[{"name":"_pool","type":"address"}],"outputs":[{"name":"","type":"bool"}]},{"stateMutability":"view","type":"function","name":"is_meta","inputs":[{"name":"_pool","type":"address"},{"name":"_handler_id","type":"uint256"}],"outputs":[{"name":"","type":"bool"}]},{"stateMutability":"view","type":"function","name":"is_registered","inputs":[{"name":"_pool","type":"address"}],"outputs":[{"name":"","type":"bool"}]},{"stateMutability":"view","type":"function","name":"is_registered","inputs":[{"name":"_pool","type":"address"},{"name":"_handler_id","type":"uint256"}],"outputs":[{"name":"","type":"bool"}]},{"stateMutability":"view","type":"function","name":"pool_count","inputs":[],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"view","type":"function","name":"pool_list","inputs":[{"name":"_index","type":"uint256"}],"outputs":[{"name":"","type":"address"}]},{"stateMutability":"view","type":"function","name":"address_provider","inputs":[],"outputs":[{"name":"","type":"address"}]},{"stateMutability":"view","type":"function","name":"owner","inputs":[],"outputs":[{"name":"","type":"address"}]},{"stateMutability":"view","type":"function","name":"get_registry","inputs":[{"name":"arg0","type":"uint256"}],"outputs":[{"name":"","type":"address"}]},{"stateMutability":"view","type":"function","name":"registry_length","inputs":[],"outputs":[{"name":"","type":"uint256"}]}]
	let METAREGISTRY = new provider.eth.Contract(ABI_METAREGISTRY, "0xF98B45FA17DE75FB1aD0e7aFD971b0ca00e379fC")
	let balances = await METAREGISTRY.methods.get_balances(poolAddress).call(blockNumber)

	// removing 0,0,0 from the end
	let curveJSON = JSON.parse(fs.readFileSync("CurvePoolData.json"))
	let number_coins = curveJSON[poolAddress]["n_coins"]
	let numberOf0s = balances.length - number_coins
	balances = balances.filter((balances, i) => i + numberOf0s < balances.length)

	// adjusting for decimals to normalize 
	for(var i = 0; i < number_coins; i++){
		let decimals = curveJSON[poolAddress]["decimals"][i]
		let tokenBalance = balances[i]
		let name = curveJSON[poolAddress]["coin_names"][i]
		balances[i] = {[name]:Number((tokenBalance / 10**decimals).toFixed(0))}
	}

	return balances
}

async function getTokenName(tokenAddress){
	if (tokenAddress == "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE") return "ETH"
	if (tokenAddress == "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee") return "ETH"

	// web3 call
	/*
	let ABI_SYMBOL = [{"stateMutability":"view","type":"function","name":"symbol","inputs":[],"outputs":[{"name":"","type":"string"}],}]
	let CONTRACT = set(ABI_SYMBOL, address)
	let name
	for (let i = 0; i < maxRetries; i++) {
		try {
			name = await CONTRACT.methods.symbol().call() 
			break
		} catch(error){await errHandler(error)}
	}
	return name
	*/

	// local storage check up
	tokenAddress = tokenAddress.toLowerCase();
	let curveJSON = JSON.parse(fs.readFileSync("CurvePoolData.json"))
	for (const [key, value] of Object.entries(curveJSON)) {
		const index = value.coins.map(str => str.toLowerCase()).indexOf(tokenAddress.toLowerCase())
		if (index !== -1) {
			return value.coin_names[index]
		}
	}
	return null
}

module.exports = {
    saveTxEntry,
    findLastProcessedEvent,
    collection,
    fetchEvents,
    getStartBlock,
    removeOutdatedBlocksRawLog,
    findLatestCapturedBlockInRawEventLog,
	getTokenBalancesInsidePool,
	getTokenName
}