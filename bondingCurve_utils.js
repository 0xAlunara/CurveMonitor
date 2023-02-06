const https = require("https")
const fs = require("fs")

function loadData(){
    try {
        return JSON.parse(fs.readFileSync("bondingCurve.json"))
    } catch(err) {
        let data = {}
        fs.writeFileSync("bondingCurve.json", JSON.stringify(data))
        return data
    }
}

function save(poolAddress,bondingCurveData){
    let bondingCurveJSON = loadData()
    bondingCurveJSON[poolAddress] = bondingCurveData
    fs.writeFileSync("bondingCurve.json", JSON.stringify(bondingCurveJSON))
}

// normalizes all balances to 18 digits
function getNormalizedBalances(poolAddress){

    // goes into balances.json, and finds the arr for the pool, then picks the last entry
    let balancesJSON = JSON.parse(fs.readFileSync("balances.json"))
    let balances = balancesJSON[poolAddress]
    balances = balances[balances.length - 1]
    balances = Object.values(balances)[0]

    for(let i=0;i<balances.length;i++){
        for(let j=0;j<18;j++){
            balances[i] += "0"
        }
    }

    return balances
}

// builds the data for the request to api-py.llama.airforce/curve/v1
function buildDataForApiRequest(poolAddress){
    let curveJSON = JSON.parse(fs.readFileSync("CurvePoolData.json"))

    let A = curveJSON[poolAddress]["pool_params"][0]
    let gamma = curveJSON[poolAddress]["gamma"]
    let xp = getNormalizedBalances(poolAddress)
    let coins = curveJSON[poolAddress]["coin_names"]
    let version = curveJSON[poolAddress]["version"]

    if(version=="V2"){
        let price_scale = curveJSON[poolAddress]["price_scale"]
        for(let i=0;i<price_scale.length;i++){
            xp[i+1] = xp[i+1] * price_scale[i] / 1e18
            xp[i+1] = BigInt(xp[i+1]).toString()
        }
    }

    let data = {
        A: A,
        gamma: gamma,
        xp: xp,
        coins: coins,
        resolution: 1000,
        version: version
    }

    return data
}

// posting the api-request
async function getBondingCurveData(data,poolAddress) {
    return new Promise((resolve, reject) => {
        let path
        if(data.version=="V1") path = '/curve/v1/pools/curve/v1'
        if(data.version=="V2") path = '/curve/v1/pools/curve/v2'
        let options = {
            hostname: 'api-py.llama.airforce',
            path: path,
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        }

        let req = https.request(options, res => {
            if(res.statusCode==500) {
                console.log("500",data)
                return
            }

            let chunks = []

            res.on("data", function (chunk) {
                chunks.push(chunk)
            })

            res.on("end", function () {
                let body = Buffer.concat(chunks)
                resolve(JSON.parse(body.toString()))
            })
        })

        req.on('error', error => {
            reject(error)
        })

        if(data.version=="V1") req.write(`A=${data.A}&xp=${data.xp}&coins=${data.coins}&resolution=${data.resolution}`)
        if(data.version=="V2") req.write(`A=${data.A}&gamma=${data.gamma}&xp=${data.xp}&coins=${data.coins}&resolution=${data.resolution}`)

        req.end()
    })

}

// at the end, division by 1e18 to avoid the overzised numbers
function divideBy1e18(bondingCurveData) {
    for (const curve of bondingCurveData.curves) {
        curve.x = curve.x.map(x => Number((x / 1e18).toFixed(0)))
        curve.y = curve.y.map(y => Number((y / 1e18).toFixed(0)))
    }
}

