const Web3 = require("web3")
const fs = require("fs")

const apiKeys = require('./api_keys')

const generic_utils = require("./generic_utils.js")
const getCurvePools = generic_utils.getCurvePools
const getABI = generic_utils.getABI

const options = {
	// Enable auto reconnection
	reconnect: {
		auto: true,
		delay: 89, // ms
		maxAttempts: 50,
		onTimeout: false
	}
}
console.clear()

const web3HTTP = new Web3(new Web3.providers.HttpProvider(apiKeys.web3HTTP, options))
const web3HTTP_llamarpc = new Web3(new Web3.providers.HttpProvider("https://eth.llamarpc.com/rpc/"+apiKeys.web3_llamarpc))

function setLlamaRPC(abi,address){
	return new web3HTTP_llamarpc.eth.Contract(abi, address)
}

function set(abi,address) {
	return new web3HTTP.eth.Contract(abi, address)
}

let curveJSON = JSON.parse(fs.readFileSync("CurvePoolData.json"))

function roundNumber(num) {
	if (num >= 1000) return Number(num.toFixed(0))
	if (num < 1000) return Number(num.toFixed(1))
	if (num < 100) return Number(num.toFixed(2))
	if (num < 10) return Number(num.toFixed(3))
}

function bootBalancesJSON(){
	let balancesJSON
	try{
		balancesJSON = JSON.parse(fs.readFileSync("balances.json"))
	} catch (err){
		balancesJSON = {}
	}
	let pools = getCurvePools()
	for (const poolAddress of pools) {
		if (typeof balancesJSON[poolAddress] !== "undefined") continue
		balancesJSON[poolAddress] = []
	}
	fs.writeFileSync("balances.json", JSON.stringify(balancesJSON, null, 4))
}

// returns an arr with all blocknumbers which saw action for a given pool
function getRawBlocknumbers(poolAddress){
	let dataALL = JSON.parse(fs.readFileSync("processedTxLog_ALL.json"))
	let blockNumbers = dataALL[poolAddress].map(obj => obj.blockNumber)
	return blockNumbers
}

async function getPoolBalance(METAREGISTRY,poolAddress,blockNumber){

	// example: balances = ['18640063536133844603972293','18564920428085','17811701123312','16056764826637922459027923','0','0','0','0' ]
	let balances = await METAREGISTRY.methods.get_balances(poolAddress).call({block:blockNumber})

	// example: balances = ['18640063536133844603972293','18564920428085','17811701123312','16056764826637922459027923' ]
	balances = balances.slice(0, -curveJSON[poolAddress].n_coins)

	// example: balances = [ 18640063,18564920,17811701,16056764 ]
	let decimals = curveJSON[poolAddress].decimals
	balances = balances.map((item, index) => {
		return roundNumber(item / (10 ** decimals[index]))
	})

	return balances
}

function findLastStoredUnixtime_inBalances(poolAddress){
	let lastStoredUnixtime
	let balancesJSON = JSON.parse(fs.readFileSync("balances.json"))
	try{
		lastStoredUnixtime = Number((Object.keys(balancesJSON[poolAddress][balancesJSON[poolAddress].length-1]))[0])
	} catch (err){
		lastStoredUnixtime = 0
	}
	return lastStoredUnixtime
}

function findLastStoredBlocknumber_inBalances(poolAddress){
	let lastStoredUnixtime = findLastStoredUnixtime_inBalances(poolAddress)
	if (lastStoredUnixtime == 0) return 0
	let dataALL = JSON.parse(fs.readFileSync("processedTxLog_ALL.json"))
	let blockNumber = (dataALL[poolAddress].find(tx => tx.unixtime === lastStoredUnixtime)).blockNumber
	return blockNumber
}

