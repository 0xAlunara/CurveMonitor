const https = require("https");
const fs = require("fs");

function loadData() {
  try {
    return JSON.parse(fs.readFileSync("bonding_curve.json"));
  } catch (err) {
    const data = {};
    fs.writeFileSync("bonding_curve.json", JSON.stringify(data));
    return data;
  }
}

function save(poolAddress, bondingCurveData) {
  const BONDING_CURVE_JSON = loadData();
  BONDING_CURVE_JSON[poolAddress] = bondingCurveData;
  fs.writeFileSync("bonding_curve.json", JSON.stringify(BONDING_CURVE_JSON));
}

// normalizes all balances to 18 digits
function getNormalizedBalances(poolAddress) {
  // goes into balances.json, and finds the arr for the pool, then picks the last entry
  const BALANCES_JSON = JSON.parse(fs.readFileSync("balances.json"));
  let balances = BALANCES_JSON[poolAddress];
  balances = balances[balances.length - 1];
  balances = Object.values(balances)[0];

  for (let i = 0; i < balances.length; i++) {
    for (let j = 0; j < 18; j++) {
      balances[i] += "0";
    }
  }

  return balances;
}

// builds the data for the request to api-py.llama.airforce/curve/v1
function buildDataForApiRequest(poolAddress) {
  const CURVE_JSON = JSON.parse(fs.readFileSync("curve_pool_data.json"));

  const A = CURVE_JSON[poolAddress].pool_params[0];
  const GAMMA = CURVE_JSON[poolAddress].gamma;
  const XP = getNormalizedBalances(poolAddress);
  const COINS = CURVE_JSON[poolAddress].coin_names;
  const VERSION = CURVE_JSON[poolAddress].version;

  if (VERSION === "V2") {
    const PRICE_SCALE = CURVE_JSON[poolAddress].price_scale;
    for (let i = 0; i < PRICE_SCALE.length; i++) {
      XP[i + 1] = (XP[i + 1] * PRICE_SCALE[i]) / 1e18;
      XP[i + 1] = BigInt(XP[i + 1]).toString();
    }
  }

  const data = {
    A: A,
    gamma: GAMMA,
    xp: XP,
    coins: COINS,
    resolution: 1000,
    version: VERSION,
  };

  return data;
}

