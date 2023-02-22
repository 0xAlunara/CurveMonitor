import Web3 from "web3";

import { config } from "dotenv";
config();

import { getABI, getPoolVersion } from "./GenericUtils.mjs";

const options = {
  // Enable auto reconnection
  reconnect: {
    auto: true,
    delay: 89, // ms
    maxAttempts: 50,
    onTimeout: false,
  },
};

const web3HTTP = new Web3(new Web3.providers.HttpProvider(process.env.web3HTTP, options));

async function getContract(abi, address) {
  return new web3HTTP.eth.Contract(abi, address);
}

function setProvider(key) {
  return new Web3(new Web3.providers.WebsocketProvider(key, options));
}

async function delay() {
  await new Promise((resolve) => setTimeout(resolve, 280));
}

async function web3Call(CONTRACT, method, params, blockNumber = { block: "latest" }) {
  let shouldContinue = true;
  let retries = 0;
  while (shouldContinue && retries < 12) {
    try {
      const result = await CONTRACT.methods[method](...params).call(blockNumber);
      return result;
    } catch (error) {
      if (!isCupsErr(error)) {
        console.log(error.message, "| Contract:", CONTRACT._address, "| method:", method, "| params:", params, "| blockNumber:", blockNumber);
        shouldContinue = false;
      } else {
        await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * (400 - 200 + 1) + 200)));
      }
    }
    retries++;
    if (shouldContinue) {
      await delay();
    }
  }
}

async function getCurrentBlockNumber() {
  let shouldContinue = true;
  let retries = 0;
  let maxRetries = 12;
  let blockNumber = null;
  while (shouldContinue && retries < maxRetries && !blockNumber) {
    try {
      blockNumber = await web3HTTP.eth.getBlockNumber();
    } catch (error) {
      if (isCupsErr(error)) {
        await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * (400 - 200 + 1) + 200)));
      } else {
        console.log("Error in getCurrentBlockNumber", blockNumber, error);
        shouldContinue = false;
      }
    }
    retries++;
    if (!blockNumber && shouldContinue) {
      await delay();
    }
  }
  return blockNumber;
}

async function getBlock(blockNumber) {
  let shouldContinue = true;
  let retries = 0;
  let maxRetries = 12;
  let block = null;
  while (shouldContinue && retries < maxRetries && !block) {
    try {
      block = await web3HTTP.eth.getBlock(blockNumber);
    } catch (error) {
      if (isCupsErr(error)) {
        await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * (400 - 200 + 1) + 200)));
      } else {
        console.log("Error in getBlock", blockNumber, error);
        shouldContinue = false;
      }
    }
    retries++;
    if (!block && shouldContinue) {
      await delay();
    }
  }
  return block;
}

async function getBlockUnixtime(blockNumber) {
  return (await getBlock(blockNumber)).timestamp;
}

async function errHandler(error) {
  if (isCupsErr(error)) {
    await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * (400 - 200 + 1) + 200)));
  } else {
    console.log(error);
  }
}

function isCupsErr(err) {
  return err.message.includes("compute units per second capacity");
}

async function getTx(txHash) {
  let shouldContinue = true;
  let retries = 0;
  while (shouldContinue && retries < 12) {
    try {
      const tx = await web3HTTP.eth.getTransaction(txHash);
      if (tx) {
        return tx;
      }
    } catch (error) {
      if (!isCupsErr(error)) {
        console.log("err in getTx", txHash, error);
        shouldContinue = false;
      } else {
        await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * (400 - 200 + 1) + 200)));
      }
    }
    retries++;
    if (shouldContinue) {
      await delay();
    }
  }
}

async function getLpTokenTranferAmount(LPTokenAddress, blockNumber, shouldAmount) {
  const ARR = await getTokenTransfers(LPTokenAddress, blockNumber);

  // finding the closest Amount to VictimAmount
  let closest = ARR[0];
  let minDiff = Math.abs(ARR[0] - shouldAmount);
  for (let i = 1; i < ARR.length; i++) {
    const DIFF = Math.abs(ARR[i] - shouldAmount);
    if (DIFF < minDiff) {
      closest = ARR[i];
      minDiff = DIFF;
    }
  }

  return closest;
}

async function getTokenTransfers(tokenAddress, block) {
  console.log("tokenAddress, block", tokenAddress, block);
  let ABI_TRANSFER_EVENT = await getABI("ABI_TRANSFER_EVENT");
  let TransferAmounts = [];
  let shouldContinue = true;
  let retries = 0;

  while (shouldContinue && retries < 12) {
    try {
      let events = await (await getContract(ABI_TRANSFER_EVENT, tokenAddress)).getPastEvents("Transfer", { fromBlock: block, toBlock: block });
      for (const event of events) {
        let token_amounts = event.returnValues._value;
        TransferAmounts.push(Number(token_amounts));
      }
      shouldContinue = false;
    } catch (error) {
      if (isCupsErr(error)) {
        await errHandler(error);
      } else {
        console.log(error);
      }
    }
    retries++;
    await delay();
  }

  return TransferAmounts;
}

