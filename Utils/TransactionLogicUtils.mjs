import {
  getABI,
  isNativeEthAddress,
  isCurveRegistryExchange,
  formatForPrint,
  getTokenAddress,
  findCoinId,
  getLpToken,
  getBasePool,
  getTokenName,
  getCleanedTokenAmount,
} from "./GenericUtils.mjs";

import { web3Call, getContract, getLpTokenTranferAmount, getTokenTransfers, getDyUnderlying, getDy, calcTokenAmount } from "./Web3CallUtils.mjs";

const ADDRESS_THREEPOOL = "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7";
const ADDRESS_DAI = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
const ADDRESS_USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const ADDRESS_USDT = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
const ADDRESS_renBTC = "0xEB4C2781e4ebA804CE9a9803C67d0893436bB27D";
const ADDRESS_WBTC = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599";
const ADDRESS_sBTC = "0xfE18be6b3Bd88A2D2A7f928d00292E7a9963CfC6";
const ADDRESS_FRAX = "0x853d955aCEf822Db058eb8505911ED77F175b99e";
const ADDRESS_NULL = "0x0000000000000000000000000000000000000000";

// to find the deposit amount, erc20 transfers are checked, and the closest amount to the prediction gets selected
function getClosestTransferAmount(ARR, prediction) {
  return ARR.reduce((prev, curr) => (Math.abs(curr - prediction) < Math.abs(prev - prediction) ? curr : prev));
}

async function tokenExchangeCaseMultiple(BLOCK_NUMBER, DECODED_TX) {
  let soldAddress = DECODED_TX.params[0].value[0];
  let soldAmount = DECODED_TX.params[2].value;

  soldAmount = await getCleanedTokenAmount(soldAddress, soldAmount);
  let tokenSoldName = await getTokenName(soldAddress);

  const NUMBER_OF_NULL_ADDRESSES = DECODED_TX.params[0].value.filter((x) => x === ADDRESS_NULL).length;
  let boughtAddress = DECODED_TX.params[0].value[DECODED_TX.params[0].value.length - NUMBER_OF_NULL_ADDRESSES - 1];

  const EXPECTED = DECODED_TX.params[3].value;
  let closestTransfer;

  if (!isNativeEthAddress(boughtAddress)) {
    const TOKEN_TRASFERS = await getTokenTransfers(boughtAddress, BLOCK_NUMBER);
    closestTransfer = getClosestTransferAmount(TOKEN_TRASFERS, EXPECTED);
  } else {
    closestTransfer = DECODED_TX.params[3].value;
  }

  let boughtAmount = await getCleanedTokenAmount(boughtAddress, closestTransfer);
  let tokenBoughtName = await getTokenName(boughtAddress);

  return [soldAmount, boughtAmount, tokenSoldName, soldAddress, tokenBoughtName, boughtAddress];
}

async function tokenExchangeCase3Pool(BLOCK_NUMBER, TX, TO, SOLD_ID, TOKENS_SOLD, BOUGHT_ID, TOKENS_BOUGHT, poolAddress) {
  let soldAddress;
  let soldAmount;
  let tokenSoldName;

  let boughtAddress;
  let boughtAmount;
  let tokenBoughtName;

  const THREEPOOL = await getContract(await getABI("ABI_THREEPOOL"), ADDRESS_THREEPOOL);
  const ADDED_LIQUIDITY_AMOUNTS = await getAddLiquidityAmounts(THREEPOOL, BLOCK_NUMBER);

  if (SOLD_ID === 0) {
    soldAddress = await getTokenAddress(poolAddress, 0);
    soldAmount = TOKENS_SOLD;
    soldAmount = await getCleanedTokenAmount(soldAddress, soldAmount);
    tokenSoldName = await getTokenName(soldAddress);
  } else if (SOLD_ID === 1) {
    soldAddress = ADDRESS_DAI;
    if (isCurveRegistryExchange(TO) || TO === poolAddress) {
      soldAmount = ABI_DECODER.decodeMethod(TX.input).params[2].value / 10 ** 18;
    } else {
      const CLOSEST_DEPOSIT = getClosestTransferAmount(ADDED_LIQUIDITY_AMOUNTS, TOKENS_SOLD);
      soldAmount = CLOSEST_DEPOSIT / 10 ** 18;
    }
    tokenSoldName = "DAI";
  } else if (SOLD_ID === 2) {
    soldAddress = ADDRESS_USDC;
    if (isCurveRegistryExchange(TO) || TO === poolAddress) {
      soldAmount = ABI_DECODER.decodeMethod(TX.input).params[2].value / 10 ** 6;
    } else {
      // example case at block 16139972 (TokenExchangeUnderlying)
      const CLOSEST_DEPOSIT = getClosestTransferAmount(ADDED_LIQUIDITY_AMOUNTS, TOKENS_SOLD / 1e12);
      soldAmount = CLOSEST_DEPOSIT / 10 ** 6;
    }
    tokenSoldName = "USDC";
  } else if (SOLD_ID === 3) {
    soldAddress = ADDRESS_USDT;
    if (isCurveRegistryExchange(TO) || TO === poolAddress) {
      soldAmount = ABI_DECODER.decodeMethod(TX.input).params[2].value / 10 ** 6;
    } else {
      const CLOSEST_DEPOSIT = getClosestTransferAmount(ADDED_LIQUIDITY_AMOUNTS, TOKENS_SOLD / 1e12);
      soldAmount = CLOSEST_DEPOSIT / 10 ** 6;
    }
    tokenSoldName = "USDT";
  }

  if (BOUGHT_ID === 1) {
    boughtAddress = ADDRESS_DAI;
    boughtAmount = TOKENS_BOUGHT / 10 ** 18;
    tokenBoughtName = "DAI";
  } else if (BOUGHT_ID === 2) {
    boughtAddress = ADDRESS_USDC;
    boughtAmount = TOKENS_BOUGHT / 10 ** 6;
    tokenBoughtName = "USDC";
  } else if (BOUGHT_ID === 3) {
    boughtAddress = ADDRESS_USDT;
    boughtAmount = TOKENS_BOUGHT / 10 ** 6;
    tokenBoughtName = "USDT";
  }

  return [soldAmount, boughtAmount, tokenSoldName, soldAddress, tokenBoughtName, boughtAddress];
}