// posting the api-request
async function getBondingCurveData(data, poolAddress) {
  return new Promise((resolve, reject) => {
    let path;
    if (data.version === "V1") path = "/curve/v1/pools/curve/v1";
    if (data.version === "V2") path = "/curve/v1/pools/curve/v2";
    const OPTIONS = {
      hostname: "api-py.llama.airforce",
      path,
      method: "POST",
      headers: {
        accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
    };

    const req = https.request(OPTIONS, (res) => {
      if (res.statusCode === 500) {
        console.log("500", data);
        return;
      }

      const CHUNKS = [];

      res.on("data", function (chunk) {
        CHUNKS.push(chunk);
      });

      res.on("end", function () {
        const BODY = Buffer.concat(CHUNKS);
        resolve(JSON.parse(BODY.toString()));
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    if (data.version === "V1") req.write(`A=${data.A}&xp=${data.xp}&coins=${data.coins}&resolution=${data.resolution}`);
    if (data.version === "V2") req.write(`A=${data.A}&gamma=${data.gamma}&xp=${data.xp}&coins=${data.coins}&resolution=${data.resolution}`);

    req.end();
  });
}

// at the end, division by 1e18 to avoid the overzised numbers
function divideBy1e18(bondingCurveData) {
  for (const curve of bondingCurveData.curves) {
    curve.x = curve.x.map((x) => Number((x / 1e18).toFixed(0)));
    curve.y = curve.y.map((y) => Number((y / 1e18).toFixed(0)));
  }
}

function scaleDown(bondingCurveData, poolAddress) {
  const CURVES = bondingCurveData.curves;
  const CURVE_JSON = JSON.parse(fs.readFileSync("curve_pool_data.json"));
  const PRICE_SCALE = CURVE_JSON[poolAddress].price_scale;

  const VERSION = CURVE_JSON[poolAddress].version;
  if (VERSION !== "V2") return;

  // loops over the bonding-curves
  for (let i = 0; i < CURVES.length; i++) {
    const CURVE = CURVES[i];

    if (i <= 1) {
      const PRICE_SCALE_Y = PRICE_SCALE[i];

      // downscaling y
      const Y_DOWNSCALED = [];
      for (let number of CURVE.y) {
        number = (number / PRICE_SCALE_Y) * 1e18;
        number = Number(number.toFixed(0));
        Y_DOWNSCALED.push(number);
      }
      CURVE.y = Y_DOWNSCALED;
    }

    // case example: coins0: WBTC, coin1: WETH, needs downscaling on both
    if (i === 2) {
      const PRICE_SCALE_X = PRICE_SCALE[0];
      const PRICE_SCALE_Y = PRICE_SCALE[1];

      // downscaling x
      const X_DOWNSCALED = [];
      for (let number of CURVE.x) {
        number = (number / PRICE_SCALE_X) * 1e18;
        number = Number(number.toFixed(0));
        X_DOWNSCALED.push(number);
      }
      CURVE.x = X_DOWNSCALED;

      // downscaling y
      const Y_DOWNSCALED = [];
      for (let number of CURVE.y) {
        number = (number / PRICE_SCALE_Y) * 1e18;
        number = Number(number.toFixed(0));
        Y_DOWNSCALED.push(number);
      }
      CURVE.y = Y_DOWNSCALED;
    }
  }
}

async function updateBondingCurvesForPool(poolAddress) {
  const DATA = buildDataForApiRequest(poolAddress);
  const BONDING_CURVE_DATA = await getBondingCurveData(DATA, poolAddress);
  divideBy1e18(BONDING_CURVE_DATA);
  scaleDown(BONDING_CURVE_DATA, poolAddress);
  save(poolAddress, BONDING_CURVE_DATA);
  return BONDING_CURVE_DATA;
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

function getBalances(poolAddress, name0, name1) {
  const CURVE_JSON = JSON.parse(fs.readFileSync("curve_pool_data.json"));
  const POOL_DETAILS = CURVE_JSON[poolAddress];
  const COIN_NAMES = POOL_DETAILS.coin_names;

  const NAME_0_INDEX = COIN_NAMES.indexOf(name0);
  const NAME_1_INDEX = COIN_NAMES.indexOf(name1);

  const BALANCES_JSON = JSON.parse(fs.readFileSync("balances.json"));
  const POOL_BALANCES = BALANCES_JSON[poolAddress];
  let lastEntry = POOL_BALANCES[POOL_BALANCES.length - 1];
  lastEntry = Object.values(lastEntry)[0];

  const FINAL_BALANCES = [lastEntry[NAME_0_INDEX], lastEntry[NAME_1_INDEX]];

  return FINAL_BALANCES;
}

function getBondingCurveForPoolAndCombination(poolAddress, combination) {
  const BONDING_CURVE_JSON = loadData();
  const BONDING_CURVES = BONDING_CURVE_JSON[poolAddress];

  // >> requires more data from the bonding curve api
  // let bondingCurve = BONDING_CURVES.curves.find(entry => entry.coin0 === combination[0] && entry.coin1 === combination[1])

  // temp. solution, sUSD/USDC = USDC/sUSD
  const BONDING_CURVE = BONDING_CURVES.curves.find(
    (entry) => (entry.coin0 === combination[0] && entry.coin1 === combination[1]) || (entry.coin0 === combination[1] && entry.coin1 === combination[0])
  );

  // adding specific balances to print the dot
  const BALANCES = getBalances(poolAddress, BONDING_CURVE.coin0, BONDING_CURVE.coin1);
  BONDING_CURVE.balance0 = BALANCES[0];
  BONDING_CURVE.balance1 = BALANCES[1];

  return BONDING_CURVE;
}

module.exports = {
  updateBondingCurvesForPool,
  getBondingCurveForPoolAndCombination,
};