// used to calc mev effects
async function getDyUnderlying(poolAddress, blockNumber, i, j, dx) {
  const CONTRACT = await getContract(await getABI("ABI_GET_DY_UNDERLYING"), poolAddress);
  return await web3Call(CONTRACT, "get_dy_underlying", [i, j, dx], blockNumber);
}

// used to calc mev effects
async function getDy(poolAddress, blockNumber, i, j, dx) {
  let abi = await getABI("ABI_GET_DY1");
  if (getPoolVersion(poolAddress) === "V2") abi = await getABI("ABI_GET_DY2");
  return await web3Call(await getContract(abi, poolAddress), "get_dy", [i, j, dx], blockNumber);
}

// returns the mint amount for a pool at a given block and with given deposit amounts
async function calcTokenAmount(poolAddress, blockNumber, amounts) {
  const CONTRACT = await getContract(await getABI("ABI_CALC_TOKEN_AMOUNT"), poolAddress);
  const DEPOSIT = true;
  const TOKEN_AMOUNT = await web3Call(CONTRACT, "calc_token_amount", [amounts, DEPOSIT], blockNumber);
  return Number(TOKEN_AMOUNT);
}

// returns an array with occured "AddLiquidity" events for a given pool and a given blockNumber
async function getAddLiquidityAmounts(CONTRACT, block) {
  let AddLiquidityAmounts = [];
  let shouldContinue = true;
  let maxRetries = 12;
  let retries = 0;
  while (shouldContinue && retries < maxRetries) {
    await CONTRACT.getPastEvents("AddLiquidity", { fromBlock: block, toBlock: block }, async function (error, events) {
      if (error) {
        console.log("err at getAddLiquidityAmounts", error.message);
        await errHandler(error);
      } else {
        for (const EVENT of events) {
          const tokenAmounts = EVENT.returnValues.token_amounts;
          const validAmounts = tokenAmounts.map(Number).filter((x) => x > 0);
          AddLiquidityAmounts = AddLiquidityAmounts.concat(validAmounts);
          shouldContinue = false;
        }
      }
    });
    retries++;
    await delay();
  }
  return AddLiquidityAmounts;
}

// when there was an AddLiquidity-Event, we call this function
// it checks if there was a swap in the same pool in the same block
// if there wasn't any, we know for sure that it was a deposit
// if there are events, we compare txHashes. Matching txHases show it was actually just a swap
async function checkForTokenExchange(poolAddress, block, txHash) {
  let data = "empty";
  const ABI_TOKEN_EXCHANGE_0 = await getABI("ABI_TOKEN_EXCHANGE_0");
  const ABI_TOKEN_EXCHANGE_1 = await getABI("ABI_TOKEN_EXCHANGE_1");
  const ABIS = [ABI_TOKEN_EXCHANGE_0, ABI_TOKEN_EXCHANGE_1];

  for (const ABI of ABIS) {
    const CONTRACT = await getContract(ABI, poolAddress);
    let shouldContinue = true;
    let maxRetries = 12;
    let retries = 0;
    while (shouldContinue && retries < maxRetries) {
      const events = await CONTRACT.getPastEvents("TokenExchange", { fromBlock: block, toBlock: block });
      if (events.length !== 0) {
        data = events.find((event) => event.transactionHash === txHash);
        shouldContinue = false;
      } else {
        retries++;
        await delay();
      }
    }
  }
  return data;
}

async function checkForTokenExchangeUnderlying(poolAddress, block, txHash) {
  const CONTACT = await getContract(await getABI("ABI_TOKEN_EXCHANGE_UNDERLYING"), poolAddress);
  let data = "empty";
  let shouldContinue = true;
  let maxRetries = 12;
  let retryCount = 0;

  while (shouldContinue && retryCount < maxRetries) {
    try {
      const events = await CONTACT.getPastEvents("TokenExchangeUnderlying", { fromBlock: block, toBlock: block });
      if (events.length !== 0) {
        data = events.find((event) => event.transactionHash === txHash);
        shouldContinue = false;
      }
    } catch (error) {
      console.log("err at checkForTokenExchangeUnderlying", error.message);
      await errHandler(error);
    }

    if (shouldContinue) {
      await delay();
      retryCount++;
    }
  }

  return data;
}

export {
  setProvider,
  getContract,
  web3Call,
  getTx,
  getCurrentBlockNumber,
  getBlock,
  getBlockUnixtime,
  getLpTokenTranferAmount,
  getTokenTransfers,
  errHandler,
  isCupsErr,
  getDyUnderlying,
  getDy,
  calcTokenAmount,
  getAddLiquidityAmounts,
  checkForTokenExchange,
  checkForTokenExchangeUnderlying,
};