async function tokenExchangeCase3BtcMetapool(BLOCK_NUMBER, SOLD_ID, TOKENS_SOLD, BOUGHT_ID, TOKENS_BOUGHT, poolAddress) {
  let soldAddress;
  let soldAmount;
  let tokenSoldName;

  let boughtAddress;
  let boughtAmount;
  let tokenBoughtName;

  const BTC_SWAP = await getContract(await getABI("ABI_sBTC_Swap"), "0x7fC77b5c7614E1533320Ea6DDc2Eb61fa00A9714");
  const ADDED_LIQUIDITY_AMOUNTS = await getAddLiquidityAmounts(BTC_SWAP, BLOCK_NUMBER);

  if (SOLD_ID === 1) {
    tokenSoldName = "renBTC";
    soldAddress = ADDRESS_renBTC;
    const CLOSEST_DEPOSIT = getClosestTransferAmount(ADDED_LIQUIDITY_AMOUNTS, TOKENS_SOLD / 1e10);
    soldAmount = CLOSEST_DEPOSIT / 10 ** 8;
  } else if (SOLD_ID === 2) {
    tokenSoldName = "WBTC";
    soldAddress = ADDRESS_WBTC;
    const CLOSEST_DEPOSIT = getClosestTransferAmount(ADDED_LIQUIDITY_AMOUNTS, TOKENS_SOLD / 1e10);
    soldAmount = CLOSEST_DEPOSIT / 10 ** 8;
  } else if (SOLD_ID === 3) {
    tokenSoldName = "sBTC";
    soldAddress = ADDRESS_sBTC;
    const CLOSEST_DEPOSIT = getClosestTransferAmount(ADDED_LIQUIDITY_AMOUNTS, TOKENS_SOLD);
    soldAmount = CLOSEST_DEPOSIT / 10 ** 18;
  }

  if (BOUGHT_ID === 0) {
    boughtAddress = await getTokenAddress(poolAddress, 0);
    boughtAmount = await getCleanedTokenAmount(boughtAddress, TOKENS_BOUGHT);
    tokenBoughtName = await getTokenName(boughtAddress);
  } else if (BOUGHT_ID === 1) {
    tokenBoughtName = "renBTC";
    boughtAmount = TOKENS_BOUGHT / 10 ** 8;
    boughtAddress = ADDRESS_renBTC;
  } else if (BOUGHT_ID === 2) {
    tokenBoughtName = "WBTC";
    boughtAmount = TOKENS_BOUGHT / 10 ** 8;
    boughtAddress = ADDRESS_WBTC;
  } else if (BOUGHT_ID === 3) {
    tokenBoughtName = "sBTC";
    boughtAmount = TOKENS_BOUGHT / 10 ** 18;
    boughtAddress = ADDRESS_sBTC;
  }

  return [soldAmount, boughtAmount, tokenSoldName, soldAddress, tokenBoughtName, boughtAddress];
}

