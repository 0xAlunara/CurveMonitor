const fs = require("fs")

// using search.json to find matching entries for the users input
// returns an array of pools together with their names, sorted by coin balances
function findPoolAddress(userInput,searchJSON) {
    var matchingPools = []
    Object.keys(searchJSON).forEach(function(address) {
        var pool = searchJSON[address]
        if (userInput.startsWith("0x")) {
            if (address.toLowerCase().startsWith(userInput) || pool.coins.some(function(coin) {
                return coin.toLowerCase().includes(userInput)
            })) {
                var coinIndex = pool.coins.findIndex(coin => coin.toLowerCase() === userInput)
                let balance = pool.balances[coinIndex]
                if (!balance) balance = 0
                matchingPools.push({[address]: {name: pool.name,balance: balance}})
            }
        } else {
            if (pool.name.toLowerCase().includes(userInput) || pool.coin_names.some(function(coin) {
                return coin.toLowerCase().includes(userInput)
            })) {
                var coinIndex = pool.coin_names.findIndex(coin => coin.toLowerCase().startsWith(userInput))
                let balance = pool.balances[coinIndex]
                if (!balance) balance = 0
                matchingPools.push({[address]: {name: pool.name,balance: balance}})
            }

            // removing empty pools in the suggest unless userInput matches the poolAddress
            const poolAddress = matchingPools.filter(item => Object.keys(item)[0].toLowerCase() == userInput)
            if (poolAddress.length == 0) {
                matchingPools = matchingPools.filter(item => {
                    const balance = Object.values(item)[0].balance
                    return balance !== 0 && balance >= 12
                })        
            } 
        }
    })
    return matchingPools.sort((a, b) => {
        return b[Object.keys(b)[0]].balance - a[Object.keys(a)[0]].balance
    })
}

// handles if user starts inputting a 2nd token-name
function search2ndName(userInput,searchJSON,res) {
    let final_res = []
    for (let i = 0; i < res.length; i++) {
      for (const poolAddress in res[i]) {
        let coin_names = searchJSON[poolAddress].coin_names
        for(const coin_name of coin_names) {
            if (coin_name.toLowerCase().startsWith(userInput)){
                final_res.push(res[i]) 
            }
        }
      }
    }
    return final_res
}

// main
function search(userInput){
    if (userInput == "0x") return {}
    if (!userInput || userInput === "undefined") {
        return {}
    }
    if (typeof userInput == "number") userInput = userInput.toString()
    let searchJSON = JSON.parse(fs.readFileSync("search.json"))
    userInput = userInput.toLowerCase()

    let parts = userInput.split(/[\/ ]+/)

    let res = findPoolAddress(parts[0],searchJSON)

    // removing balances from the array
    res = res.map(item => {
        const key = Object.keys(item)[0]
        return { [key]: item[key].name }
    })

    // case: 2nd token name in input
    if (parts[1]){
        let final_res = search2ndName(parts[1],searchJSON,res)
        res = final_res
    }

    // formatting
    res = res.reduce((acc, item) => {
        const key = Object.keys(item)[0]
        acc[key] = item[key]
        return acc
    }, {})

    if (Object.entries(res).length > 10) {
        res = Object.fromEntries(Object.entries(res).slice(0, 10))
    }

    return res
}

module.exports = {
	findPoolAddress,
	search2ndName,
	search
}

