const fs = require("fs");

// using search.json to find matching entries for the users input
// returns an array of pools together with their names, sorted by coin balances
function findPoolAddress(userInput, searchJSON) {
  let matchingPools = [];
  let coinIndex;
  Object.keys(searchJSON).forEach(function (address) {
    const POOL = searchJSON[address];
    if (userInput.startsWith("0x")) {
      if (
        address.toLowerCase().startsWith(userInput) ||
        POOL.coins.some(function (coin) {
          return coin.toLowerCase().includes(userInput);
        })
      ) {
        coinIndex = POOL.coins.findIndex((coin) => coin.toLowerCase() === userInput);
        let balance = POOL.balances[coinIndex];
        if (!balance) balance = 0;
        matchingPools.push({ [address]: { name: POOL.name, balance } });
      }
    } else {
      if (
        POOL.name.toLowerCase().includes(userInput) ||
        POOL.coin_names.some(function (coin) {
          return coin.toLowerCase().includes(userInput);
        })
      ) {
        coinIndex = POOL.coin_names.findIndex((coin) => coin.toLowerCase().startsWith(userInput));
        let balance = POOL.balances[coinIndex];
        if (!balance) balance = 0;
        matchingPools.push({ [address]: { name: POOL.name, balance } });
      }

      // removing empty pools in the suggest unless userInput matches the poolAddress
      const POOL_ADDRESS = matchingPools.filter((item) => Object.keys(item)[0].toLowerCase() === userInput);
      if (POOL_ADDRESS.length === 0) {
        matchingPools = matchingPools.filter((item) => {
          const BALANCE = Object.values(item)[0].balance;
          return BALANCE !== 0 && BALANCE >= 12;
        });
      }
    }
  });
  return matchingPools.sort((a, b) => {
    return b[Object.keys(b)[0]].balance - a[Object.keys(a)[0]].balance;
  });
}

// handles if user starts inputting a 2nd token-name
function search2ndName(userInput, searchJSON, res) {
  const FINAL_RES = [];
  for (let i = 0; i < res.length; i++) {
    for (const POOL_ADDRESS in res[i]) {
      const COIN_NAMES = searchJSON[POOL_ADDRESS].coin_names;
      for (const COIN_NAME of COIN_NAMES) {
        if (COIN_NAME.toLowerCase().startsWith(userInput)) {
          FINAL_RES.push(res[i]);
        }
      }
    }
  }
  return FINAL_RES;
}

// main
function search(userInput) {
  if (userInput === "0x") return {};
  if (!userInput || userInput === "undefined") {
    return {};
  }
  if (typeof userInput === "number") userInput = userInput.toString();
  const SEARCH_JSON = JSON.parse(fs.readFileSync("search.json"));
  userInput = userInput.toLowerCase();

  const PARTS = userInput.split(/[ ]+/);

  let res = findPoolAddress(PARTS[0], SEARCH_JSON);

  // removing balances from the array
  res = res.map((item) => {
    const KEY = Object.keys(item)[0];
    return { [KEY]: item[KEY].name };
  });

  // case: 2nd token name in input
  if (PARTS[1]) {
    const FINAL_RES = search2ndName(PARTS[1], SEARCH_JSON, res);
    res = FINAL_RES;
  }

  // formatting
  res = res.reduce((acc, item) => {
    const KEY = Object.keys(item)[0];
    acc[KEY] = item[KEY];
    return acc;
  }, {});

  if (Object.entries(res).length > 10) {
    res = Object.fromEntries(Object.entries(res).slice(0, 10));
  }

  return res;
}

module.exports = {
  findPoolAddress,
  search2ndName,
  search,
};