async function tokenExchangeCaseFraxbp(BLOCK_NUMBER, SOLD_ID, TOKENS_SOLD, BOUGHT_ID, TOKENS_BOUGHT, poolAddress) {
  let soldAddress;
  let soldAmount;
  let tokenSoldName;

  let boughtAddress;
  let boughtAmount;
  let tokenBoughtName;

  const FRAXBP = await getContract(await getABI("ABI_FRAXBP"), "0xDcEF968d416a41Cdac0ED8702fAC8128A64241A2");
  const ADDED_LIQUIDITY_AMOUNTS = await getAddLiquidityAmounts(FRAXBP, BLOCK_NUMBER);

  if (SOLD_ID === 1) {
    tokenSoldName = "FRAX";
    soldAddress = ADDRESS_FRAX;
    if (isCurveRegistryExchange(TO) || TO === poolAddress) {
      soldAmount = ABI_DECODER.decodeMethod(TX.input).params[2].value / 10 ** 18;
    } else {
      const CLOSEST_DEPOSIT = getClosestTransferAmount(ADDED_LIQUIDITY_AMOUNTS, TOKENS_SOLD);
      soldAmount = CLOSEST_DEPOSIT / 10 ** 18;
    }
  }
  if (SOLD_ID === 2) {
    tokenSoldName = "USDC";
    soldAddress = ADDRESS_USDC;
    if (isCurveRegistryExchange(TO) || TO === poolAddress) {
      // var soldAmount = ((ABI_DECODER.decodeMethod(TX.input)).params[2].value)/10**6
    } else {
      const CLOSEST_DEPOSIT = getClosestTransferAmount(ADDED_LIQUIDITY_AMOUNTS, TOKENS_SOLD);
      soldAmount = CLOSEST_DEPOSIT / 10 ** 6;
    }
  }

  if (BOUGHT_ID === 1) {
    boughtAddress = ADDRESS_FRAX;
    boughtAmount = TOKENS_BOUGHT / 10 ** 18;
    tokenBoughtName = "FRAX";
  }
  if (BOUGHT_ID === 2) {
    boughtAddress = ADDRESS_USDC;
    boughtAmount = TOKENS_BOUGHT / 10 ** 6;
    tokenBoughtName = "USDC";
  }

  return [soldAmount, boughtAmount, tokenSoldName, soldAddress, tokenBoughtName, boughtAddress];
}

async function tokenExchangeCaseSingle(SOLD_ID, TOKENS_SOLD, BOUGHT_ID, TOKENS_BOUGHT, poolAddress) {
  let soldAddress = await getTokenAddress(poolAddress, SOLD_ID);
  let soldAmount = await getCleanedTokenAmount(soldAddress, TOKENS_SOLD);
  let tokenSoldName = await getTokenName(soldAddress);

  let boughtAddress = await getTokenAddress(poolAddress, BOUGHT_ID);
  let boughtAmount = await getCleanedTokenAmount(boughtAddress, TOKENS_BOUGHT);
  let tokenBoughtName = await getTokenName(boughtAddress);

  return [soldAmount, boughtAmount, tokenSoldName, soldAddress, tokenBoughtName, boughtAddress];
}

async function victimTxCaseExchangeUnderlying(victimData) {
  let paramsDecodedTx;
  let addressPath;
  if (victimData.data.hacked_data) {
    paramsDecodedTx = victimData.data.hacked_data[0];
    addressPath = paramsDecodedTx.value;
  }

  const SOLD_ID = victimData.data.returnValues.sold_id;
  const BOUGHT_ID = victimData.data.returnValues.bought_id;

  let i;
  let j;
  const BOUGHT_ADDRESS = victimData.extraData.boughtAddress;

  if (SOLD_ID === 0) {
    i = 0;

    addressPath = addressPath.filter(function (s) {
      return s !== ADDRESS_NULL;
    });
    const BASEPOOL_ADDRESS = addressPath[addressPath.length - 2]; // eg ADDRESS_THREEPOOL
    const COIN_OUT_ID_WITHIN_METAPOOL = await findCoinId(BASEPOOL_ADDRESS, BOUGHT_ADDRESS);

    j = COIN_OUT_ID_WITHIN_METAPOOL + 1;
  } else if (BOUGHT_ID === 0) {
    j = 0;

    addressPath = addressPath.filter(function (s) {
      return s !== ADDRESS_NULL;
    });
    const BASEPOOL_ADDRESS = addressPath[1]; // eg ADDRESS_THREEPOOL
    const COIN_OUT_ID_WITHIN_METAPOOL = await findCoinId(BASEPOOL_ADDRESS, BOUGHT_ADDRESS);

    i = COIN_OUT_ID_WITHIN_METAPOOL + 1;
  } else {
    // console.log("something weird here")
    i = SOLD_ID;
    j = BOUGHT_ID;
  }
  const dx = victimData.data.returnValues.tokens_sold;

  const POOL_ADDRESS = victimData.data.address;
  const BLOCK_NUMBER = victimData.blockNumber - 1; // going back in time 1 block
  const DY_UNDERLYING = await getDyUnderlying(POOL_ADDRESS, BLOCK_NUMBER, i, j, dx);
  peacefulAmountOut = await getCleanedTokenAmount(BOUGHT_ADDRESS, DY_UNDERLYING);
  return peacefulAmountOut;
}