function scaleDown(bondingCurveData,poolAddress){
    let curves = bondingCurveData.curves
    let curveJSON = JSON.parse(fs.readFileSync("CurvePoolData.json"))
    let price_scale = curveJSON[poolAddress]["price_scale"]

    let version = curveJSON[poolAddress]["version"]
    if(version!=="V2")return

    // loops over the bonding-curves
    for(let i=0;i<curves.length;i++){
        let curve = curves[i]

        if(i<=1){

            let price_scale_y = price_scale[i]

            // downscaling y
            let y_downscaled = []
            for(let number of curve.y){
                number = number / price_scale_y * 1e18
                number = Number(number.toFixed(0))
                y_downscaled.push(number)
            }
            curve.y = y_downscaled
        }

        // case example: coins0: WBTC, coin1: WETH, needs downscaling on both
        if(i==2){

            let price_scale_x = price_scale[0]
            let price_scale_y = price_scale[1]

            // downscaling x
            let x_downscaled = []
            for(let number of curve.x){
                number = number / price_scale_x * 1e18
                number = Number(number.toFixed(0))
                x_downscaled.push(number)
            }
            curve.x = x_downscaled

            // downscaling y
            let y_downscaled = []
            for(let number of curve.y){
                number = number / price_scale_y * 1e18
                number = Number(number.toFixed(0))
                y_downscaled.push(number)
            }
            curve.y = y_downscaled
        }
    }
}

async function updateBondingCurvesForPool(poolAddress){
    let data = buildDataForApiRequest(poolAddress)
    let bondingCurveData = await getBondingCurveData(data,poolAddress)
    divideBy1e18(bondingCurveData)
    scaleDown(bondingCurveData,poolAddress)
    save(poolAddress,bondingCurveData)
    return bondingCurveData
}

/* 
    return for fetchBondingCurves("0xA5407eAE9Ba41422680e2e00537571bcC53efBfD"):
{
  curves: [
    { coin0: 'DAI' , coin1: 'USDC', x: [Array], y: [Array] },
    { coin0: 'DAI' , coin1: 'USDT', x: [Array], y: [Array] },
    { coin0: 'DAI' , coin1: 'sUSD', x: [Array], y: [Array] },
    { coin0: 'USDC', coin1: 'USDT', x: [Array], y: [Array] },
    { coin0: 'USDC', coin1: 'sUSD', x: [Array], y: [Array] },
    { coin0: 'USDT', coin1: 'sUSD', x: [Array], y: [Array] }
  ]
}
*/

function getBalances(poolAddress,name0,name1){
    let curveJSON = JSON.parse(fs.readFileSync("CurvePoolData.json"))
    let poolDetails = curveJSON[poolAddress]
    let coinNames = poolDetails.coin_names

    let name0Index = coinNames.indexOf(name0)
    let name1Index = coinNames.indexOf(name1)

    let balancesJSON = JSON.parse(fs.readFileSync("balances.json"))
    let poolBalances = balancesJSON[poolAddress]
    let lastEntry = poolBalances[poolBalances.length - 1]
    lastEntry = Object.values(lastEntry)[0]

    let finalBalanes = [
        lastEntry[name0Index],
        lastEntry[name1Index]
    ]

    return finalBalanes
}

function getBondingCurveForPoolAndCombination(poolAddress,combination){
    let bondingCurveJSON = loadData()
    let bondingCurves = bondingCurveJSON[poolAddress]

    //>> requires more data from the bonding curve api
    //let bondingCurve = bondingCurves.curves.find(entry => entry.coin0 === combination[0] && entry.coin1 === combination[1])

    // temp. solution, sUSD/USDC = USDC/sUSD
    let bondingCurve = bondingCurves.curves.find(entry => 
        (entry.coin0 === combination[0] && entry.coin1 === combination[1]) || 
        (entry.coin0 === combination[1] && entry.coin1 === combination[0])
    )

    // adding specific balances to print the dot
    let balances = getBalances(poolAddress,bondingCurve.coin0,bondingCurve.coin1)
    bondingCurve["balance0"] = balances[0]
    bondingCurve["balance1"] = balances[1]

    return bondingCurve
}

module.exports = {
	updateBondingCurvesForPool,
    getBondingCurveForPoolAndCombination
}