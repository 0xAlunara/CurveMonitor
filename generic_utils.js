const fs = require("fs")
const axios = require("axios")

function getCurvePools(){
    let curveJSON = JSON.parse(fs.readFileSync("CurvePoolData.json"))

    let CurvePools = []

    for(var pool in curveJSON){
        CurvePools.push(pool)
    }
    return CurvePools
}

async function errHandler(error){
	let minRetryDelay = 200
	let maxRetryDelay = 400
	if (error.code !== 429) {
		console.log("errHandler",error)
		return
	}
	console.log("errHandler",error)
	let retryDelay = Math.floor(Math.random() * (maxRetryDelay - minRetryDelay + 1) + minRetryDelay)
	await new Promise(resolve => setTimeout(resolve, retryDelay))
}

function getCurrentTime() {
	const date = new Date()
	let hours = date.getHours()
	let minutes = date.getMinutes()
	let seconds = date.getSeconds()
	let milliseconds = date.getMilliseconds()
  
	hours = (hours < 10) ? "0" + hours : hours
	minutes = (minutes < 10) ? "0" + minutes : minutes
	seconds = (seconds < 10) ? "0" + seconds : seconds
	milliseconds = (milliseconds < 100) ? "0" + milliseconds : milliseconds
  
	return `\n${hours}:${minutes}:${seconds}:${milliseconds}`
}

async function getABI(poolAddress){
   
    try{
        var abiDataBase = JSON.parse(fs.readFileSync("abiDataBase.json"))
    } catch (err) {
        console.log("err reading abiDataBase.json in utils.js",err)
    }

    let poolABI = abiDataBase[poolAddress]

    if (typeof poolABI == "undefined"){
        let url = 'https://api.etherscan.io/api?module=contract&action=getabi&address='+ poolAddress + '&apikey=' + apiKeys.etherscanAPI_key
        let poolABI = (await axios.get(url)).data.result
        abiDataBase[poolAddress] = poolABI
        fs.writeFileSync("abiDataBase.json", JSON.stringify(abiDataBase, null, 4))
        return JSON.parse(poolABI)
    }else{
        return JSON.parse(poolABI)
    }
}

module.exports = {
	getCurrentTime,
    getABI,
    getCurvePools,
    errHandler
}