async function fetchBalancesForPool(poolAddress){
	let dataALL = JSON.parse(fs.readFileSync("processedTxLog_ALL.json"))
	let balancesJSON = JSON.parse(fs.readFileSync("balances.json"))

    let addressMetaregistry = "0xF98B45FA17DE75FB1aD0e7aFD971b0ca00e379fC"
    let abiMetaregistry = await getABI(addressMetaregistry)
    let METAREGISTRY = setLlamaRPC(abiMetaregistry,addressMetaregistry)

	let lastStoredBlocknumber = findLastStoredBlocknumber_inBalances(poolAddress)

	let rawBlocknumbers = getRawBlocknumbers(poolAddress)
	let index = rawBlocknumbers.indexOf(lastStoredBlocknumber)
	let blockNumbers = rawBlocknumbers.splice(index+2)

	// removing dupes caused by multiple tx in the same block
	blockNumbers = blockNumbers.filter((num, index) => blockNumbers.indexOf(num) === index)

	let data = balancesJSON[poolAddress]

	let counter = 1
	for (const blockNumber of blockNumbers) {
		let unixtime
		dataALL[poolAddress].forEach(element => {
			if (element.blockNumber === blockNumber) {
				unixtime = element.unixtime
			}
		})
		let balances = await getPoolBalance(METAREGISTRY,poolAddress,blockNumber)
		data.push({[unixtime]: balances})

		// saving each 100 fetches
		if (counter % 100 == 0){
			balancesJSON[poolAddress] = data
			fs.writeFileSync("balances.json", JSON.stringify(balancesJSON, null, 4))
            console.log(counter + "/" + blockNumbers.length, unixtime, balances,poolAddress)
		}
		counter +=1
	}
	// final save at end of collection for a certain combination
	fs.writeFileSync("balances.json", JSON.stringify(balancesJSON, null, 4))

    // returns the number of blocks that had to be fetched. If 0, we know it is up to date. If it was more than 0, we repeat the cycle
    return blockNumbers.length
}

// extra set up because it needs a different web3 provider
async function fetchBalanceOnce(poolAddress,blockNumber){
	let balancesJSON = JSON.parse(fs.readFileSync("balances.json"))
	let data = balancesJSON[poolAddress]
    let addressMetaregistry = "0xF98B45FA17DE75FB1aD0e7aFD971b0ca00e379fC"
	let METAREGISTRY = set(await getABI(addressMetaregistry),addressMetaregistry)
	let balances = await METAREGISTRY.methods.get_balances(poolAddress).call(blockNumber)
	let curveJSON = JSON.parse(fs.readFileSync("CurvePoolData.json"))
	balances = balances.slice(0, -curveJSON[poolAddress].n_coins)
	let decimals = curveJSON[poolAddress].decimals
	balances = balances.map((item, index) => {
		return roundNumber(item / (10 ** decimals[index]))
	})
	let unixtime
    let dataALL = JSON.parse(fs.readFileSync("processedTxLog_ALL.json"))
	dataALL[poolAddress].forEach(element => {
		if (element.blockNumber === blockNumber) {
			unixtime = element.unixtime
		}
	})
    let entry = {[unixtime]: balances}
	data.push(entry)
	fs.writeFileSync("balances.json", JSON.stringify(balancesJSON, null, 4))
    return entry
}

async function balancesCollectionMain(poolAddress){
	while(true){
		let check = await fetchBalancesForPool(poolAddress)
		// check is used to repeat the balances collection cycle as long as the last cycle wasn't an empty fetch => up to date
		if (check==0) break
	}
	console.log("collection of balances complete for pool", poolAddress)
}

// used to forward balances-array to the client
function readBalancesArray(poolAddress){
    let balancesJSON = JSON.parse(fs.readFileSync("balances.json"))
	return balancesJSON[poolAddress]
}

module.exports = {
	fetchBalancesForPool,
	fetchBalanceOnce,
	findLastStoredBlocknumber_inBalances,
	findLastStoredUnixtime_inBalances,
	getPoolBalance,
	getRawBlocknumbers,
	bootBalancesJSON,
	roundNumber,
    balancesCollectionMain,
    readBalancesArray
}