async function victimTxCaseTokenExchangeUnderlying(victimData) {
  let basePoolAddress = await getBasePool(victimData.data.address);
  if (basePoolAddress === ADDRESS_NULL) return await victimTxCaseSwap(victimData);
  const BOUGHT_ADDRESS = victimData.extraData.boughtAddress;
  const SOLD_ID = victimData.data.returnValues.sold_id;
  const BOUGHT_ID = victimData.data.returnValues.bought_id;

  let i;
  let j;

  if (SOLD_ID === 0) {
    i = 0;
    const COIN_OUT_ID_WITHIN_METAPOOL = await findCoinId(basePoolAddress, BOUGHT_ADDRESS);
    j = COIN_OUT_ID_WITHIN_METAPOOL + 1;
  } else if (BOUGHT_ID === 0) {
    j = 0;
    const COIN_OUT_ID_WITHIN_METAPOOL = await findCoinId(basePoolAddress, BOUGHT_ADDRESS);
    i = COIN_OUT_ID_WITHIN_METAPOOL + 1;
  }

  const DX = victimData.data.returnValues.tokens_sold;

  const DY_UNDERLYING = await getDyUnderlying(victimData.data.address, victimData.blockNumber - 1, i, j, DX);
  peacefulAmountOut = await getCleanedTokenAmount(BOUGHT_ADDRESS, DY_UNDERLYING);
  return peacefulAmountOut;
}

async function victimTxCaseDeposit(victimData) {
  const AMOUNTS = victimData.data.returnValues.token_amounts;
  let peacefulAmountOut = await calcTokenAmount(victimData.data.address, victimData.blockNumber - 1, AMOUNTS);

  const LP_TOKEN_ADDRESS = await getLpToken(victimData.data.address);
  const AMOUNTS_MINTED_BY_DEPOSIT = await getLpTokenTranferAmount(LP_TOKEN_ADDRESS, victimData.blockNumber, peacefulAmountOut);

  let deltaVictim = formatForPrint((AMOUNTS_MINTED_BY_DEPOSIT - peacefulAmountOut) / 1e18);
  let name = "LP-Token";
  return [deltaVictim, name];
}

async function victimTxCaseRemoval(victimData) {
  const AMOUNTS = victimData.data.returnValues.token_amounts;

  const ABI = await getABI(victimData.data.address);
  let peacefulAmountOut = await web3Call(await getContract(ABI, victimData.data.address), "calc_token_amount", [AMOUNTS, false], victimData.blockNumber);
  peacefulAmountOut = Number(peacefulAmountOut);

  const LP_TOKEN_ADDRESS = await getLpToken(victimData.data.address);
  const LP_NEEDED_REALITY = await getLpTokenTranferAmount(LP_TOKEN_ADDRESS, victimData.blockNumber, peacefulAmountOut);
  let deltaVictim = formatForPrint((peacefulAmountOut - LP_NEEDED_REALITY) / 1e18);
  let name = "LP-Token";
  return [deltaVictim, name];
}

async function victimTxCaseSwap(victimData) {
  const POOL_ADDRESS = victimData.extraData.poolAddress;
  const RETURN_VALUES = victimData.data.returnValues;
  const I = RETURN_VALUES.sold_id;
  const J = RETURN_VALUES.bought_id;
  const DX = RETURN_VALUES.tokens_sold;
  const DY = await getDy(POOL_ADDRESS, victimData.blockNumber - 1, I, J, DX);
  const ADDRESS = victimData.extraData.boughtAddress;
  peacefulAmountOut = await getCleanedTokenAmount(ADDRESS, DY);
  return peacefulAmountOut;
}

function getDeltaMevBot(mevTxBuffer, outID) {
  const AMOUNT_IN = mevTxBuffer[0].extraData.soldAmount;
  const AMOUNT_OUT = mevTxBuffer[outID].extraData.boughtAmount;
  const DELTA_MEV_BOT = formatForPrint(AMOUNT_OUT - AMOUNT_IN);
  return DELTA_MEV_BOT;
}

export {
  tokenExchangeCaseMultiple,
  tokenExchangeCase3Pool,
  tokenExchangeCase3BtcMetapool,
  tokenExchangeCaseFraxbp,
  tokenExchangeCaseSingle,
  victimTxCaseExchangeUnderlying,
  victimTxCaseTokenExchangeUnderlying,
  victimTxCaseDeposit,
  victimTxCaseRemoval,
  victimTxCaseSwap,
  getDeltaMevBot,
};
