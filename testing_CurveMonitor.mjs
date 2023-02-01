import { createRequire } from "module"
var require = createRequire(import.meta.url)

const fs = require("fs")
const https = require("https")
const Web3 = require("web3")

import { Server } from "socket.io"

const db = require("dirty")
const DB = new db("ABIs_curveMonitor")

let tempTxHashStorage = []

const apiKeys = require('./api_keys')

const utils = require("./utils.js")
const getABI = utils.getABI
const saveTxEntry = utils.saveTxEntry
const findLastProcessedEvent = utils.findLastProcessedEvent
const collection = utils.collection
const getCurvePools = utils.getCurvePools
const getTokenBalancesInsidePool = utils.getTokenBalancesInsidePool
const getTokenName = utils.getTokenName

// utils for price-data
const price_utils = require("./price_utils.js")
const priceCollectionMain = price_utils.priceCollectionMain
const savePriceEntry = price_utils.savePriceEntry
const readPriceArray = price_utils.readPriceArray

// utils for pool-balances
const balances_utils = require("./balances_utils.js")
const fetchBalanceOnce = balances_utils.fetchBalanceOnce
const bootBalancesJSON = balances_utils.bootBalancesJSON
const balancesCollectionMain = balances_utils.balancesCollectionMain
const readBalancesArray = balances_utils.readBalancesArray

// for the search bar on the landing page
const search_utils = require("./search_utils.js")
const search = search_utils.search

const abiDecoder = require("abi-decoder")
let ABI_Registry_Exchange = [{"name":"TokenExchange","inputs":[{"name":"buyer","type":"address","indexed":true},{"name":"receiver","type":"address","indexed":true},{"name":"pool","type":"address","indexed":true},{"name":"token_sold","type":"address","indexed":false},{"name":"token_bought","type":"address","indexed":false},{"name":"amount_sold","type":"uint256","indexed":false},{"name":"amount_bought","type":"uint256","indexed":false}],"anonymous":false,"type":"event"},{"stateMutability":"nonpayable","type":"constructor","inputs":[{"name":"_address_provider","type":"address"},{"name":"_calculator","type":"address"}],"outputs":[]},{"stateMutability":"payable","type":"fallback"},{"stateMutability":"payable","type":"function","name":"exchange_with_best_rate","inputs":[{"name":"_from","type":"address"},{"name":"_to","type":"address"},{"name":"_amount","type":"uint256"},{"name":"_expected","type":"uint256"}],"outputs":[{"name":"","type":"uint256"}],"gas":1019563733},{"stateMutability":"payable","type":"function","name":"exchange_with_best_rate","inputs":[{"name":"_from","type":"address"},{"name":"_to","type":"address"},{"name":"_amount","type":"uint256"},{"name":"_expected","type":"uint256"},{"name":"_receiver","type":"address"}],"outputs":[{"name":"","type":"uint256"}],"gas":1019563733},{"stateMutability":"payable","type":"function","name":"exchange","inputs":[{"name":"_pool","type":"address"},{"name":"_from","type":"address"},{"name":"_to","type":"address"},{"name":"_amount","type":"uint256"},{"name":"_expected","type":"uint256"}],"outputs":[{"name":"","type":"uint256"}],"gas":427142},{"stateMutability":"payable","type":"function","name":"exchange","inputs":[{"name":"_pool","type":"address"},{"name":"_from","type":"address"},{"name":"_to","type":"address"},{"name":"_amount","type":"uint256"},{"name":"_expected","type":"uint256"},{"name":"_receiver","type":"address"}],"outputs":[{"name":"","type":"uint256"}],"gas":427142},{"stateMutability":"payable","type":"function","name":"exchange_multiple","inputs":[{"name":"_route","type":"address[9]"},{"name":"_swap_params","type":"uint256[3][4]"},{"name":"_amount","type":"uint256"},{"name":"_expected","type":"uint256"}],"outputs":[{"name":"","type":"uint256"}],"gas":313422},{"stateMutability":"payable","type":"function","name":"exchange_multiple","inputs":[{"name":"_route","type":"address[9]"},{"name":"_swap_params","type":"uint256[3][4]"},{"name":"_amount","type":"uint256"},{"name":"_expected","type":"uint256"},{"name":"_pools","type":"address[4]"}],"outputs":[{"name":"","type":"uint256"}],"gas":313422},{"stateMutability":"payable","type":"function","name":"exchange_multiple","inputs":[{"name":"_route","type":"address[9]"},{"name":"_swap_params","type":"uint256[3][4]"},{"name":"_amount","type":"uint256"},{"name":"_expected","type":"uint256"},{"name":"_pools","type":"address[4]"},{"name":"_receiver","type":"address"}],"outputs":[{"name":"","type":"uint256"}],"gas":313422},{"stateMutability":"view","type":"function","name":"get_best_rate","inputs":[{"name":"_from","type":"address"},{"name":"_to","type":"address"},{"name":"_amount","type":"uint256"}],"outputs":[{"name":"","type":"address"},{"name":"","type":"uint256"}],"gas":3002213116},{"stateMutability":"view","type":"function","name":"get_best_rate","inputs":[{"name":"_from","type":"address"},{"name":"_to","type":"address"},{"name":"_amount","type":"uint256"},{"name":"_exclude_pools","type":"address[8]"}],"outputs":[{"name":"","type":"address"},{"name":"","type":"uint256"}],"gas":3002213116},{"stateMutability":"view","type":"function","name":"get_exchange_amount","inputs":[{"name":"_pool","type":"address"},{"name":"_from","type":"address"},{"name":"_to","type":"address"},{"name":"_amount","type":"uint256"}],"outputs":[{"name":"","type":"uint256"}],"gas":30596},{"stateMutability":"view","type":"function","name":"get_input_amount","inputs":[{"name":"_pool","type":"address"},{"name":"_from","type":"address"},{"name":"_to","type":"address"},{"name":"_amount","type":"uint256"}],"outputs":[{"name":"","type":"uint256"}],"gas":34701},{"stateMutability":"view","type":"function","name":"get_exchange_amounts","inputs":[{"name":"_pool","type":"address"},{"name":"_from","type":"address"},{"name":"_to","type":"address"},{"name":"_amounts","type":"uint256[100]"}],"outputs":[{"name":"","type":"uint256[100]"}],"gas":38286},{"stateMutability":"view","type":"function","name":"get_exchange_multiple_amount","inputs":[{"name":"_route","type":"address[9]"},{"name":"_swap_params","type":"uint256[3][4]"},{"name":"_amount","type":"uint256"}],"outputs":[{"name":"","type":"uint256"}],"gas":21334},{"stateMutability":"view","type":"function","name":"get_exchange_multiple_amount","inputs":[{"name":"_route","type":"address[9]"},{"name":"_swap_params","type":"uint256[3][4]"},{"name":"_amount","type":"uint256"},{"name":"_pools","type":"address[4]"}],"outputs":[{"name":"","type":"uint256"}],"gas":21334},{"stateMutability":"view","type":"function","name":"get_calculator","inputs":[{"name":"_pool","type":"address"}],"outputs":[{"name":"","type":"address"}],"gas":5215},{"stateMutability":"nonpayable","type":"function","name":"update_registry_address","inputs":[],"outputs":[{"name":"","type":"bool"}],"gas":115368},{"stateMutability":"nonpayable","type":"function","name":"set_calculator","inputs":[{"name":"_pool","type":"address"},{"name":"_calculator","type":"address"}],"outputs":[{"name":"","type":"bool"}],"gas":40695},{"stateMutability":"nonpayable","type":"function","name":"set_default_calculator","inputs":[{"name":"_calculator","type":"address"}],"outputs":[{"name":"","type":"bool"}],"gas":40459},{"stateMutability":"nonpayable","type":"function","name":"claim_balance","inputs":[{"name":"_token","type":"address"}],"outputs":[{"name":"","type":"bool"}],"gas":41823},{"stateMutability":"nonpayable","type":"function","name":"set_killed","inputs":[{"name":"_is_killed","type":"bool"}],"outputs":[{"name":"","type":"bool"}],"gas":40519},{"stateMutability":"view","type":"function","name":"registry","inputs":[],"outputs":[{"name":"","type":"address"}],"gas":2970},{"stateMutability":"view","type":"function","name":"factory_registry","inputs":[],"outputs":[{"name":"","type":"address"}],"gas":3000},{"stateMutability":"view","type":"function","name":"crypto_registry","inputs":[],"outputs":[{"name":"","type":"address"}],"gas":3030},{"stateMutability":"view","type":"function","name":"default_calculator","inputs":[],"outputs":[{"name":"","type":"address"}],"gas":3060},{"stateMutability":"view","type":"function","name":"is_killed","inputs":[],"outputs":[{"name":"","type":"bool"}],"gas":3090}]
abiDecoder.addABI(ABI_Registry_Exchange)
let ABI_Metapool = [{"name":"Transfer","inputs":[{"name":"sender","type":"address","indexed":true},{"name":"receiver","type":"address","indexed":true},{"name":"value","type":"uint256","indexed":false}],"anonymous":false,"type":"event"},{"name":"Approval","inputs":[{"name":"owner","type":"address","indexed":true},{"name":"spender","type":"address","indexed":true},{"name":"value","type":"uint256","indexed":false}],"anonymous":false,"type":"event"},{"name":"TokenExchange","inputs":[{"name":"buyer","type":"address","indexed":true},{"name":"sold_id","type":"int128","indexed":false},{"name":"tokens_sold","type":"uint256","indexed":false},{"name":"bought_id","type":"int128","indexed":false},{"name":"tokens_bought","type":"uint256","indexed":false}],"anonymous":false,"type":"event"},{"name":"TokenExchangeUnderlying","inputs":[{"name":"buyer","type":"address","indexed":true},{"name":"sold_id","type":"int128","indexed":false},{"name":"tokens_sold","type":"uint256","indexed":false},{"name":"bought_id","type":"int128","indexed":false},{"name":"tokens_bought","type":"uint256","indexed":false}],"anonymous":false,"type":"event"},{"name":"AddLiquidity","inputs":[{"name":"provider","type":"address","indexed":true},{"name":"token_amounts","type":"uint256[2]","indexed":false},{"name":"fees","type":"uint256[2]","indexed":false},{"name":"invariant","type":"uint256","indexed":false},{"name":"token_supply","type":"uint256","indexed":false}],"anonymous":false,"type":"event"},{"name":"RemoveLiquidity","inputs":[{"name":"provider","type":"address","indexed":true},{"name":"token_amounts","type":"uint256[2]","indexed":false},{"name":"fees","type":"uint256[2]","indexed":false},{"name":"token_supply","type":"uint256","indexed":false}],"anonymous":false,"type":"event"},{"name":"RemoveLiquidityOne","inputs":[{"name":"provider","type":"address","indexed":true},{"name":"token_amount","type":"uint256","indexed":false},{"name":"coin_amount","type":"uint256","indexed":false},{"name":"token_supply","type":"uint256","indexed":false}],"anonymous":false,"type":"event"},{"name":"RemoveLiquidityImbalance","inputs":[{"name":"provider","type":"address","indexed":true},{"name":"token_amounts","type":"uint256[2]","indexed":false},{"name":"fees","type":"uint256[2]","indexed":false},{"name":"invariant","type":"uint256","indexed":false},{"name":"token_supply","type":"uint256","indexed":false}],"anonymous":false,"type":"event"},{"name":"RampA","inputs":[{"name":"old_A","type":"uint256","indexed":false},{"name":"new_A","type":"uint256","indexed":false},{"name":"initial_time","type":"uint256","indexed":false},{"name":"future_time","type":"uint256","indexed":false}],"anonymous":false,"type":"event"},{"name":"StopRampA","inputs":[{"name":"A","type":"uint256","indexed":false},{"name":"t","type":"uint256","indexed":false}],"anonymous":false,"type":"event"},{"stateMutability":"nonpayable","type":"constructor","inputs":[],"outputs":[]},{"stateMutability":"nonpayable","type":"function","name":"initialize","inputs":[{"name":"_name","type":"string"},{"name":"_symbol","type":"string"},{"name":"_coin","type":"address"},{"name":"_rate_multiplier","type":"uint256"},{"name":"_A","type":"uint256"},{"name":"_fee","type":"uint256"}],"outputs":[],"gas":450772},{"stateMutability":"view","type":"function","name":"decimals","inputs":[],"outputs":[{"name":"","type":"uint256"}],"gas":318},{"stateMutability":"nonpayable","type":"function","name":"transfer","inputs":[{"name":"_to","type":"address"},{"name":"_value","type":"uint256"}],"outputs":[{"name":"","type":"bool"}],"gas":77977},{"stateMutability":"nonpayable","type":"function","name":"transferFrom","inputs":[{"name":"_from","type":"address"},{"name":"_to","type":"address"},{"name":"_value","type":"uint256"}],"outputs":[{"name":"","type":"bool"}],"gas":115912},{"stateMutability":"nonpayable","type":"function","name":"approve","inputs":[{"name":"_spender","type":"address"},{"name":"_value","type":"uint256"}],"outputs":[{"name":"","type":"bool"}],"gas":37851},{"stateMutability":"view","type":"function","name":"admin_fee","inputs":[],"outputs":[{"name":"","type":"uint256"}],"gas":438},{"stateMutability":"view","type":"function","name":"A","inputs":[],"outputs":[{"name":"","type":"uint256"}],"gas":10704},{"stateMutability":"view","type":"function","name":"A_precise","inputs":[],"outputs":[{"name":"","type":"uint256"}],"gas":10666},{"stateMutability":"view","type":"function","name":"get_virtual_price","inputs":[],"outputs":[{"name":"","type":"uint256"}],"gas":1023280},{"stateMutability":"view","type":"function","name":"calc_token_amount","inputs":[{"name":"_amounts","type":"uint256[2]"},{"name":"_is_deposit","type":"bool"}],"outputs":[{"name":"","type":"uint256"}],"gas":4029742},{"stateMutability":"nonpayable","type":"function","name":"add_liquidity","inputs":[{"name":"_amounts","type":"uint256[2]"},{"name":"_min_mint_amount","type":"uint256"}],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"nonpayable","type":"function","name":"add_liquidity","inputs":[{"name":"_amounts","type":"uint256[2]"},{"name":"_min_mint_amount","type":"uint256"},{"name":"_receiver","type":"address"}],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"view","type":"function","name":"get_dy","inputs":[{"name":"i","type":"int128"},{"name":"j","type":"int128"},{"name":"dx","type":"uint256"}],"outputs":[{"name":"","type":"uint256"}],"gas":2466478},{"stateMutability":"view","type":"function","name":"get_dy_underlying","inputs":[{"name":"i","type":"int128"},{"name":"j","type":"int128"},{"name":"dx","type":"uint256"}],"outputs":[{"name":"","type":"uint256"}],"gas":2475029},{"stateMutability":"nonpayable","type":"function","name":"exchange","inputs":[{"name":"i","type":"int128"},{"name":"j","type":"int128"},{"name":"_dx","type":"uint256"},{"name":"_min_dy","type":"uint256"}],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"nonpayable","type":"function","name":"exchange","inputs":[{"name":"i","type":"int128"},{"name":"j","type":"int128"},{"name":"_dx","type":"uint256"},{"name":"_min_dy","type":"uint256"},{"name":"_receiver","type":"address"}],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"nonpayable","type":"function","name":"exchange_underlying","inputs":[{"name":"i","type":"int128"},{"name":"j","type":"int128"},{"name":"_dx","type":"uint256"},{"name":"_min_dy","type":"uint256"}],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"nonpayable","type":"function","name":"exchange_underlying","inputs":[{"name":"i","type":"int128"},{"name":"j","type":"int128"},{"name":"_dx","type":"uint256"},{"name":"_min_dy","type":"uint256"},{"name":"_receiver","type":"address"}],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"nonpayable","type":"function","name":"remove_liquidity","inputs":[{"name":"_burn_amount","type":"uint256"},{"name":"_min_amounts","type":"uint256[2]"}],"outputs":[{"name":"","type":"uint256[2]"}]},{"stateMutability":"nonpayable","type":"function","name":"remove_liquidity","inputs":[{"name":"_burn_amount","type":"uint256"},{"name":"_min_amounts","type":"uint256[2]"},{"name":"_receiver","type":"address"}],"outputs":[{"name":"","type":"uint256[2]"}]},{"stateMutability":"nonpayable","type":"function","name":"remove_liquidity_imbalance","inputs":[{"name":"_amounts","type":"uint256[2]"},{"name":"_max_burn_amount","type":"uint256"}],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"nonpayable","type":"function","name":"remove_liquidity_imbalance","inputs":[{"name":"_amounts","type":"uint256[2]"},{"name":"_max_burn_amount","type":"uint256"},{"name":"_receiver","type":"address"}],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"view","type":"function","name":"calc_withdraw_one_coin","inputs":[{"name":"_burn_amount","type":"uint256"},{"name":"i","type":"int128"}],"outputs":[{"name":"","type":"uint256"}],"gas":1130},{"stateMutability":"nonpayable","type":"function","name":"remove_liquidity_one_coin","inputs":[{"name":"_burn_amount","type":"uint256"},{"name":"i","type":"int128"},{"name":"_min_received","type":"uint256"}],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"nonpayable","type":"function","name":"remove_liquidity_one_coin","inputs":[{"name":"_burn_amount","type":"uint256"},{"name":"i","type":"int128"},{"name":"_min_received","type":"uint256"},{"name":"_receiver","type":"address"}],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"nonpayable","type":"function","name":"ramp_A","inputs":[{"name":"_future_A","type":"uint256"},{"name":"_future_time","type":"uint256"}],"outputs":[],"gas":162101},{"stateMutability":"nonpayable","type":"function","name":"stop_ramp_A","inputs":[],"outputs":[],"gas":157565},{"stateMutability":"view","type":"function","name":"admin_balances","inputs":[{"name":"i","type":"uint256"}],"outputs":[{"name":"","type":"uint256"}],"gas":7770},{"stateMutability":"nonpayable","type":"function","name":"withdraw_admin_fees","inputs":[],"outputs":[],"gas":40657},{"stateMutability":"view","type":"function","name":"coins","inputs":[{"name":"arg0","type":"uint256"}],"outputs":[{"name":"","type":"address"}],"gas":3123},{"stateMutability":"view","type":"function","name":"balances","inputs":[{"name":"arg0","type":"uint256"}],"outputs":[{"name":"","type":"uint256"}],"gas":3153},{"stateMutability":"view","type":"function","name":"fee","inputs":[],"outputs":[{"name":"","type":"uint256"}],"gas":3138},{"stateMutability":"view","type":"function","name":"initial_A","inputs":[],"outputs":[{"name":"","type":"uint256"}],"gas":3168},{"stateMutability":"view","type":"function","name":"future_A","inputs":[],"outputs":[{"name":"","type":"uint256"}],"gas":3198},{"stateMutability":"view","type":"function","name":"initial_A_time","inputs":[],"outputs":[{"name":"","type":"uint256"}],"gas":3228},{"stateMutability":"view","type":"function","name":"future_A_time","inputs":[],"outputs":[{"name":"","type":"uint256"}],"gas":3258},{"stateMutability":"view","type":"function","name":"name","inputs":[],"outputs":[{"name":"","type":"string"}],"gas":13518},{"stateMutability":"view","type":"function","name":"symbol","inputs":[],"outputs":[{"name":"","type":"string"}],"gas":11271},{"stateMutability":"view","type":"function","name":"balanceOf","inputs":[{"name":"arg0","type":"address"}],"outputs":[{"name":"","type":"uint256"}],"gas":3563},{"stateMutability":"view","type":"function","name":"allowance","inputs":[{"name":"arg0","type":"address"},{"name":"arg1","type":"address"}],"outputs":[{"name":"","type":"uint256"}],"gas":3808},{"stateMutability":"view","type":"function","name":"totalSupply","inputs":[],"outputs":[{"name":"","type":"uint256"}],"gas":3408}]
abiDecoder.addABI(ABI_Metapool)
let ABI_THREEPOOL_ZAP = [{"stateMutability":"nonpayable","type":"constructor","inputs":[{"name":"_base_pool","type":"address"},{"name":"_base_lp_token","type":"address"},{"name":"_weth","type":"address"},{"name":"_base_coins","type":"address[3]"}],"outputs":[]},{"stateMutability":"payable","type":"fallback"},{"stateMutability":"pure","type":"function","name":"base_pool","inputs":[],"outputs":[{"name":"","type":"address"}]},{"stateMutability":"pure","type":"function","name":"base_token","inputs":[],"outputs":[{"name":"","type":"address"}]},{"stateMutability":"view","type":"function","name":"price_oracle","inputs":[{"name":"_pool","type":"address"}],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"view","type":"function","name":"price_scale","inputs":[{"name":"_pool","type":"address"}],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"view","type":"function","name":"lp_price","inputs":[{"name":"_pool","type":"address"}],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"payable","type":"function","name":"exchange","inputs":[{"name":"_pool","type":"address"},{"name":"i","type":"uint256"},{"name":"j","type":"uint256"},{"name":"_dx","type":"uint256"},{"name":"_min_dy","type":"uint256"}],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"payable","type":"function","name":"exchange","inputs":[{"name":"_pool","type":"address"},{"name":"i","type":"uint256"},{"name":"j","type":"uint256"},{"name":"_dx","type":"uint256"},{"name":"_min_dy","type":"uint256"},{"name":"_use_eth","type":"bool"}],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"payable","type":"function","name":"exchange","inputs":[{"name":"_pool","type":"address"},{"name":"i","type":"uint256"},{"name":"j","type":"uint256"},{"name":"_dx","type":"uint256"},{"name":"_min_dy","type":"uint256"},{"name":"_use_eth","type":"bool"},{"name":"_receiver","type":"address"}],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"view","type":"function","name":"get_dy","inputs":[{"name":"_pool","type":"address"},{"name":"i","type":"uint256"},{"name":"j","type":"uint256"},{"name":"_dx","type":"uint256"}],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"payable","type":"function","name":"add_liquidity","inputs":[{"name":"_pool","type":"address"},{"name":"_deposit_amounts","type":"uint256[4]"},{"name":"_min_mint_amount","type":"uint256"}],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"payable","type":"function","name":"add_liquidity","inputs":[{"name":"_pool","type":"address"},{"name":"_deposit_amounts","type":"uint256[4]"},{"name":"_min_mint_amount","type":"uint256"},{"name":"_use_eth","type":"bool"}],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"payable","type":"function","name":"add_liquidity","inputs":[{"name":"_pool","type":"address"},{"name":"_deposit_amounts","type":"uint256[4]"},{"name":"_min_mint_amount","type":"uint256"},{"name":"_use_eth","type":"bool"},{"name":"_receiver","type":"address"}],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"view","type":"function","name":"calc_token_amount","inputs":[{"name":"_pool","type":"address"},{"name":"_amounts","type":"uint256[4]"}],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"nonpayable","type":"function","name":"remove_liquidity","inputs":[{"name":"_pool","type":"address"},{"name":"_burn_amount","type":"uint256"},{"name":"_min_amounts","type":"uint256[4]"}],"outputs":[{"name":"","type":"uint256[4]"}]},{"stateMutability":"nonpayable","type":"function","name":"remove_liquidity","inputs":[{"name":"_pool","type":"address"},{"name":"_burn_amount","type":"uint256"},{"name":"_min_amounts","type":"uint256[4]"},{"name":"_use_eth","type":"bool"}],"outputs":[{"name":"","type":"uint256[4]"}]},{"stateMutability":"nonpayable","type":"function","name":"remove_liquidity","inputs":[{"name":"_pool","type":"address"},{"name":"_burn_amount","type":"uint256"},{"name":"_min_amounts","type":"uint256[4]"},{"name":"_use_eth","type":"bool"},{"name":"_receiver","type":"address"}],"outputs":[{"name":"","type":"uint256[4]"}]},{"stateMutability":"nonpayable","type":"function","name":"remove_liquidity_one_coin","inputs":[{"name":"_pool","type":"address"},{"name":"_burn_amount","type":"uint256"},{"name":"i","type":"uint256"},{"name":"_min_amount","type":"uint256"}],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"nonpayable","type":"function","name":"remove_liquidity_one_coin","inputs":[{"name":"_pool","type":"address"},{"name":"_burn_amount","type":"uint256"},{"name":"i","type":"uint256"},{"name":"_min_amount","type":"uint256"},{"name":"_use_eth","type":"bool"}],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"nonpayable","type":"function","name":"remove_liquidity_one_coin","inputs":[{"name":"_pool","type":"address"},{"name":"_burn_amount","type":"uint256"},{"name":"i","type":"uint256"},{"name":"_min_amount","type":"uint256"},{"name":"_use_eth","type":"bool"},{"name":"_receiver","type":"address"}],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"view","type":"function","name":"calc_withdraw_one_coin","inputs":[{"name":"_pool","type":"address"},{"name":"_token_amount","type":"uint256"},{"name":"i","type":"uint256"}],"outputs":[{"name":"","type":"uint256"}]}]
abiDecoder.addABI(ABI_THREEPOOL_ZAP)
let ABI_3Pool_Deposit_Zap = [{"outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"constructor"},{"name":"add_liquidity","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"address","name":"_pool"},{"type":"uint256[4]","name":"_deposit_amounts"},{"type":"uint256","name":"_min_mint_amount"}],"stateMutability":"nonpayable","type":"function"},{"name":"add_liquidity","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"address","name":"_pool"},{"type":"uint256[4]","name":"_deposit_amounts"},{"type":"uint256","name":"_min_mint_amount"},{"type":"address","name":"_receiver"}],"stateMutability":"nonpayable","type":"function"},{"name":"remove_liquidity","outputs":[{"type":"uint256[4]","name":""}],"inputs":[{"type":"address","name":"_pool"},{"type":"uint256","name":"_burn_amount"},{"type":"uint256[4]","name":"_min_amounts"}],"stateMutability":"nonpayable","type":"function"},{"name":"remove_liquidity","outputs":[{"type":"uint256[4]","name":""}],"inputs":[{"type":"address","name":"_pool"},{"type":"uint256","name":"_burn_amount"},{"type":"uint256[4]","name":"_min_amounts"},{"type":"address","name":"_receiver"}],"stateMutability":"nonpayable","type":"function"},{"name":"remove_liquidity_one_coin","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"address","name":"_pool"},{"type":"uint256","name":"_burn_amount"},{"type":"int128","name":"i"},{"type":"uint256","name":"_min_amount"}],"stateMutability":"nonpayable","type":"function"},{"name":"remove_liquidity_one_coin","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"address","name":"_pool"},{"type":"uint256","name":"_burn_amount"},{"type":"int128","name":"i"},{"type":"uint256","name":"_min_amount"},{"type":"address","name":"_receiver"}],"stateMutability":"nonpayable","type":"function"},{"name":"remove_liquidity_imbalance","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"address","name":"_pool"},{"type":"uint256[4]","name":"_amounts"},{"type":"uint256","name":"_max_burn_amount"}],"stateMutability":"nonpayable","type":"function"},{"name":"remove_liquidity_imbalance","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"address","name":"_pool"},{"type":"uint256[4]","name":"_amounts"},{"type":"uint256","name":"_max_burn_amount"},{"type":"address","name":"_receiver"}],"stateMutability":"nonpayable","type":"function"},{"name":"calc_withdraw_one_coin","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"address","name":"_pool"},{"type":"uint256","name":"_token_amount"},{"type":"int128","name":"i"}],"stateMutability":"view","type":"function","gas":1650},{"name":"calc_token_amount","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"address","name":"_pool"},{"type":"uint256[4]","name":"_amounts"},{"type":"bool","name":"_is_deposit"}],"stateMutability":"view","type":"function","gas":2717}]
abiDecoder.addABI(ABI_3Pool_Deposit_Zap)
let ABI_Zapfor3poolMetapools = [{"stateMutability":"nonpayable","type":"constructor","inputs":[{"name":"_base_pool","type":"address"},{"name":"_base_lp_token","type":"address"},{"name":"_weth","type":"address"},{"name":"_base_coins","type":"address[3]"}],"outputs":[]},{"stateMutability":"payable","type":"fallback"},{"stateMutability":"pure","type":"function","name":"base_pool","inputs":[],"outputs":[{"name":"","type":"address"}]},{"stateMutability":"pure","type":"function","name":"base_token","inputs":[],"outputs":[{"name":"","type":"address"}]},{"stateMutability":"view","type":"function","name":"price_oracle","inputs":[{"name":"_pool","type":"address"}],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"view","type":"function","name":"price_scale","inputs":[{"name":"_pool","type":"address"}],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"view","type":"function","name":"lp_price","inputs":[{"name":"_pool","type":"address"}],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"payable","type":"function","name":"exchange","inputs":[{"name":"_pool","type":"address"},{"name":"i","type":"uint256"},{"name":"j","type":"uint256"},{"name":"_dx","type":"uint256"},{"name":"_min_dy","type":"uint256"}],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"payable","type":"function","name":"exchange","inputs":[{"name":"_pool","type":"address"},{"name":"i","type":"uint256"},{"name":"j","type":"uint256"},{"name":"_dx","type":"uint256"},{"name":"_min_dy","type":"uint256"},{"name":"_use_eth","type":"bool"}],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"payable","type":"function","name":"exchange","inputs":[{"name":"_pool","type":"address"},{"name":"i","type":"uint256"},{"name":"j","type":"uint256"},{"name":"_dx","type":"uint256"},{"name":"_min_dy","type":"uint256"},{"name":"_use_eth","type":"bool"},{"name":"_receiver","type":"address"}],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"view","type":"function","name":"get_dy","inputs":[{"name":"_pool","type":"address"},{"name":"i","type":"uint256"},{"name":"j","type":"uint256"},{"name":"_dx","type":"uint256"}],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"payable","type":"function","name":"add_liquidity","inputs":[{"name":"_pool","type":"address"},{"name":"_deposit_amounts","type":"uint256[4]"},{"name":"_min_mint_amount","type":"uint256"}],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"payable","type":"function","name":"add_liquidity","inputs":[{"name":"_pool","type":"address"},{"name":"_deposit_amounts","type":"uint256[4]"},{"name":"_min_mint_amount","type":"uint256"},{"name":"_use_eth","type":"bool"}],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"payable","type":"function","name":"add_liquidity","inputs":[{"name":"_pool","type":"address"},{"name":"_deposit_amounts","type":"uint256[4]"},{"name":"_min_mint_amount","type":"uint256"},{"name":"_use_eth","type":"bool"},{"name":"_receiver","type":"address"}],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"view","type":"function","name":"calc_token_amount","inputs":[{"name":"_pool","type":"address"},{"name":"_amounts","type":"uint256[4]"}],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"nonpayable","type":"function","name":"remove_liquidity","inputs":[{"name":"_pool","type":"address"},{"name":"_burn_amount","type":"uint256"},{"name":"_min_amounts","type":"uint256[4]"}],"outputs":[{"name":"","type":"uint256[4]"}]},{"stateMutability":"nonpayable","type":"function","name":"remove_liquidity","inputs":[{"name":"_pool","type":"address"},{"name":"_burn_amount","type":"uint256"},{"name":"_min_amounts","type":"uint256[4]"},{"name":"_use_eth","type":"bool"}],"outputs":[{"name":"","type":"uint256[4]"}]},{"stateMutability":"nonpayable","type":"function","name":"remove_liquidity","inputs":[{"name":"_pool","type":"address"},{"name":"_burn_amount","type":"uint256"},{"name":"_min_amounts","type":"uint256[4]"},{"name":"_use_eth","type":"bool"},{"name":"_receiver","type":"address"}],"outputs":[{"name":"","type":"uint256[4]"}]},{"stateMutability":"nonpayable","type":"function","name":"remove_liquidity_one_coin","inputs":[{"name":"_pool","type":"address"},{"name":"_burn_amount","type":"uint256"},{"name":"i","type":"uint256"},{"name":"_min_amount","type":"uint256"}],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"nonpayable","type":"function","name":"remove_liquidity_one_coin","inputs":[{"name":"_pool","type":"address"},{"name":"_burn_amount","type":"uint256"},{"name":"i","type":"uint256"},{"name":"_min_amount","type":"uint256"},{"name":"_use_eth","type":"bool"}],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"nonpayable","type":"function","name":"remove_liquidity_one_coin","inputs":[{"name":"_pool","type":"address"},{"name":"_burn_amount","type":"uint256"},{"name":"i","type":"uint256"},{"name":"_min_amount","type":"uint256"},{"name":"_use_eth","type":"bool"},{"name":"_receiver","type":"address"}],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"view","type":"function","name":"calc_withdraw_one_coin","inputs":[{"name":"_pool","type":"address"},{"name":"_token_amount","type":"uint256"},{"name":"i","type":"uint256"}],"outputs":[{"name":"","type":"uint256"}]}]
abiDecoder.addABI(ABI_Zapfor3poolMetapools)

const EventEmitter = require("events")
const emitter = new EventEmitter()

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

// can be either set1 or set2, one set consists of 5 alchemy api keys. We need one set for the telegram bot and another set for the curve monitor
// set 1 = telegram bot
// set 2 = curve monitor
let keySet = 2

if(keySet==1){
	var ws_KEY1 = new Web3(new Web3.providers.WebsocketProvider(apiKeys.ws_KEY1, options))
	var ws_KEY2 = new Web3(new Web3.providers.WebsocketProvider(apiKeys.ws_KEY2, options))
	var ws_KEY3 = new Web3(new Web3.providers.WebsocketProvider(apiKeys.ws_KEY3, options))
	var ws_KEY4 = new Web3(new Web3.providers.WebsocketProvider(apiKeys.ws_KEY4, options))
	var ws_KEY5 = new Web3(new Web3.providers.WebsocketProvider(apiKeys.ws_KEY5, options))
}
if(keySet==2){
	var ws_KEY1 = new Web3(new Web3.providers.WebsocketProvider(apiKeys.ws_KEY6, options))
	var ws_KEY2 = new Web3(new Web3.providers.WebsocketProvider(apiKeys.ws_KEY7, options))
	var ws_KEY3 = new Web3(new Web3.providers.WebsocketProvider(apiKeys.ws_KEY8, options))
	var ws_KEY4 = new Web3(new Web3.providers.WebsocketProvider(apiKeys.ws_KEY9, options))
	var ws_KEY5 = new Web3(new Web3.providers.WebsocketProvider(apiKeys.ws_KEY10, options))
}

const web3 = new Web3(new Web3.providers.WebsocketProvider(apiKeys.web3, options))
const web3HTTP = new Web3(new Web3.providers.HttpProvider(apiKeys.web3HTTP, options))

//const web3_llamarpc = new Web3(new Web3.providers.WebsocketProvider(apiKeys.web3_llamarpc))
const web3HTTP_llamarpc = new Web3(new Web3.providers.HttpProvider("https://eth.llamarpc.com/rpc/"+apiKeys.web3_llamarpc))

//process.env["NTBA_FIX_319"] = 1

function setWS(abi,address) {
	return new web3.eth.Contract(abi, address)
}

function set(abi,address) {
	return new web3HTTP.eth.Contract(abi, address)
}

function setLlamaRPC(abi,address){
	return new web3HTTP_llamarpc.eth.Contract(abi, address)
}

const TelegramBot = require("node-telegram-bot-api")


const token = apiKeys.telegram_test_env_token // test_environment https://t.me/testing_curveMonitor_bot
const GROUP_ID = apiKeys.telegram_test_env_group_id // test_environment
let dollar_filter = 1 //2M


/*
const token = apiKeys.telegram_main_env_token // main_environment https://t.me/Curve_Monitor_backup_bot
const GROUP_ID = apiKeys.telegram_main_env_group_id // main_environment
let dollar_filter = 2000000 //2M
*/

var bot

const ABI_UNISWAP_V3 = [{"inputs":[],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"int24","name":"tickLower","type":"int24"},{"indexed":true,"internalType":"int24","name":"tickUpper","type":"int24"},{"indexed":false,"internalType":"uint128","name":"amount","type":"uint128"},{"indexed":false,"internalType":"uint256","name":"amount0","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"amount1","type":"uint256"}],"name":"Burn","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":false,"internalType":"address","name":"recipient","type":"address"},{"indexed":true,"internalType":"int24","name":"tickLower","type":"int24"},{"indexed":true,"internalType":"int24","name":"tickUpper","type":"int24"},{"indexed":false,"internalType":"uint128","name":"amount0","type":"uint128"},{"indexed":false,"internalType":"uint128","name":"amount1","type":"uint128"}],"name":"Collect","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"sender","type":"address"},{"indexed":true,"internalType":"address","name":"recipient","type":"address"},{"indexed":false,"internalType":"uint128","name":"amount0","type":"uint128"},{"indexed":false,"internalType":"uint128","name":"amount1","type":"uint128"}],"name":"CollectProtocol","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"sender","type":"address"},{"indexed":true,"internalType":"address","name":"recipient","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount0","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"amount1","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"paid0","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"paid1","type":"uint256"}],"name":"Flash","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint16","name":"observationCardinalityNextOld","type":"uint16"},{"indexed":false,"internalType":"uint16","name":"observationCardinalityNextNew","type":"uint16"}],"name":"IncreaseObservationCardinalityNext","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint160","name":"sqrtPriceX96","type":"uint160"},{"indexed":false,"internalType":"int24","name":"tick","type":"int24"}],"name":"Initialize","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"sender","type":"address"},{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"int24","name":"tickLower","type":"int24"},{"indexed":true,"internalType":"int24","name":"tickUpper","type":"int24"},{"indexed":false,"internalType":"uint128","name":"amount","type":"uint128"},{"indexed":false,"internalType":"uint256","name":"amount0","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"amount1","type":"uint256"}],"name":"Mint","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint8","name":"feeProtocol0Old","type":"uint8"},{"indexed":false,"internalType":"uint8","name":"feeProtocol1Old","type":"uint8"},{"indexed":false,"internalType":"uint8","name":"feeProtocol0New","type":"uint8"},{"indexed":false,"internalType":"uint8","name":"feeProtocol1New","type":"uint8"}],"name":"SetFeeProtocol","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"sender","type":"address"},{"indexed":true,"internalType":"address","name":"recipient","type":"address"},{"indexed":false,"internalType":"int256","name":"amount0","type":"int256"},{"indexed":false,"internalType":"int256","name":"amount1","type":"int256"},{"indexed":false,"internalType":"uint160","name":"sqrtPriceX96","type":"uint160"},{"indexed":false,"internalType":"uint128","name":"liquidity","type":"uint128"},{"indexed":false,"internalType":"int24","name":"tick","type":"int24"}],"name":"Swap","type":"event"},{"inputs":[{"internalType":"int24","name":"tickLower","type":"int24"},{"internalType":"int24","name":"tickUpper","type":"int24"},{"internalType":"uint128","name":"amount","type":"uint128"}],"name":"burn","outputs":[{"internalType":"uint256","name":"amount0","type":"uint256"},{"internalType":"uint256","name":"amount1","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"recipient","type":"address"},{"internalType":"int24","name":"tickLower","type":"int24"},{"internalType":"int24","name":"tickUpper","type":"int24"},{"internalType":"uint128","name":"amount0Requested","type":"uint128"},{"internalType":"uint128","name":"amount1Requested","type":"uint128"}],"name":"collect","outputs":[{"internalType":"uint128","name":"amount0","type":"uint128"},{"internalType":"uint128","name":"amount1","type":"uint128"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint128","name":"amount0Requested","type":"uint128"},{"internalType":"uint128","name":"amount1Requested","type":"uint128"}],"name":"collectProtocol","outputs":[{"internalType":"uint128","name":"amount0","type":"uint128"},{"internalType":"uint128","name":"amount1","type":"uint128"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"factory","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"fee","outputs":[{"internalType":"uint24","name":"","type":"uint24"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"feeGrowthGlobal0X128","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"feeGrowthGlobal1X128","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"amount0","type":"uint256"},{"internalType":"uint256","name":"amount1","type":"uint256"},{"internalType":"bytes","name":"data","type":"bytes"}],"name":"flash","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint16","name":"observationCardinalityNext","type":"uint16"}],"name":"increaseObservationCardinalityNext","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint160","name":"sqrtPriceX96","type":"uint160"}],"name":"initialize","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"liquidity","outputs":[{"internalType":"uint128","name":"","type":"uint128"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"maxLiquidityPerTick","outputs":[{"internalType":"uint128","name":"","type":"uint128"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"recipient","type":"address"},{"internalType":"int24","name":"tickLower","type":"int24"},{"internalType":"int24","name":"tickUpper","type":"int24"},{"internalType":"uint128","name":"amount","type":"uint128"},{"internalType":"bytes","name":"data","type":"bytes"}],"name":"mint","outputs":[{"internalType":"uint256","name":"amount0","type":"uint256"},{"internalType":"uint256","name":"amount1","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"observations","outputs":[{"internalType":"uint32","name":"blockTimestamp","type":"uint32"},{"internalType":"int56","name":"tickCumulative","type":"int56"},{"internalType":"uint160","name":"secondsPerLiquidityCumulativeX128","type":"uint160"},{"internalType":"bool","name":"initialized","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint32[]","name":"secondsAgos","type":"uint32[]"}],"name":"observe","outputs":[{"internalType":"int56[]","name":"tickCumulatives","type":"int56[]"},{"internalType":"uint160[]","name":"secondsPerLiquidityCumulativeX128s","type":"uint160[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"name":"positions","outputs":[{"internalType":"uint128","name":"liquidity","type":"uint128"},{"internalType":"uint256","name":"feeGrowthInside0LastX128","type":"uint256"},{"internalType":"uint256","name":"feeGrowthInside1LastX128","type":"uint256"},{"internalType":"uint128","name":"tokensOwed0","type":"uint128"},{"internalType":"uint128","name":"tokensOwed1","type":"uint128"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"protocolFees","outputs":[{"internalType":"uint128","name":"token0","type":"uint128"},{"internalType":"uint128","name":"token1","type":"uint128"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint8","name":"feeProtocol0","type":"uint8"},{"internalType":"uint8","name":"feeProtocol1","type":"uint8"}],"name":"setFeeProtocol","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"slot0","outputs":[{"internalType":"uint160","name":"sqrtPriceX96","type":"uint160"},{"internalType":"int24","name":"tick","type":"int24"},{"internalType":"uint16","name":"observationIndex","type":"uint16"},{"internalType":"uint16","name":"observationCardinality","type":"uint16"},{"internalType":"uint16","name":"observationCardinalityNext","type":"uint16"},{"internalType":"uint8","name":"feeProtocol","type":"uint8"},{"internalType":"bool","name":"unlocked","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"int24","name":"tickLower","type":"int24"},{"internalType":"int24","name":"tickUpper","type":"int24"}],"name":"snapshotCumulativesInside","outputs":[{"internalType":"int56","name":"tickCumulativeInside","type":"int56"},{"internalType":"uint160","name":"secondsPerLiquidityInsideX128","type":"uint160"},{"internalType":"uint32","name":"secondsInside","type":"uint32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"recipient","type":"address"},{"internalType":"bool","name":"zeroForOne","type":"bool"},{"internalType":"int256","name":"amountSpecified","type":"int256"},{"internalType":"uint160","name":"sqrtPriceLimitX96","type":"uint160"},{"internalType":"bytes","name":"data","type":"bytes"}],"name":"swap","outputs":[{"internalType":"int256","name":"amount0","type":"int256"},{"internalType":"int256","name":"amount1","type":"int256"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"int16","name":"","type":"int16"}],"name":"tickBitmap","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"tickSpacing","outputs":[{"internalType":"int24","name":"","type":"int24"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"int24","name":"","type":"int24"}],"name":"ticks","outputs":[{"internalType":"uint128","name":"liquidityGross","type":"uint128"},{"internalType":"int128","name":"liquidityNet","type":"int128"},{"internalType":"uint256","name":"feeGrowthOutside0X128","type":"uint256"},{"internalType":"uint256","name":"feeGrowthOutside1X128","type":"uint256"},{"internalType":"int56","name":"tickCumulativeOutside","type":"int56"},{"internalType":"uint160","name":"secondsPerLiquidityOutsideX128","type":"uint160"},{"internalType":"uint32","name":"secondsOutside","type":"uint32"},{"internalType":"bool","name":"initialized","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"token0","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"token1","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"}]

const HACKED_ABI_TRICRYPTO = [{"stateMutability":"view","type":"function","name":"price_oracle","inputs":[{"name":"k","type":"uint256"}],"outputs":[{"name":"","type":"uint256"}],"gas":3361},]
const TRICRYPTO = setLlamaRPC(HACKED_ABI_TRICRYPTO,"0xD51a44d3FaE010294C616388b506AcdA1bfAAE46")

const ABI_THREEPOOL = [{"name":"TokenExchange","inputs":[{"type":"address","name":"buyer","indexed":true},{"type":"int128","name":"sold_id","indexed":false},{"type":"uint256","name":"tokens_sold","indexed":false},{"type":"int128","name":"bought_id","indexed":false},{"type":"uint256","name":"tokens_bought","indexed":false}],"anonymous":false,"type":"event"},{"name":"AddLiquidity","inputs":[{"type":"address","name":"provider","indexed":true},{"type":"uint256[3]","name":"token_amounts","indexed":false},{"type":"uint256[3]","name":"fees","indexed":false},{"type":"uint256","name":"invariant","indexed":false},{"type":"uint256","name":"token_supply","indexed":false}],"anonymous":false,"type":"event"},{"name":"RemoveLiquidity","inputs":[{"type":"address","name":"provider","indexed":true},{"type":"uint256[3]","name":"token_amounts","indexed":false},{"type":"uint256[3]","name":"fees","indexed":false},{"type":"uint256","name":"token_supply","indexed":false}],"anonymous":false,"type":"event"},{"name":"RemoveLiquidityOne","inputs":[{"type":"address","name":"provider","indexed":true},{"type":"uint256","name":"token_amount","indexed":false},{"type":"uint256","name":"coin_amount","indexed":false}],"anonymous":false,"type":"event"},{"name":"RemoveLiquidityImbalance","inputs":[{"type":"address","name":"provider","indexed":true},{"type":"uint256[3]","name":"token_amounts","indexed":false},{"type":"uint256[3]","name":"fees","indexed":false},{"type":"uint256","name":"invariant","indexed":false},{"type":"uint256","name":"token_supply","indexed":false}],"anonymous":false,"type":"event"},{"name":"CommitNewAdmin","inputs":[{"type":"uint256","name":"deadline","indexed":true},{"type":"address","name":"admin","indexed":true}],"anonymous":false,"type":"event"},{"name":"NewAdmin","inputs":[{"type":"address","name":"admin","indexed":true}],"anonymous":false,"type":"event"},{"name":"CommitNewFee","inputs":[{"type":"uint256","name":"deadline","indexed":true},{"type":"uint256","name":"fee","indexed":false},{"type":"uint256","name":"admin_fee","indexed":false}],"anonymous":false,"type":"event"},{"name":"NewFee","inputs":[{"type":"uint256","name":"fee","indexed":false},{"type":"uint256","name":"admin_fee","indexed":false}],"anonymous":false,"type":"event"},{"name":"RampA","inputs":[{"type":"uint256","name":"old_A","indexed":false},{"type":"uint256","name":"new_A","indexed":false},{"type":"uint256","name":"initial_time","indexed":false},{"type":"uint256","name":"future_time","indexed":false}],"anonymous":false,"type":"event"},{"name":"StopRampA","inputs":[{"type":"uint256","name":"A","indexed":false},{"type":"uint256","name":"t","indexed":false}],"anonymous":false,"type":"event"},{"outputs":[],"inputs":[{"type":"address","name":"_owner"},{"type":"address[3]","name":"_coins"},{"type":"address","name":"_pool_token"},{"type":"uint256","name":"_A"},{"type":"uint256","name":"_fee"},{"type":"uint256","name":"_admin_fee"}],"stateMutability":"nonpayable","type":"constructor"},{"name":"A","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":5227},{"name":"get_virtual_price","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":1133537},{"name":"calc_token_amount","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"uint256[3]","name":"amounts"},{"type":"bool","name":"deposit"}],"stateMutability":"view","type":"function","gas":4508776},{"name":"add_liquidity","outputs":[],"inputs":[{"type":"uint256[3]","name":"amounts"},{"type":"uint256","name":"min_mint_amount"}],"stateMutability":"nonpayable","type":"function","gas":6954858},{"name":"get_dy","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"int128","name":"i"},{"type":"int128","name":"j"},{"type":"uint256","name":"dx"}],"stateMutability":"view","type":"function","gas":2673791},{"name":"get_dy_underlying","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"int128","name":"i"},{"type":"int128","name":"j"},{"type":"uint256","name":"dx"}],"stateMutability":"view","type":"function","gas":2673474},{"name":"exchange","outputs":[],"inputs":[{"type":"int128","name":"i"},{"type":"int128","name":"j"},{"type":"uint256","name":"dx"},{"type":"uint256","name":"min_dy"}],"stateMutability":"nonpayable","type":"function","gas":2818066},{"name":"remove_liquidity","outputs":[],"inputs":[{"type":"uint256","name":"_amount"},{"type":"uint256[3]","name":"min_amounts"}],"stateMutability":"nonpayable","type":"function","gas":192846},{"name":"remove_liquidity_imbalance","outputs":[],"inputs":[{"type":"uint256[3]","name":"amounts"},{"type":"uint256","name":"max_burn_amount"}],"stateMutability":"nonpayable","type":"function","gas":6951851},{"name":"calc_withdraw_one_coin","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"uint256","name":"_token_amount"},{"type":"int128","name":"i"}],"stateMutability":"view","type":"function","gas":1102},{"name":"remove_liquidity_one_coin","outputs":[],"inputs":[{"type":"uint256","name":"_token_amount"},{"type":"int128","name":"i"},{"type":"uint256","name":"min_amount"}],"stateMutability":"nonpayable","type":"function","gas":4025523},{"name":"ramp_A","outputs":[],"inputs":[{"type":"uint256","name":"_future_A"},{"type":"uint256","name":"_future_time"}],"stateMutability":"nonpayable","type":"function","gas":151919},{"name":"stop_ramp_A","outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"function","gas":148637},{"name":"commit_new_fee","outputs":[],"inputs":[{"type":"uint256","name":"new_fee"},{"type":"uint256","name":"new_admin_fee"}],"stateMutability":"nonpayable","type":"function","gas":110461},{"name":"apply_new_fee","outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"function","gas":97242},{"name":"revert_new_parameters","outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"function","gas":21895},{"name":"commit_transfer_ownership","outputs":[],"inputs":[{"type":"address","name":"_owner"}],"stateMutability":"nonpayable","type":"function","gas":74572},{"name":"apply_transfer_ownership","outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"function","gas":60710},{"name":"revert_transfer_ownership","outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"function","gas":21985},{"name":"admin_balances","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"uint256","name":"i"}],"stateMutability":"view","type":"function","gas":3481},{"name":"withdraw_admin_fees","outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"function","gas":21502},{"name":"donate_admin_fees","outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"function","gas":111389},{"name":"kill_me","outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"function","gas":37998},{"name":"unkill_me","outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"function","gas":22135},{"name":"coins","outputs":[{"type":"address","name":""}],"inputs":[{"type":"uint256","name":"arg0"}],"stateMutability":"view","type":"function","gas":2220},{"name":"balances","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"uint256","name":"arg0"}],"stateMutability":"view","type":"function","gas":2250},{"name":"fee","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2171},{"name":"admin_fee","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2201},{"name":"owner","outputs":[{"type":"address","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2231},{"name":"initial_A","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2261},{"name":"future_A","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2291},{"name":"initial_A_time","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2321},{"name":"future_A_time","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2351},{"name":"admin_actions_deadline","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2381},{"name":"transfer_ownership_deadline","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2411},{"name":"future_fee","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2441},{"name":"future_admin_fee","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2471},{"name":"future_owner","outputs":[{"type":"address","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2501}]
const THREEPOOL = set(ABI_THREEPOOL,"0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7")

const ABI_FRAXBP = [{"name":"TokenExchange","inputs":[{"name":"buyer","type":"address","indexed":true},{"name":"sold_id","type":"int128","indexed":false},{"name":"tokens_sold","type":"uint256","indexed":false},{"name":"bought_id","type":"int128","indexed":false},{"name":"tokens_bought","type":"uint256","indexed":false}],"anonymous":false,"type":"event"},{"name":"AddLiquidity","inputs":[{"name":"provider","type":"address","indexed":true},{"name":"token_amounts","type":"uint256[2]","indexed":false},{"name":"fees","type":"uint256[2]","indexed":false},{"name":"invariant","type":"uint256","indexed":false},{"name":"token_supply","type":"uint256","indexed":false}],"anonymous":false,"type":"event"},{"name":"RemoveLiquidity","inputs":[{"name":"provider","type":"address","indexed":true},{"name":"token_amounts","type":"uint256[2]","indexed":false},{"name":"fees","type":"uint256[2]","indexed":false},{"name":"token_supply","type":"uint256","indexed":false}],"anonymous":false,"type":"event"},{"name":"RemoveLiquidityOne","inputs":[{"name":"provider","type":"address","indexed":true},{"name":"token_amount","type":"uint256","indexed":false},{"name":"coin_amount","type":"uint256","indexed":false},{"name":"token_supply","type":"uint256","indexed":false}],"anonymous":false,"type":"event"},{"name":"RemoveLiquidityImbalance","inputs":[{"name":"provider","type":"address","indexed":true},{"name":"token_amounts","type":"uint256[2]","indexed":false},{"name":"fees","type":"uint256[2]","indexed":false},{"name":"invariant","type":"uint256","indexed":false},{"name":"token_supply","type":"uint256","indexed":false}],"anonymous":false,"type":"event"},{"name":"CommitNewAdmin","inputs":[{"name":"deadline","type":"uint256","indexed":true},{"name":"admin","type":"address","indexed":true}],"anonymous":false,"type":"event"},{"name":"NewAdmin","inputs":[{"name":"admin","type":"address","indexed":true}],"anonymous":false,"type":"event"},{"name":"CommitNewFee","inputs":[{"name":"deadline","type":"uint256","indexed":true},{"name":"fee","type":"uint256","indexed":false},{"name":"admin_fee","type":"uint256","indexed":false}],"anonymous":false,"type":"event"},{"name":"NewFee","inputs":[{"name":"fee","type":"uint256","indexed":false},{"name":"admin_fee","type":"uint256","indexed":false}],"anonymous":false,"type":"event"},{"name":"RampA","inputs":[{"name":"old_A","type":"uint256","indexed":false},{"name":"new_A","type":"uint256","indexed":false},{"name":"initial_time","type":"uint256","indexed":false},{"name":"future_time","type":"uint256","indexed":false}],"anonymous":false,"type":"event"},{"name":"StopRampA","inputs":[{"name":"A","type":"uint256","indexed":false},{"name":"t","type":"uint256","indexed":false}],"anonymous":false,"type":"event"},{"stateMutability":"nonpayable","type":"constructor","inputs":[{"name":"_owner","type":"address"},{"name":"_coins","type":"address[2]"},{"name":"_pool_token","type":"address"},{"name":"_A","type":"uint256"},{"name":"_fee","type":"uint256"},{"name":"_admin_fee","type":"uint256"}],"outputs":[]},{"stateMutability":"view","type":"function","name":"A","inputs":[],"outputs":[{"name":"","type":"uint256"}],"gas":10058},{"stateMutability":"view","type":"function","name":"A_precise","inputs":[],"outputs":[{"name":"","type":"uint256"}],"gas":10058},{"stateMutability":"view","type":"function","name":"get_virtual_price","inputs":[],"outputs":[{"name":"","type":"uint256"}],"gas":804988},{"stateMutability":"view","type":"function","name":"calc_token_amount","inputs":[{"name":"_amounts","type":"uint256[2]"},{"name":"_is_deposit","type":"bool"}],"outputs":[{"name":"","type":"uint256"}],"gas":1593467},{"stateMutability":"nonpayable","type":"function","name":"add_liquidity","inputs":[{"name":"_amounts","type":"uint256[2]"},{"name":"_min_mint_amount","type":"uint256"}],"outputs":[{"name":"","type":"uint256"}],"gas":2546841},{"stateMutability":"view","type":"function","name":"get_dy","inputs":[{"name":"i","type":"int128"},{"name":"j","type":"int128"},{"name":"_dx","type":"uint256"}],"outputs":[{"name":"","type":"uint256"}],"gas":1149036},{"stateMutability":"nonpayable","type":"function","name":"exchange","inputs":[{"name":"i","type":"int128"},{"name":"j","type":"int128"},{"name":"_dx","type":"uint256"},{"name":"_min_dy","type":"uint256"}],"outputs":[{"name":"","type":"uint256"}],"gas":1307513},{"stateMutability":"nonpayable","type":"function","name":"remove_liquidity","inputs":[{"name":"_amount","type":"uint256"},{"name":"_min_amounts","type":"uint256[2]"}],"outputs":[{"name":"","type":"uint256[2]"}],"gas":169716},{"stateMutability":"nonpayable","type":"function","name":"remove_liquidity_imbalance","inputs":[{"name":"_amounts","type":"uint256[2]"},{"name":"_max_burn_amount","type":"uint256"}],"outputs":[{"name":"","type":"uint256"}],"gas":2546560},{"stateMutability":"view","type":"function","name":"calc_withdraw_one_coin","inputs":[{"name":"_token_amount","type":"uint256"},{"name":"i","type":"int128"}],"outputs":[{"name":"","type":"uint256"}],"gas":989},{"stateMutability":"nonpayable","type":"function","name":"remove_liquidity_one_coin","inputs":[{"name":"_token_amount","type":"uint256"},{"name":"i","type":"int128"},{"name":"_min_amount","type":"uint256"}],"outputs":[{"name":"","type":"uint256"}],"gas":1620521},{"stateMutability":"nonpayable","type":"function","name":"ramp_A","inputs":[{"name":"_future_A","type":"uint256"},{"name":"_future_time","type":"uint256"}],"outputs":[],"gas":158394},{"stateMutability":"nonpayable","type":"function","name":"stop_ramp_A","inputs":[],"outputs":[],"gas":154617},{"stateMutability":"nonpayable","type":"function","name":"commit_new_fee","inputs":[{"name":"_new_fee","type":"uint256"},{"name":"_new_admin_fee","type":"uint256"}],"outputs":[],"gas":113298},{"stateMutability":"nonpayable","type":"function","name":"apply_new_fee","inputs":[],"outputs":[],"gas":103621},{"stateMutability":"nonpayable","type":"function","name":"revert_new_parameters","inputs":[],"outputs":[],"gas":22901},{"stateMutability":"nonpayable","type":"function","name":"commit_transfer_ownership","inputs":[{"name":"_owner","type":"address"}],"outputs":[],"gas":78536},{"stateMutability":"nonpayable","type":"function","name":"apply_transfer_ownership","inputs":[],"outputs":[],"gas":66804},{"stateMutability":"nonpayable","type":"function","name":"revert_transfer_ownership","inputs":[],"outputs":[],"gas":22991},{"stateMutability":"view","type":"function","name":"admin_balances","inputs":[{"name":"i","type":"uint256"}],"outputs":[{"name":"","type":"uint256"}],"gas":7769},{"stateMutability":"nonpayable","type":"function","name":"withdraw_admin_fees","inputs":[],"outputs":[],"gas":31496},{"stateMutability":"nonpayable","type":"function","name":"donate_admin_fees","inputs":[],"outputs":[],"gas":82442},{"stateMutability":"nonpayable","type":"function","name":"kill_me","inputs":[],"outputs":[],"gas":40304},{"stateMutability":"nonpayable","type":"function","name":"unkill_me","inputs":[],"outputs":[],"gas":23141},{"stateMutability":"view","type":"function","name":"coins","inputs":[{"name":"arg0","type":"uint256"}],"outputs":[{"name":"","type":"address"}],"gas":3225},{"stateMutability":"view","type":"function","name":"balances","inputs":[{"name":"arg0","type":"uint256"}],"outputs":[{"name":"","type":"uint256"}],"gas":3255},{"stateMutability":"view","type":"function","name":"fee","inputs":[],"outputs":[{"name":"","type":"uint256"}],"gas":3240},{"stateMutability":"view","type":"function","name":"admin_fee","inputs":[],"outputs":[{"name":"","type":"uint256"}],"gas":3270},{"stateMutability":"view","type":"function","name":"owner","inputs":[],"outputs":[{"name":"","type":"address"}],"gas":3300},{"stateMutability":"view","type":"function","name":"lp_token","inputs":[],"outputs":[{"name":"","type":"address"}],"gas":3330},{"stateMutability":"view","type":"function","name":"initial_A","inputs":[],"outputs":[{"name":"","type":"uint256"}],"gas":3360},{"stateMutability":"view","type":"function","name":"future_A","inputs":[],"outputs":[{"name":"","type":"uint256"}],"gas":3390},{"stateMutability":"view","type":"function","name":"initial_A_time","inputs":[],"outputs":[{"name":"","type":"uint256"}],"gas":3420},{"stateMutability":"view","type":"function","name":"future_A_time","inputs":[],"outputs":[{"name":"","type":"uint256"}],"gas":3450},{"stateMutability":"view","type":"function","name":"admin_actions_deadline","inputs":[],"outputs":[{"name":"","type":"uint256"}],"gas":3480},{"stateMutability":"view","type":"function","name":"transfer_ownership_deadline","inputs":[],"outputs":[{"name":"","type":"uint256"}],"gas":3510},{"stateMutability":"view","type":"function","name":"future_fee","inputs":[],"outputs":[{"name":"","type":"uint256"}],"gas":3540},{"stateMutability":"view","type":"function","name":"future_admin_fee","inputs":[],"outputs":[{"name":"","type":"uint256"}],"gas":3570},{"stateMutability":"view","type":"function","name":"future_owner","inputs":[],"outputs":[{"name":"","type":"address"}],"gas":3600}]
const FRAXBP = set(ABI_FRAXBP,"0xDcEF968d416a41Cdac0ED8702fAC8128A64241A2")

const ABI_sBTC_Swap = [{"name":"TokenExchange","inputs":[{"type":"address","name":"buyer","indexed":true},{"type":"int128","name":"sold_id","indexed":false},{"type":"uint256","name":"tokens_sold","indexed":false},{"type":"int128","name":"bought_id","indexed":false},{"type":"uint256","name":"tokens_bought","indexed":false}],"anonymous":false,"type":"event"},{"name":"AddLiquidity","inputs":[{"type":"address","name":"provider","indexed":true},{"type":"uint256[3]","name":"token_amounts","indexed":false},{"type":"uint256[3]","name":"fees","indexed":false},{"type":"uint256","name":"invariant","indexed":false},{"type":"uint256","name":"token_supply","indexed":false}],"anonymous":false,"type":"event"},{"name":"RemoveLiquidity","inputs":[{"type":"address","name":"provider","indexed":true},{"type":"uint256[3]","name":"token_amounts","indexed":false},{"type":"uint256[3]","name":"fees","indexed":false},{"type":"uint256","name":"token_supply","indexed":false}],"anonymous":false,"type":"event"},{"name":"RemoveLiquidityOne","inputs":[{"type":"address","name":"provider","indexed":true},{"type":"uint256","name":"token_amount","indexed":false},{"type":"uint256","name":"coin_amount","indexed":false}],"anonymous":false,"type":"event"},{"name":"RemoveLiquidityImbalance","inputs":[{"type":"address","name":"provider","indexed":true},{"type":"uint256[3]","name":"token_amounts","indexed":false},{"type":"uint256[3]","name":"fees","indexed":false},{"type":"uint256","name":"invariant","indexed":false},{"type":"uint256","name":"token_supply","indexed":false}],"anonymous":false,"type":"event"},{"name":"CommitNewAdmin","inputs":[{"type":"uint256","name":"deadline","indexed":true,"unit":"sec"},{"type":"address","name":"admin","indexed":true}],"anonymous":false,"type":"event"},{"name":"NewAdmin","inputs":[{"type":"address","name":"admin","indexed":true}],"anonymous":false,"type":"event"},{"name":"CommitNewFee","inputs":[{"type":"uint256","name":"deadline","indexed":true,"unit":"sec"},{"type":"uint256","name":"fee","indexed":false},{"type":"uint256","name":"admin_fee","indexed":false}],"anonymous":false,"type":"event"},{"name":"NewFee","inputs":[{"type":"uint256","name":"fee","indexed":false},{"type":"uint256","name":"admin_fee","indexed":false}],"anonymous":false,"type":"event"},{"name":"RampA","inputs":[{"type":"uint256","name":"old_A","indexed":false},{"type":"uint256","name":"new_A","indexed":false},{"type":"uint256","name":"initial_time","indexed":false,"unit":"sec"},{"type":"uint256","name":"future_time","indexed":false,"unit":"sec"}],"anonymous":false,"type":"event"},{"name":"StopRampA","inputs":[{"type":"uint256","name":"A","indexed":false},{"type":"uint256","name":"t","indexed":false,"unit":"sec"}],"anonymous":false,"type":"event"},{"outputs":[],"inputs":[{"type":"address[3]","name":"_coins"},{"type":"address","name":"_pool_token"},{"type":"uint256","name":"_A"},{"type":"uint256","name":"_fee"}],"constant":false,"payable":false,"type":"constructor"},{"name":"A","outputs":[{"type":"uint256","name":""}],"inputs":[],"constant":true,"payable":false,"type":"function","gas":5227},{"name":"get_virtual_price","outputs":[{"type":"uint256","name":""}],"inputs":[],"constant":true,"payable":false,"type":"function","gas":1150488},{"name":"calc_token_amount","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"uint256[3]","name":"amounts"},{"type":"bool","name":"deposit"}],"constant":true,"payable":false,"type":"function","gas":4526955},{"name":"add_liquidity","outputs":[],"inputs":[{"type":"uint256[3]","name":"amounts"},{"type":"uint256","name":"min_mint_amount"}],"constant":false,"payable":false,"type":"function","gas":6972762},{"name":"get_dy","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"int128","name":"i"},{"type":"int128","name":"j"},{"type":"uint256","name":"dx"}],"constant":true,"payable":false,"type":"function","gas":2687932},{"name":"get_dy_underlying","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"int128","name":"i"},{"type":"int128","name":"j"},{"type":"uint256","name":"dx"}],"constant":true,"payable":false,"type":"function","gas":2687745},{"name":"exchange","outputs":[],"inputs":[{"type":"int128","name":"i"},{"type":"int128","name":"j"},{"type":"uint256","name":"dx"},{"type":"uint256","name":"min_dy"}],"constant":false,"payable":false,"type":"function","gas":5499133},{"name":"remove_liquidity","outputs":[],"inputs":[{"type":"uint256","name":"_amount"},{"type":"uint256[3]","name":"min_amounts"}],"constant":false,"payable":false,"type":"function","gas":196975},{"name":"remove_liquidity_imbalance","outputs":[],"inputs":[{"type":"uint256[3]","name":"amounts"},{"type":"uint256","name":"max_burn_amount"}],"constant":false,"payable":false,"type":"function","gas":6972281},{"name":"calc_withdraw_one_coin","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"uint256","name":"_token_amount"},{"type":"int128","name":"i"}],"constant":true,"payable":false,"type":"function","gas":15405},{"name":"remove_liquidity_one_coin","outputs":[],"inputs":[{"type":"uint256","name":"_token_amount"},{"type":"int128","name":"i"},{"type":"uint256","name":"min_amount"}],"constant":false,"payable":false,"type":"function","gas":4044074},{"name":"ramp_A","outputs":[],"inputs":[{"type":"uint256","name":"_future_A"},{"type":"uint256","unit":"sec","name":"_future_time"}],"constant":false,"payable":false,"type":"function","gas":151937},{"name":"stop_ramp_A","outputs":[],"inputs":[],"constant":false,"payable":false,"type":"function","gas":148697},{"name":"commit_new_fee","outputs":[],"inputs":[{"type":"uint256","name":"new_fee"},{"type":"uint256","name":"new_admin_fee"}],"constant":false,"payable":false,"type":"function","gas":110521},{"name":"apply_new_fee","outputs":[],"inputs":[],"constant":false,"payable":false,"type":"function","gas":97220},{"name":"revert_new_parameters","outputs":[],"inputs":[],"constant":false,"payable":false,"type":"function","gas":21955},{"name":"commit_transfer_ownership","outputs":[],"inputs":[{"type":"address","name":"_owner"}],"constant":false,"payable":false,"type":"function","gas":74632},{"name":"apply_transfer_ownership","outputs":[],"inputs":[],"constant":false,"payable":false,"type":"function","gas":60688},{"name":"revert_transfer_ownership","outputs":[],"inputs":[],"constant":false,"payable":false,"type":"function","gas":22045},{"name":"withdraw_admin_fees","outputs":[],"inputs":[],"constant":false,"payable":false,"type":"function","gas":17565},{"name":"kill_me","outputs":[],"inputs":[],"constant":false,"payable":false,"type":"function","gas":37998},{"name":"unkill_me","outputs":[],"inputs":[],"constant":false,"payable":false,"type":"function","gas":22135},{"name":"coins","outputs":[{"type":"address","name":""}],"inputs":[{"type":"int128","name":"arg0"}],"constant":true,"payable":false,"type":"function","gas":2310},{"name":"balances","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"int128","name":"arg0"}],"constant":true,"payable":false,"type":"function","gas":2340},{"name":"fee","outputs":[{"type":"uint256","name":""}],"inputs":[],"constant":true,"payable":false,"type":"function","gas":2171},{"name":"admin_fee","outputs":[{"type":"uint256","name":""}],"inputs":[],"constant":true,"payable":false,"type":"function","gas":2201},{"name":"owner","outputs":[{"type":"address","name":""}],"inputs":[],"constant":true,"payable":false,"type":"function","gas":2231},{"name":"initial_A","outputs":[{"type":"uint256","name":""}],"inputs":[],"constant":true,"payable":false,"type":"function","gas":2261},{"name":"future_A","outputs":[{"type":"uint256","name":""}],"inputs":[],"constant":true,"payable":false,"type":"function","gas":2291},{"name":"initial_A_time","outputs":[{"type":"uint256","unit":"sec","name":""}],"inputs":[],"constant":true,"payable":false,"type":"function","gas":2321},{"name":"future_A_time","outputs":[{"type":"uint256","unit":"sec","name":""}],"inputs":[],"constant":true,"payable":false,"type":"function","gas":2351},{"name":"admin_actions_deadline","outputs":[{"type":"uint256","unit":"sec","name":""}],"inputs":[],"constant":true,"payable":false,"type":"function","gas":2381},{"name":"transfer_ownership_deadline","outputs":[{"type":"uint256","unit":"sec","name":""}],"inputs":[],"constant":true,"payable":false,"type":"function","gas":2411},{"name":"future_fee","outputs":[{"type":"uint256","name":""}],"inputs":[],"constant":true,"payable":false,"type":"function","gas":2441},{"name":"future_admin_fee","outputs":[{"type":"uint256","name":""}],"inputs":[],"constant":true,"payable":false,"type":"function","gas":2471},{"name":"future_owner","outputs":[{"type":"address","name":""}],"inputs":[],"constant":true,"payable":false,"type":"function","gas":2501}]
const BTC_Swap = set(ABI_sBTC_Swap,"0x7fC77b5c7614E1533320Ea6DDc2Eb61fa00A9714")

/* dummy-call
for (let i = 0; i < maxRetries; i++) {
	try {
		let dy_underlying = await CONTRACT.methods.get_dy_underlying(i,j,dx).call(blockNumber)
		break
	} catch(error){await errHandler(error)}
}
*/

// to deal with compute units / s
let maxRetries = 12
let minRetryDelay = 100
let maxRetryDelay = 200

async function errHandler(error){
	if(error.code !== 429) {
		//console.log(error.message)
		//console.log("err in errHandler", error)
		return
	}
	console.log("err in errHandler", error)
	console.log(error.code)
	let retryDelay = Math.floor(Math.random() * (maxRetryDelay - minRetryDelay + 1) + minRetryDelay);
	await new Promise(resolve => setTimeout(resolve, retryDelay))
}

async function http_SocketSetup() {

	const io = new Server(2424, {
		cors: {
			origin: "http://localhost:2424",
			methods: ["GET", "POST"]
		}
	})

	await initSocketMessages(io)
	await startLandingSocket(io)
}

async function https_SocketSetup() {

	const httpsServer = https.createServer({
		key: fs.readFileSync("/home/transactions/certs/privkey1.pem"),
		cert: fs.readFileSync("/home/transactions/certs/cert1.pem"),
		ca: fs.readFileSync("/home/transactions/certs/fullchain1.pem")
	})

	const io = new Server(httpsServer, {
		cors: {
			origin: "*",
			methods: ["GET", "POST"]
		},
		requestCert: false,
		rejectUnauthorized: false,
	})
	
	await initSocketMessages(io)
	await startLandingSocket(io)

	httpsServer.listen(2053)
}

async function startLandingSocket(io){
	const landing_socket = io.of("/" )
	landing_socket.on("connection", async (socket) => {
		console.log("landing_socket connected")
		socket.on("search", (data) => {
			try{
				let res = search(data)
				socket.emit("search_res", res)
				console.log("user input:",data,"output:",res)
			}catch(err){
				console.log("err in search:",err.message)
			}
		})
		socket.on("disconnect", () => {
			console.log("client disconnected from landing page")
		})
	})
}

/**
 * on pool connect: 
 * send table data full (so one month)
 * send data cut for 1 month for: price chart (later balances and more)
 * then socket.on("timePeriod") => send data for: price chart (later balances and more)
 */ 

async function initSocketMessages(io){
	let pools = getCurvePools()
	for (const poolAddress of pools) {
		if(poolAddress!== whiteListedPoolAddress) continue
		const pool_socket = io.of("/" + poolAddress)

		pool_socket.on("connection", async (socket) => {
			console.log(poolAddress, "socket connected")
			socket.send("successfully connected to socket for " + poolAddress)

			//sending the array of token names, used in the price chart switch (priceOf: [...] priceIn: [...] on the UI)
			let curveJSON = JSON.parse(fs.readFileSync("CurvePoolData.json"))
			let coin_names = curveJSON[poolAddress].coin_names
			socket.emit("token names inside pool", coin_names)

			// eg [ 'sUSD', 'DAI' ] => price of sUSD in DAI
			let price_combination = [coin_names[coin_names.length-1],coin_names[0]]
			if(poolAddress == "0xA5407eAE9Ba41422680e2e00537571bcC53efBfD") price_combination = [ 'sUSD', 'USDC' ]

			// needed for when a user changes coins in the price chart, to keep track in which 
			let timeFrame = "month"

			socket.on("priceOf", (priceOf) => {
				price_combination[0] = priceOf
				//socket.emit("search_res", res)
			})

			socket.on("priceIn", (priceIn) => {
				price_combination[1] = priceIn
				//socket.emit("search_res", res)
			})

			// messages on connect
			sendTableData(socket,poolAddress)
			sendPriceData(timeFrame,socket,poolAddress,price_combination)
			sendBalanceData(timeFrame,socket,poolAddress)
			// sendTVLData()
			// sendVolumeData()

			// next block is for when a user plays with the time-span tabulator
			socket.on("day", () => {
				timeFrame = "day"
				sendPriceData("day",socket,poolAddress,price_combination)
				// sendBalanceData()
				// sendTVLData()
				// sendVolumeData()
			})
			socket.on("week", () => {
				timeFrame = "week"
				sendPriceData("week",socket,poolAddress,price_combination)
				// sendBalanceData()
				// sendTVLData()
				// sendVolumeData()
			})
			socket.on("month", () => {
				timeFrame = "month"
				sendPriceData("month",socket,poolAddress,price_combination)
				// sendBalanceData()
				// sendTVLData()
				// sendVolumeData()
			})

			socket.on("disconnect", () => {
				console.log("client disconnected")
			})

			// sending updates
			emitter.on("Update Table-ALL" + poolAddress, async (data) => {
				socket.emit("Update Table-ALL",data)
			})
			emitter.on("Update Table-MEV" + poolAddress, async (data) => {
				socket.emit("Update Table-MEV",data)
			})
			emitter.on("Update Price-Chart" + poolAddress, async (unixtime) => {
				socket.emit("Update Price-Chart",unixtime)
			})
			emitter.on("Update Balance-Chart" + poolAddress, async (data) => {
				socket.emit("Update Balance-Chart",data)
			})
			emitter.on("Update TVL-Chart" + poolAddress, async (data) => {
				socket.emit("Update TVL-Chart",data)
			})
			emitter.on("Update Volume-Chart" + poolAddress, async (data) => {
				socket.emit("Update Volume-Chart",data)
			})

		})
	}
}

function sendTableData(socket,poolAddress){
	let currentTime = new Date().getTime() / 1000
	var days = 31
	let startingPoint = currentTime - (days * 24 * 60 * 60)

	let dataALL = JSON.parse(fs.readFileSync("processedTxLog_ALL.json"))
	let dataMEV = JSON.parse(fs.readFileSync("processedTxLog_MEV.json"))

	let trimmedDataALL = dataALL[poolAddress].filter(entry => entry.unixtime >= startingPoint)
	let trimmedDataMEV = dataMEV[poolAddress].filter(entry => entry.unixtime >= startingPoint)

	socket.emit("table_all", trimmedDataALL)
	socket.emit("table_mev", trimmedDataMEV)
}

// trimmes down the message for the frontend to ship only data of last 24h, week, or month
function sendPriceData(timeFrame,socket,poolAddress,price_combination){
	let currentTime = new Date().getTime() / 1000

	if(timeFrame == "day") var days = 1
	if(timeFrame == "week") var days = 7
	if(timeFrame == "month") var days = 31

	let startingPoint = currentTime - (days * 24 * 60 * 60)

	let priceOf = price_combination[0]
	let priceIn = price_combination[1]
	let data = readPriceArray(poolAddress,priceOf,priceIn)

	let trimmedData = data.filter(item => Object.keys(item)[0] >= startingPoint)
	socket.emit("price_chart_combination", price_combination)
	socket.emit("price_chart", trimmedData)
}

function sendBalanceData(timeFrame,socket,poolAddress){
	let currentTime = new Date().getTime() / 1000

	if(timeFrame == "day") var days = 1
	if(timeFrame == "week") var days = 7
	if(timeFrame == "month") var days = 31

	let startingPoint = currentTime - (days * 24 * 60 * 60)

	let data = readBalancesArray(poolAddress)

	let trimmedData = data.filter(item => Object.keys(item)[0] >= startingPoint)
	socket.emit("balances_chart", trimmedData)
}

// updating prices
let eurPrice
for (let i = 0; i < maxRetries; i++) {
	try {
		let ABI_Chainlink_EUR_USD_Price_Feed = [{"inputs":[{"internalType":"address","name":"_aggregator","type":"address"},{"internalType":"address","name":"_accessController","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"int256","name":"current","type":"int256"},{"indexed":true,"internalType":"uint256","name":"roundId","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"updatedAt","type":"uint256"}],"name":"AnswerUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"roundId","type":"uint256"},{"indexed":true,"internalType":"address","name":"startedBy","type":"address"},{"indexed":false,"internalType":"uint256","name":"startedAt","type":"uint256"}],"name":"NewRound","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"}],"name":"OwnershipTransferRequested","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"inputs":[],"name":"acceptOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"accessController","outputs":[{"internalType":"contract AccessControllerInterface","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"aggregator","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_aggregator","type":"address"}],"name":"confirmAggregator","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"description","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_roundId","type":"uint256"}],"name":"getAnswer","outputs":[{"internalType":"int256","name":"","type":"int256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint80","name":"_roundId","type":"uint80"}],"name":"getRoundData","outputs":[{"internalType":"uint80","name":"roundId","type":"uint80"},{"internalType":"int256","name":"answer","type":"int256"},{"internalType":"uint256","name":"startedAt","type":"uint256"},{"internalType":"uint256","name":"updatedAt","type":"uint256"},{"internalType":"uint80","name":"answeredInRound","type":"uint80"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_roundId","type":"uint256"}],"name":"getTimestamp","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"latestAnswer","outputs":[{"internalType":"int256","name":"","type":"int256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"latestRound","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"latestRoundData","outputs":[{"internalType":"uint80","name":"roundId","type":"uint80"},{"internalType":"int256","name":"answer","type":"int256"},{"internalType":"uint256","name":"startedAt","type":"uint256"},{"internalType":"uint256","name":"updatedAt","type":"uint256"},{"internalType":"uint80","name":"answeredInRound","type":"uint80"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"latestTimestamp","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address payable","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint16","name":"","type":"uint16"}],"name":"phaseAggregators","outputs":[{"internalType":"contract AggregatorV2V3Interface","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"phaseId","outputs":[{"internalType":"uint16","name":"","type":"uint16"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_aggregator","type":"address"}],"name":"proposeAggregator","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"proposedAggregator","outputs":[{"internalType":"contract AggregatorV2V3Interface","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint80","name":"_roundId","type":"uint80"}],"name":"proposedGetRoundData","outputs":[{"internalType":"uint80","name":"roundId","type":"uint80"},{"internalType":"int256","name":"answer","type":"int256"},{"internalType":"uint256","name":"startedAt","type":"uint256"},{"internalType":"uint256","name":"updatedAt","type":"uint256"},{"internalType":"uint80","name":"answeredInRound","type":"uint80"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"proposedLatestRoundData","outputs":[{"internalType":"uint80","name":"roundId","type":"uint80"},{"internalType":"int256","name":"answer","type":"int256"},{"internalType":"uint256","name":"startedAt","type":"uint256"},{"internalType":"uint256","name":"updatedAt","type":"uint256"},{"internalType":"uint80","name":"answeredInRound","type":"uint80"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_accessController","type":"address"}],"name":"setController","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_to","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"version","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"}]
		eurPrice = await (setLlamaRPC(ABI_Chainlink_EUR_USD_Price_Feed, "0xb49f677943BC038e9857d61E7d053CaA2C1734C1")).methods.latestAnswer().call() / 1e8
		break
	} catch(error){
		await errHandler(error)
	}
}

let ethPrice
for (let i = 0; i < maxRetries; i++) {
	try {
		ethPrice = Number((await TRICRYPTO.methods.price_oracle(1).call())) / 1e18
		break
	} catch(error){await errHandler(error)}
}

let btcPrice
for (let i = 0; i < maxRetries; i++) {
	try {
		btcPrice = Number((await TRICRYPTO.methods.price_oracle(0).call())) / 1e18
		break
	} catch(error){await errHandler(error)}
}

let crvPrice = ethPrice/(await getPriceFromUniswapV3("0x4c83a7f819a5c37d64b4c5a2f8238ea082fa1f4e"))

async function update_eur_price() {
	let temp
	for (let i = 0; i < maxRetries; i++) {
		try {
			let ABI_Chainlink_EUR_USD_Price_Feed = [{"inputs":[{"internalType":"address","name":"_aggregator","type":"address"},{"internalType":"address","name":"_accessController","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"int256","name":"current","type":"int256"},{"indexed":true,"internalType":"uint256","name":"roundId","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"updatedAt","type":"uint256"}],"name":"AnswerUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"roundId","type":"uint256"},{"indexed":true,"internalType":"address","name":"startedBy","type":"address"},{"indexed":false,"internalType":"uint256","name":"startedAt","type":"uint256"}],"name":"NewRound","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"}],"name":"OwnershipTransferRequested","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"inputs":[],"name":"acceptOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"accessController","outputs":[{"internalType":"contract AccessControllerInterface","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"aggregator","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_aggregator","type":"address"}],"name":"confirmAggregator","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"description","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_roundId","type":"uint256"}],"name":"getAnswer","outputs":[{"internalType":"int256","name":"","type":"int256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint80","name":"_roundId","type":"uint80"}],"name":"getRoundData","outputs":[{"internalType":"uint80","name":"roundId","type":"uint80"},{"internalType":"int256","name":"answer","type":"int256"},{"internalType":"uint256","name":"startedAt","type":"uint256"},{"internalType":"uint256","name":"updatedAt","type":"uint256"},{"internalType":"uint80","name":"answeredInRound","type":"uint80"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_roundId","type":"uint256"}],"name":"getTimestamp","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"latestAnswer","outputs":[{"internalType":"int256","name":"","type":"int256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"latestRound","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"latestRoundData","outputs":[{"internalType":"uint80","name":"roundId","type":"uint80"},{"internalType":"int256","name":"answer","type":"int256"},{"internalType":"uint256","name":"startedAt","type":"uint256"},{"internalType":"uint256","name":"updatedAt","type":"uint256"},{"internalType":"uint80","name":"answeredInRound","type":"uint80"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"latestTimestamp","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address payable","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint16","name":"","type":"uint16"}],"name":"phaseAggregators","outputs":[{"internalType":"contract AggregatorV2V3Interface","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"phaseId","outputs":[{"internalType":"uint16","name":"","type":"uint16"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_aggregator","type":"address"}],"name":"proposeAggregator","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"proposedAggregator","outputs":[{"internalType":"contract AggregatorV2V3Interface","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint80","name":"_roundId","type":"uint80"}],"name":"proposedGetRoundData","outputs":[{"internalType":"uint80","name":"roundId","type":"uint80"},{"internalType":"int256","name":"answer","type":"int256"},{"internalType":"uint256","name":"startedAt","type":"uint256"},{"internalType":"uint256","name":"updatedAt","type":"uint256"},{"internalType":"uint80","name":"answeredInRound","type":"uint80"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"proposedLatestRoundData","outputs":[{"internalType":"uint80","name":"roundId","type":"uint80"},{"internalType":"int256","name":"answer","type":"int256"},{"internalType":"uint256","name":"startedAt","type":"uint256"},{"internalType":"uint256","name":"updatedAt","type":"uint256"},{"internalType":"uint80","name":"answeredInRound","type":"uint80"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_accessController","type":"address"}],"name":"setController","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_to","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"version","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"}]
			temp = await (setLlamaRPC(ABI_Chainlink_EUR_USD_Price_Feed, "0xb49f677943BC038e9857d61E7d053CaA2C1734C1")).methods.latestAnswer().call()
			break
		} catch(error){await errHandler(error)}
	}
	eurPrice = Number(temp/1e8)
} setInterval(update_eur_price, 1*60*1000)

async function update_eth_price() {
	let temp
	for (let i = 0; i < maxRetries; i++) {
		try {
			temp = await TRICRYPTO.methods.price_oracle(1).call()
			break
		} catch(error){await errHandler(error)}
	}
	ethPrice = Number(temp/1e18)
} setInterval(update_eth_price, 1*60*1000)

async function update_btc_price() {
	let temp
	for (let i = 0; i < maxRetries; i++) {
		try {
			temp = await TRICRYPTO.methods.price_oracle(0).call()
			break
		} catch(error){await errHandler(error)}
	}
	btcPrice = Number(temp/1e18)
} setInterval(update_btc_price, 1*60*1000)

async function get_3Crv_price(){
	const ABI_FRAX_3CRV = [{"name":"Transfer","inputs":[{"type":"address","name":"sender","indexed":true},{"type":"address","name":"receiver","indexed":true},{"type":"uint256","name":"value","indexed":false}],"anonymous":false,"type":"event"},{"name":"Approval","inputs":[{"type":"address","name":"owner","indexed":true},{"type":"address","name":"spender","indexed":true},{"type":"uint256","name":"value","indexed":false}],"anonymous":false,"type":"event"},{"name":"TokenExchange","inputs":[{"type":"address","name":"buyer","indexed":true},{"type":"int128","name":"sold_id","indexed":false},{"type":"uint256","name":"tokens_sold","indexed":false},{"type":"int128","name":"bought_id","indexed":false},{"type":"uint256","name":"tokens_bought","indexed":false}],"anonymous":false,"type":"event"},{"name":"TokenExchangeUnderlying","inputs":[{"type":"address","name":"buyer","indexed":true},{"type":"int128","name":"sold_id","indexed":false},{"type":"uint256","name":"tokens_sold","indexed":false},{"type":"int128","name":"bought_id","indexed":false},{"type":"uint256","name":"tokens_bought","indexed":false}],"anonymous":false,"type":"event"},{"name":"AddLiquidity","inputs":[{"type":"address","name":"provider","indexed":true},{"type":"uint256[2]","name":"token_amounts","indexed":false},{"type":"uint256[2]","name":"fees","indexed":false},{"type":"uint256","name":"invariant","indexed":false},{"type":"uint256","name":"token_supply","indexed":false}],"anonymous":false,"type":"event"},{"name":"RemoveLiquidity","inputs":[{"type":"address","name":"provider","indexed":true},{"type":"uint256[2]","name":"token_amounts","indexed":false},{"type":"uint256[2]","name":"fees","indexed":false},{"type":"uint256","name":"token_supply","indexed":false}],"anonymous":false,"type":"event"},{"name":"RemoveLiquidityOne","inputs":[{"type":"address","name":"provider","indexed":true},{"type":"uint256","name":"token_amount","indexed":false},{"type":"uint256","name":"coin_amount","indexed":false},{"type":"uint256","name":"token_supply","indexed":false}],"anonymous":false,"type":"event"},{"name":"RemoveLiquidityImbalance","inputs":[{"type":"address","name":"provider","indexed":true},{"type":"uint256[2]","name":"token_amounts","indexed":false},{"type":"uint256[2]","name":"fees","indexed":false},{"type":"uint256","name":"invariant","indexed":false},{"type":"uint256","name":"token_supply","indexed":false}],"anonymous":false,"type":"event"},{"name":"CommitNewAdmin","inputs":[{"type":"uint256","name":"deadline","indexed":true},{"type":"address","name":"admin","indexed":true}],"anonymous":false,"type":"event"},{"name":"NewAdmin","inputs":[{"type":"address","name":"admin","indexed":true}],"anonymous":false,"type":"event"},{"name":"CommitNewFee","inputs":[{"type":"uint256","name":"deadline","indexed":true},{"type":"uint256","name":"fee","indexed":false},{"type":"uint256","name":"admin_fee","indexed":false}],"anonymous":false,"type":"event"},{"name":"NewFee","inputs":[{"type":"uint256","name":"fee","indexed":false},{"type":"uint256","name":"admin_fee","indexed":false}],"anonymous":false,"type":"event"},{"name":"RampA","inputs":[{"type":"uint256","name":"old_A","indexed":false},{"type":"uint256","name":"new_A","indexed":false},{"type":"uint256","name":"initial_time","indexed":false},{"type":"uint256","name":"future_time","indexed":false}],"anonymous":false,"type":"event"},{"name":"StopRampA","inputs":[{"type":"uint256","name":"A","indexed":false},{"type":"uint256","name":"t","indexed":false}],"anonymous":false,"type":"event"},{"outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"constructor"},{"name":"initialize","outputs":[],"inputs":[{"type":"string","name":"_name"},{"type":"string","name":"_symbol"},{"type":"address","name":"_coin"},{"type":"uint256","name":"_decimals"},{"type":"uint256","name":"_A"},{"type":"uint256","name":"_fee"},{"type":"address","name":"_admin"}],"stateMutability":"nonpayable","type":"function","gas":470049},{"name":"decimals","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":291},{"name":"transfer","outputs":[{"type":"bool","name":""}],"inputs":[{"type":"address","name":"_to"},{"type":"uint256","name":"_value"}],"stateMutability":"nonpayable","type":"function","gas":75402},{"name":"transferFrom","outputs":[{"type":"bool","name":""}],"inputs":[{"type":"address","name":"_from"},{"type":"address","name":"_to"},{"type":"uint256","name":"_value"}],"stateMutability":"nonpayable","type":"function","gas":112037},{"name":"approve","outputs":[{"type":"bool","name":""}],"inputs":[{"type":"address","name":"_spender"},{"type":"uint256","name":"_value"}],"stateMutability":"nonpayable","type":"function","gas":37854},{"name":"get_previous_balances","outputs":[{"type":"uint256[2]","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2254},{"name":"get_balances","outputs":[{"type":"uint256[2]","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2284},{"name":"get_twap_balances","outputs":[{"type":"uint256[2]","name":""}],"inputs":[{"type":"uint256[2]","name":"_first_balances"},{"type":"uint256[2]","name":"_last_balances"},{"type":"uint256","name":"_time_elapsed"}],"stateMutability":"view","type":"function","gas":1522},{"name":"get_price_cumulative_last","outputs":[{"type":"uint256[2]","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2344},{"name":"admin_fee","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":621},{"name":"A","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":5859},{"name":"A_precise","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":5821},{"name":"get_virtual_price","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":1011891},{"name":"calc_token_amount","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"uint256[2]","name":"_amounts"},{"type":"bool","name":"_is_deposit"}],"stateMutability":"view","type":"function"},{"name":"calc_token_amount","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"uint256[2]","name":"_amounts"},{"type":"bool","name":"_is_deposit"},{"type":"bool","name":"_previous"}],"stateMutability":"view","type":"function"},{"name":"add_liquidity","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"uint256[2]","name":"_amounts"},{"type":"uint256","name":"_min_mint_amount"}],"stateMutability":"nonpayable","type":"function"},{"name":"add_liquidity","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"uint256[2]","name":"_amounts"},{"type":"uint256","name":"_min_mint_amount"},{"type":"address","name":"_receiver"}],"stateMutability":"nonpayable","type":"function"},{"name":"get_dy","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"int128","name":"i"},{"type":"int128","name":"j"},{"type":"uint256","name":"dx"}],"stateMutability":"view","type":"function"},{"name":"get_dy","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"int128","name":"i"},{"type":"int128","name":"j"},{"type":"uint256","name":"dx"},{"type":"uint256[2]","name":"_balances"}],"stateMutability":"view","type":"function"},{"name":"get_dy_underlying","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"int128","name":"i"},{"type":"int128","name":"j"},{"type":"uint256","name":"dx"}],"stateMutability":"view","type":"function"},{"name":"get_dy_underlying","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"int128","name":"i"},{"type":"int128","name":"j"},{"type":"uint256","name":"dx"},{"type":"uint256[2]","name":"_balances"}],"stateMutability":"view","type":"function"},{"name":"exchange","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"int128","name":"i"},{"type":"int128","name":"j"},{"type":"uint256","name":"dx"},{"type":"uint256","name":"min_dy"}],"stateMutability":"nonpayable","type":"function"},{"name":"exchange","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"int128","name":"i"},{"type":"int128","name":"j"},{"type":"uint256","name":"dx"},{"type":"uint256","name":"min_dy"},{"type":"address","name":"_receiver"}],"stateMutability":"nonpayable","type":"function"},{"name":"exchange_underlying","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"int128","name":"i"},{"type":"int128","name":"j"},{"type":"uint256","name":"dx"},{"type":"uint256","name":"min_dy"}],"stateMutability":"nonpayable","type":"function"},{"name":"exchange_underlying","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"int128","name":"i"},{"type":"int128","name":"j"},{"type":"uint256","name":"dx"},{"type":"uint256","name":"min_dy"},{"type":"address","name":"_receiver"}],"stateMutability":"nonpayable","type":"function"},{"name":"remove_liquidity","outputs":[{"type":"uint256[2]","name":""}],"inputs":[{"type":"uint256","name":"_burn_amount"},{"type":"uint256[2]","name":"_min_amounts"}],"stateMutability":"nonpayable","type":"function"},{"name":"remove_liquidity","outputs":[{"type":"uint256[2]","name":""}],"inputs":[{"type":"uint256","name":"_burn_amount"},{"type":"uint256[2]","name":"_min_amounts"},{"type":"address","name":"_receiver"}],"stateMutability":"nonpayable","type":"function"},{"name":"remove_liquidity_imbalance","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"uint256[2]","name":"_amounts"},{"type":"uint256","name":"_max_burn_amount"}],"stateMutability":"nonpayable","type":"function"},{"name":"remove_liquidity_imbalance","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"uint256[2]","name":"_amounts"},{"type":"uint256","name":"_max_burn_amount"},{"type":"address","name":"_receiver"}],"stateMutability":"nonpayable","type":"function"},{"name":"calc_withdraw_one_coin","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"uint256","name":"_burn_amount"},{"type":"int128","name":"i"}],"stateMutability":"view","type":"function"},{"name":"calc_withdraw_one_coin","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"uint256","name":"_burn_amount"},{"type":"int128","name":"i"},{"type":"bool","name":"_previous"}],"stateMutability":"view","type":"function"},{"name":"remove_liquidity_one_coin","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"uint256","name":"_burn_amount"},{"type":"int128","name":"i"},{"type":"uint256","name":"_min_received"}],"stateMutability":"nonpayable","type":"function"},{"name":"remove_liquidity_one_coin","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"uint256","name":"_burn_amount"},{"type":"int128","name":"i"},{"type":"uint256","name":"_min_received"},{"type":"address","name":"_receiver"}],"stateMutability":"nonpayable","type":"function"},{"name":"ramp_A","outputs":[],"inputs":[{"type":"uint256","name":"_future_A"},{"type":"uint256","name":"_future_time"}],"stateMutability":"nonpayable","type":"function","gas":152464},{"name":"stop_ramp_A","outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"function","gas":149225},{"name":"admin_balances","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"uint256","name":"i"}],"stateMutability":"view","type":"function","gas":3601},{"name":"withdraw_admin_fees","outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"function","gas":11347},{"name":"admin","outputs":[{"type":"address","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2141},{"name":"coins","outputs":[{"type":"address","name":""}],"inputs":[{"type":"uint256","name":"arg0"}],"stateMutability":"view","type":"function","gas":2280},{"name":"balances","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"uint256","name":"arg0"}],"stateMutability":"view","type":"function","gas":2310},{"name":"fee","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2231},{"name":"block_timestamp_last","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2261},{"name":"initial_A","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2291},{"name":"future_A","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2321},{"name":"initial_A_time","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2351},{"name":"future_A_time","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2381},{"name":"name","outputs":[{"type":"string","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":8813},{"name":"symbol","outputs":[{"type":"string","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":7866},{"name":"balanceOf","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"address","name":"arg0"}],"stateMutability":"view","type":"function","gas":2686},{"name":"allowance","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"address","name":"arg0"},{"type":"address","name":"arg1"}],"stateMutability":"view","type":"function","gas":2931},{"name":"totalSupply","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2531}]
	const FRAX_3CRV = setLlamaRPC(ABI_FRAX_3CRV,"0xd632f22692FaC7611d2AA1C0D552930D43CAEd3B")
	let _3Crv_price
	for (let i = 0; i < maxRetries; i++) {
		try {
			_3Crv_price = (parseInt(await FRAX_3CRV.methods.get_dy(1,0,"1000000000000000000").call()))/1e18
			break
		} catch(error){await errHandler(error)}
	}
	return _3Crv_price
}

async function getPriceFromUniswapV3(poolAddress){
    let CONTRACT = setLlamaRPC(ABI_UNISWAP_V3,poolAddress)
    let slot0
	for (let i = 0; i < maxRetries; i++) {
		try {
			slot0 = await CONTRACT.methods.slot0().call()
			break
		} catch(error){
			await errHandler(error)
		}
	}
	try{
		let sqrtPriceX96 = slot0.sqrtPriceX96
		return (sqrtPriceX96)**2 / 2**192
	} catch(error){console.log(error.message)}
}

async function update_crv_price() {
	crvPrice = ethPrice/(await getPriceFromUniswapV3("0x4c83a7f819a5c37d64b4c5a2f8238ea082fa1f4e"))
} setInterval(update_crv_price, 1*60*1000)

async function getTx(txHash) {
	while(true){
		try{
			let tx = await web3HTTP.eth.getTransaction(txHash)
			return tx
		} catch(err){
			console.log(err)
			await new Promise(resolve => setTimeout(resolve, 1000))
		}
	}
}

// runs through the stored txHashes once a minute, and removes the ones that are older than 15 seconds
// reason for this is to not confuse swap_underlyings with deposits or withdrawals
function cleanTxHashStorage(){
    for(let i = 0; i < tempTxHashStorage.length; i++){
        let now = Math.floor(new Date().getTime()/1000)
        let storedTime = tempTxHashStorage[i]["time"]
        let secondsPast = now-storedTime
        if(secondsPast>=15){
            tempTxHashStorage.splice(i,1)
        }
    }
}setInterval(cleanTxHashStorage,60000)

async function send(message){
	if(message=="abort") return
	if(telegramMessage == true) {
		bot.sendMessage(GROUP_ID, message, {parse_mode : "HTML",disable_web_page_preview :"true"})
	}
}

function hyperlink(link,name){
	return "<a href='"+link+"/'> "+name+"</a>"
}

async function convertToUSD(name,amount){
	let dollarAmount
	switch (name) {
		case "sUSD":
		case "USDC":
		case "USDT":
		case "DAI":
		case "BUSD":
		case "FRAX":
		case "USDP":
		case "crvFRAX":
			dollarAmount = amount
			break
		case "BTC":
		case "WBTC":
		case "sBTC":
			dollarAmount = btcPrice * amount
			break
		case "ETH":
		case "WETH":
		case "stETH":
		case "wstETH":
			dollarAmount = ethPrice * amount
			break
		case "iDA":
		case "iUSDC":
		case "iUSDT":
			dollarAmount = amount / 100
			break
		case "3Crv":
			dollarAmount = amount * await get_3Crv_price()
			break
		case "CRV":
			dollarAmount = amount * crvPrice
			break
		case "agEUR":
		case "ibEUR":
		case "sEUR":
		case "EURS":
		case "EURN":
		case "EURT":
			dollarAmount = amount * eurPrice
		default:
			"unknown dollar amount"
			break
	}
	return dollarAmount
}

// the Buffer consists of tx, which might be part of a sandwich, since they show up one by one, we need to store them for a bit. 
async function buildMessageFromBuffer(i,forcePush){

	let extraData = mevTxBuffer[i].extraData
	if(mevTxBuffer[i]["type"]=="classicCurveMonitor"){
		var message = await buildClassicCurveMonitorMessage(
			mevTxBuffer[i].data.blockNumber,
			extraData.sold_amount,
			extraData.bought_amount,
			extraData.token_sold_name,
			extraData.soldAddress,
			extraData.token_bought_name,
			extraData.boughtAddress,
			extraData.poolAddress,
			extraData.txHash,
			extraData.buyer,
			extraData.to,
			extraData.position,
			extraData.poolName,
			forcePush
		)
	}
	if(mevTxBuffer[i]["type"]=="Removal"){
		var message = await buildPostRemovalMessage(
			mevTxBuffer[i].data.blockNumber,
			extraData.coin_amount,
			extraData.token_removed_name,
			extraData.removedAddress,
			extraData.poolAddress,
			extraData.txHash,
			extraData.agentAddress,
			extraData.to,
			extraData.position,
			forcePush
		)
	}
	if(mevTxBuffer[i]["type"]=="Deposit"){
		var message = await buildPost_DepositMessage(
			mevTxBuffer[i].data.blockNumber,
			extraData.coinArray,
			extraData.originalPoolAddress,
			extraData.feeArray,
			extraData.poolAddress,
			extraData.txHash,
			extraData.agentAddress,
			extraData.to,
			extraData.position,
			forcePush
		)
	}
	return message
}

// tx that had been stored as pot. sandwich-tx, but were in fact not part of sandwich, are getting processed as normal tx from here on out
async function cleanMevTxBuffer(brand_new_block){
	while(true){
		if(mevTxBuffer.length==0) break
		if(mevTxBuffer[0].blockNumber<brand_new_block){
			if(!(tempTxHashStorage.find(tx => tx.txHash === mevTxBuffer[0].txHash))){
				let message = await buildMessageFromBuffer(0)
				tempTxHashStorage.push({"txHash":mevTxBuffer[0].txHash,"time":Math.floor(new Date().getTime() / 1000)})
				if(message=="abort")return
				if(typeof message == "undefined") return
				await send(message)
			}
			mevTxBuffer.shift()
		} else {
			break
		}
	}
}

async function subscribeToNewBlocks(){
	web3.eth.subscribe('newBlockHeaders', async function (error, result) {
		if (error) {
			console.error(error)
		} else {
			let brand_new_block = result.number
			//cleaning every 2nd block
			if (brand_new_block % 2 === 0) {
				await cleanMevTxBuffer(brand_new_block)
			}
		}
	})
}

function countUniqueTxHashes(arr) {
	let txHashes = arr.map(obj => obj.txHash)
	let uniqueTxHashes = new Set(txHashes)
	return uniqueTxHashes.size
}

let mevTxBuffer = []
async function mevBuffer(blockNumber,position,txHash,type,extraData,isSwapUnderlying,data){

	// first we need to solve multiple blocks getting jammed together:
	if(mevTxBuffer.length!==0){
		for(var i = 0; i < mevTxBuffer.length; i++){
			// going through the elements in mevTxBuffer, to find old entries and clear them
			if(mevTxBuffer[i].data.blockNumber !== blockNumber){
				console.log("missmatching block found, cleaning")
				let message = await buildMessageFromBuffer(i)
				mevTxBuffer.splice(i,1)
				await send(message)
			}
		}
	}

	for(const entry of mevTxBuffer) {
		if(entry.txHash==txHash){
			// if newPool and oldPool of the same tx are the same: remove doubling
			let newPool = data.address
			let oldPool = entry.data.address
			if(newPool==oldPool) return // same txHash and same pool. Remaining edge case: multiple swaps in the same pool in the same transaction
		}
	}

	mevTxBuffer.push({"blockNumber":blockNumber,"position":position,"txHash":txHash,"type":type,"extraData":extraData,"isSwapUnderlying":isSwapUnderlying,"data":data})

	let numUniqueTxHashes = countUniqueTxHashes(mevTxBuffer)

	if(numUniqueTxHashes==1){
		// can't make a sandwich with 1 slice of toast
		return
	} else if(numUniqueTxHashes==2){
		// 2 slices of toast now, center peace missing, improvise
		/*

		let buyer0 = mevTxBuffer[0].extraData.buyer
		let buyer1 = mevTxBuffer[1].extraData.buyer

		if(buyer0!==buyer1)return

		// filtering out the case of one bot doing 2 more or less unrelated arbs 
		if(mevTxBuffer[1].extraData.sold_amount/mevTxBuffer[0].extraData.bought_amount >= 2) return 

		mevTxBuffer.sort(function(a, b) {
			return a.position - b.position
		})

		await processFullSandwich(mevTxBuffer)
		*/
		return 
	} else if(numUniqueTxHashes==3){
		// fully scouted sandwich
		mevTxBuffer.sort(function(a, b) {
			return a.position - b.position
		})

		let buyer0 = mevTxBuffer[0].extraData.buyer
		let buyer2 = mevTxBuffer[2].extraData.buyer

		if(buyer0!==buyer2)return

		await processFullSandwich(mevTxBuffer)
		return
	} else {
		return
	}
}

// used to calc mev effects
async function get_dy(poolAddress,blockNumber,i,j,dx){
	const ABI_GET_DY = [HACKED_ABI_GET_DY1, HACKED_ABI_GET_DY2]

	let dy
	for (let _i = 0; _i < maxRetries; _i++) {
		try{
			for (const abi of ABI_GET_DY) {
				try {
					dy = await (set(abi, poolAddress)).methods.get_dy(i,j,dx).call(blockNumber)
					break
				} catch (err) {
					continue
				}
			}
		} catch(error){await errHandler(error)}
	}
	return dy
}

// used to calc mev effects
async function get_dy_underlying(poolAddress,blockNumber,i,j,dx){
	let CONTRACT = set(HACKED_ABI_GET_DY_UNDERLYING, poolAddress)
	let dy_underlying
	for (let n = 0; n < maxRetries; n++) {
		try {
			dy_underlying = await CONTRACT.methods.get_dy_underlying(i,j,dx).call(blockNumber)
			break
		} catch(error){await errHandler(error)}
	}
	return dy_underlying
}

async function get_lp_token_tranfer_amount(lp_tokenAddress,blockNumber,shouldAmount){

	let arr = await getTokenTransfers(lp_tokenAddress,blockNumber)

	// finding the closest Amount to VictimAmount
	let closest = arr[0]
	let minDiff = Math.abs(arr[0] - shouldAmount)
	for (let i = 1; i < arr.length; i++) {
		let diff = Math.abs(arr[i] - shouldAmount)
		if (diff < minDiff) {
			closest = arr[i]
			minDiff = diff
		}
	}

	return closest
}

// using the metaregistry to get the LP Token Address from the Pool (used to spot transfer- "mint" -events)
async function get_lp_token(poolAddress){
	let curveJSON = JSON.parse(fs.readFileSync("CurvePoolData.json"))
	return curveJSON[poolAddress].lp_token
}

// using the metaregistry to get the array which holds the tokenAddresses of the Tokens of the Pool
async function get_coins(poolAddress){
	let curveJSON = JSON.parse(fs.readFileSync("CurvePoolData.json"))
	if(typeof curveJSON[poolAddress] !== "undefined"){
		return curveJSON[poolAddress].coins
	} else {
		let pools = getCurvePools()
		for(var pool in pools){
			if((pools[pool]).toLowerCase() == poolAddress){
				return curveJSON[pools[pool]].coins
			}
		}
	}
}

async function get_base_pool(poolAddress){
	let curveJSON = JSON.parse(fs.readFileSync("CurvePoolData.json"))
	return curveJSON[poolAddress].base_pool
}

// returns the number of minted lp token
async function getAmountMintedByDeposit(blockNumber,shouldAmount,lp_tokenAddress){     
	let lp_token_tranfer_amount = await get_lp_token_tranfer_amount(lp_tokenAddress,blockNumber,shouldAmount)
	return lp_token_tranfer_amount
}

// returns the mint amount for a pool at a given block and with given deposit amounts
async function calc_token_amount(poolAddress,blockNumber,amounts){
	let CONTRACT = set(HACKED_ABI_CALC_TOKEN_AMOUNT, poolAddress)
	let deposit = true
	let token_amount
	for (let i = 0; i < maxRetries; i++) {
		try {
			token_amount = await CONTRACT.methods.calc_token_amount(amounts,deposit).call(blockNumber)
			break
		} catch(error){await errHandler(error)}
	}
	return Number(token_amount)
}

async function processFullSandwich(mevTxBuffer){
	console.log("\nprocessFullSandwich")

	// forcePush ignores the $-threshold, eg. 2M$, so sandwich tx get printed independently of their size. 
	let forcePush = true

	let victimData = mevTxBuffer[1]

	if(mevTxBuffer.length==2){

		// filtering a case of un-related swaps. The token that was bought, has to be the same Token that gets sold afterwards.
		if(mevTxBuffer[0].extraData.token_bought_name!==mevTxBuffer[1].extraData.token_sold_name) return

		var messagePosition0 = await buildMessageFromBuffer(0,forcePush)
		if(messagePosition0 == "abort") return
		var messagePosition1 = await buildMessageFromBuffer(1,forcePush)
		if(messagePosition1 == "abort") return

		for(var i = 0; i < mevTxBuffer.length; i++){
			tempTxHashStorage.push({"txHash":mevTxBuffer[i].txHash,"time":Math.floor(new Date().getTime() / 1000)})
		}

		let blockData = await web3HTTP.eth.getBlock(mevTxBuffer[0].blockNumber)
		let victimTxHash = blockData.transactions[1+mevTxBuffer[0].position]
		let victimTx = await getTx(victimTxHash)
		let to = victimTx.to
		let unkownTo
		if(to=="0x1111111254fb6c44bAC0beD2854e76F90643097d"){
			unkownTo = "  (1Inch-Swap)"
		}else{
			unkownTo = "  (Most likely not Curve-User)"
		}
		console.log("victimTx",victimTx)
		let txHashURL = "https://etherscan.io/tx/"+victimTxHash
		var messageVictim = "🥪🥪🥪 Victim: " + hyperlink(txHashURL,"Tx Hash") + unkownTo
	}else if(mevTxBuffer.length==3){

		// filtering the another case of un-related swaps
		if(mevTxBuffer[0].extraData.token_bought_name!==mevTxBuffer[2].extraData.token_sold_name)return

		var messagePosition0 = await buildMessageFromBuffer(0,forcePush)
		if(messagePosition0 == "abort") return

		var messageVictim = await buildMessageFromBuffer(1,forcePush)
		if(messageVictim == "abort") return

		var messagePosition1 = await buildMessageFromBuffer(2,forcePush)
		if(messagePosition1 == "abort") return

		// updating the txHashStorage, so messages don't get send multiple time
		for(var i = 0; i < mevTxBuffer.length; i++){
			tempTxHashStorage.push({"txHash":mevTxBuffer[i].txHash,"time":Math.floor(new Date().getTime() / 1000)})
		}

	}else if(mevTxBuffer.length==4){
		
		// filtering the another case of un-related swaps
		if(mevTxBuffer[0].extraData.token_bought_name!==mevTxBuffer[3].extraData.token_sold_name)return

		var messagePosition0 = await buildMessageFromBuffer(0,forcePush)
		let pool0 = mevTxBuffer[0].data.address
		let pool1 = mevTxBuffer[1].data.address
		if(pool0==pool1){
			var messageVictim = await buildMessageFromBuffer(1,forcePush)
			victimData = mevTxBuffer[1]
		}else{
			var messageVictim = await buildMessageFromBuffer(2,forcePush)
			victimData = mevTxBuffer[2]
		}
		var messagePosition1 = await buildMessageFromBuffer(3,forcePush)

		// updating the txHashStorage, so messages don't get send multiple time
		for(var i = 0; i < mevTxBuffer.length; i++){
			tempTxHashStorage.push({"txHash":mevTxBuffer[i].txHash,"time":Math.floor(new Date().getTime() / 1000)})
		}

	}

	console.log("\nvictimData",victimData,"\n")

	if(victimData.data.returnValues.buyer=="0x55B916Ce078eA594c10a874ba67eCc3d62e29822"){

		// exchange_underlying

		let params_decodedTx
		let addressPath
		if(victimData.data.hacked_data !== undefined){
			params_decodedTx = victimData.data.hacked_data[0]
			addressPath = params_decodedTx.value
		}

		let sold_id = victimData.data.returnValues.sold_id
		let bought_id = victimData.data.returnValues.bought_id

		let i
		let j
		let boughtAddress = victimData.extraData.boughtAddress

		if(sold_id==0){
			i = 0
			console.log("A")

			addressPath = addressPath.filter(function(s) {
				return s !== "0x0000000000000000000000000000000000000000"
			})
			let basepoolAddress = addressPath[addressPath.length - 2] // eg "0xbebc44782c7db0a1a60cb6fe97d0b483032ff1c7"
			let coinOut_ID_within_metapool = await findCoinId(basepoolAddress,boughtAddress)

			j = coinOut_ID_within_metapool + 1
		}else if(bought_id == 0){
			j = 0
			console.log("B")

			addressPath = addressPath.filter(function(s) {
				return s !== "0x0000000000000000000000000000000000000000"
			})
			let basepoolAddress = addressPath[1] // eg "0xbebc44782c7db0a1a60cb6fe97d0b483032ff1c7"
			let coinOut_ID_within_metapool = await findCoinId(basepoolAddress,boughtAddress)

			i = coinOut_ID_within_metapool + 1
		} else {
			//console.log("something weird here")
			i = sold_id
			j = bought_id
		}
		let dx = victimData.data.returnValues.tokens_sold

		let poolAddress = victimData.data.address
		let blockNumber = victimData.blockNumber - 1 // going back in time 1 block
		let dy_underlying = await get_dy_underlying(poolAddress,blockNumber,i,j,dx)
		var peacefulAmountOut = await getCleanedTokenAmount(boughtAddress,dy_underlying)

	} else if (victimData.isSwapUnderlying == "TokenExchangeUnderlying") {

		//Swap Underlying

		let poolAddress = victimData.data.address
		let blockNumber = victimData.blockNumber - 1 // going back in time 1 block
		let basepoolAddress = await get_base_pool(poolAddress)

		let boughtAddress = victimData.extraData.boughtAddress

		let sold_id = victimData.data.returnValues.sold_id
		let bought_id = victimData.data.returnValues.bought_id

		let i
		let j

		if(sold_id==0){
			i = 0
			let coinOut_ID_within_metapool = await findCoinId(basepoolAddress,boughtAddress)
			j = coinOut_ID_within_metapool + 1
		}else if(bought_id == 0){
			j = 0
			let coinOut_ID_within_metapool = await findCoinId(basepoolAddress,boughtAddress)
			i = coinOut_ID_within_metapool + 1
		}else{
			console.log("something weird here")
		}

		let dx = victimData.data.returnValues.tokens_sold

		let dy_underlying = await get_dy_underlying(poolAddress,blockNumber,i,j,dx)
		var peacefulAmountOut = await getCleanedTokenAmount(boughtAddress,dy_underlying)
	
	} else if(victimData.type == "Deposit"){
		// Case: Added Liquidity

		let poolAddress = victimData.data.address
		let blockNumber = victimData.blockNumber - 1
		let lp_tokenAddress = await get_lp_token(poolAddress)

		let amounts = victimData.data.returnValues.token_amounts
		let peacefulAmountOut = await calc_token_amount(poolAddress,blockNumber,amounts)

		let shouldAmount = peacefulAmountOut
		let amountMintedByDeposit = await getAmountMintedByDeposit(blockNumber+1,shouldAmount,lp_tokenAddress)

		//Delta Victim
		var DELTA_VICTIM = formatForPrint((amountMintedByDeposit - peacefulAmountOut)/1e18)
		//var name = await getTokenName(lp_tokenAddress)
		var name = "LP-Token"
		var addOn2 = "Loss Victim: " + DELTA_VICTIM + " " + name
		console.log("addOn2",DELTA_VICTIM,name)

	} else if(victimData.type == "Removal"){
		// Case: Removed Liquidity

		let blockNumber = victimData.blockNumber
		let amounts = victimData.data.returnValues.token_amounts

		let poolAddress = victimData.data.address
		let ABI = await getABI(poolAddress)
		let CONTRACT = set(ABI, poolAddress)
		let LP_Needed_Peaceful
		for (let i = 0; i < maxRetries; i++) {
			try {
				LP_Needed_Peaceful = await CONTRACT.methods.calc_token_amount(amounts,false).call(blockNumber)
				break
			} catch(error){await errHandler(error)}
		}
		LP_Needed_Peaceful = Number(LP_Needed_Peaceful)

		let lp_tokenAddress = await get_lp_token(poolAddress)
		let LP_Needed_Reality = await get_lp_token_tranfer_amount(lp_tokenAddress,blockNumber,LP_Needed_Peaceful)
		var DELTA_VICTIM = formatForPrint((LP_Needed_Peaceful - LP_Needed_Reality)/1e18)
		//var name = victimData.extraData.token_removed_name
		name = "LP-Token"
		var addOn2 = "Loss Victim: " + DELTA_VICTIM + " " + name
		//

	} else if(typeof victimData.isSwapUnderlying == 'undefined'){
		// Not Underlying

		let poolAddress = victimData.extraData.poolAddress
		let blockNumber = victimData.blockNumber - 1 // going back in time 1 block
		let i = victimData.data.returnValues.sold_id
		let j = victimData.data.returnValues.bought_id
		let dx = victimData.data.returnValues.tokens_sold
		let dy = await get_dy(poolAddress,blockNumber,i,j,dx)
		let address = victimData.extraData.boughtAddress
		var peacefulAmountOut = await getCleanedTokenAmount(address,dy)
	} else {
		console.log("unkown type in processFullSandwich")
	}

	if (mevTxBuffer.length==2){
		if((mevTxBuffer[0]["type"]=="classicCurveMonitor")&&(mevTxBuffer[1]["type"]=="classicCurveMonitor")){
			//Delta MEV Bot
			let amountIn = mevTxBuffer[0].extraData.sold_amount
			let amountOut = mevTxBuffer[1].extraData.bought_amount
			var DELTA_MEV_BOT = formatForPrint(amountOut - amountIn)
			let name = mevTxBuffer[0].extraData.token_sold_name
			var addOn = "Profit MEV Bot: " + DELTA_MEV_BOT + " " + name + " 🥪"

			var addOn2 = ""
		}
	} else if (mevTxBuffer.length==3){
		if((mevTxBuffer[0]["type"]=="classicCurveMonitor")&&(mevTxBuffer[2]["type"]=="classicCurveMonitor")){
			//Delta MEV Bot
			let amountIn = mevTxBuffer[0].extraData.sold_amount
			let amountOut = mevTxBuffer[2].extraData.bought_amount
			var DELTA_MEV_BOT = formatForPrint(amountOut - amountIn)
			var coinNameBot = mevTxBuffer[0].extraData.token_sold_name
			var addOn = "Profit MEV Bot: " + DELTA_MEV_BOT + " " + coinNameBot + " 🥪"

			if (victimData.type == "classicCurveMonitor"){
				//Delta Victim
				amountOut = victimData.extraData.bought_amount
				var DELTA_VICTIM = formatForPrint(amountOut - peacefulAmountOut)
				name = victimData.extraData.token_bought_name
				var addOn2 = "Loss Victim: " + DELTA_VICTIM + " " + name
			}
		}
	} else if (mevTxBuffer.length==4){
		if((mevTxBuffer[0]["type"]=="classicCurveMonitor")&&(mevTxBuffer[3]["type"]=="classicCurveMonitor")){
			//Delta MEV Bot
			let amountIn = mevTxBuffer[0].extraData.sold_amount
			let amountOut = mevTxBuffer[3].extraData.bought_amount
			var DELTA_MEV_BOT = formatForPrint(amountOut - amountIn)
			var coinNameBot = mevTxBuffer[0].extraData.token_bought_name
			var addOn = "Profit MEV Bot: " + DELTA_MEV_BOT + " " + coinNameBot + " 🥪"

			if (victimData.type == "classicCurveMonitor"){
				//Delta Victim
				amountOut = victimData.extraData.bought_amount
				var DELTA_VICTIM = formatForPrint(amountOut - peacefulAmountOut)
				name = victimData.extraData.token_bought_name
				var addOn2 = "Loss Victim: " + DELTA_VICTIM + " " + name
			}
		}
	}

	if(writeToFile == true){
		let unixtime = (await web3HTTP.eth.getBlock(messagePosition0[1].blockNumber)).timestamp
		let MEV_entry = {
			"type":"sandwich",
            "blockNumber":messagePosition0[1].blockNumber,
            "unixtime":unixtime,
            "profit":parseFloat(DELTA_MEV_BOT.replaceAll(',', '')),
            "profitUnit": coinNameBot,
            "loss":parseFloat(DELTA_VICTIM.replaceAll(',', '')),
            "lossUnit": name,
            "tx":[messagePosition0[1],messageVictim[1],messagePosition1[1]]
        }
		let poolAddress = messagePosition0[0]
		emitter.emit("Update Table-MEV" + poolAddress,MEV_entry)
		saveTxEntry(poolAddress, MEV_entry)
	}

	if(telegramMessage == true){
		await send(messagePosition0 + "\n\n" + messageVictim + "\n\n" + messagePosition1 + "\n\n" + addOn + "\n" + addOn2)
	}
	mevTxBuffer.length = 0
}

var prevTxHash
async function buildClassicCurveMonitorMessage(blockNumber,sold_amount,bought_amount,token_sold_name,soldAddress,token_bought_name,boughtAddress,poolAddress,txHash,buyer,to,position,poolName,forcePush){
	if(txHash==prevTxHash)return
	prevTxHash = txHash
	let holderFee = "-"

	if((typeof poolName == undefined)||(poolName=="undefined")){
		console.log("pool name fetch failed for",txHash)
		poolName = "Pool"
	}
	
	let dollarAmount = "-"
	dollarAmount = await convertToUSD(token_sold_name,sold_amount)

	if(typeof dollarAmount == 'undefined'){
		dollarAmount = await convertToUSD(token_bought_name,bought_amount)
	}

	if (isNaN(dollarAmount)) {
		console.log("undefined dollarAmount when swapping",token_sold_name,"to",token_bought_name)
		return "abort"
	}

	// filter small amounts
	if(forcePush!== true){
		if(dollarAmount<dollar_filter) {
			console.log(formatForPrint(dollarAmount)+"$")
			return "abort"
		}
		if(typeof dollarAmount == "undefined"){
			console.log("abort, undefined dollarAmount sold",sold_amount,token_sold_name,"bought",bought_amount,token_bought_name,poolAddress)
			return "abort"
		}
	}

	// adding tag
	if((to.substring(2,9))=="0000000") {
		var buyers_tag = "MEV Bot"
	} else if (buyer == "0x561f551f0C65A14Df1966E5d38C19D03b03263F5"){
		var buyers_tag = "Notorious USDT-Trader"
	} else {
		var buyers_tag = "Buyer"
	}
	
	// adding position
	if(position<8){
		var position_indicator = "<i>block " + blockNumber + "</i>" + " | #" + position
	} else {
		var position_indicator = ""
	}

	// adding fee
	holderFee = (dollarAmount/100)*0.04
	if(poolAddress == "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7"){
		holderFee /=4
	}	

	dollarAmount = (Number(Number(dollarAmount).toFixed(0))).toLocaleString()
	holderFee = (Number(Number(holderFee).toFixed(0))).toLocaleString()
	
	let tokenInURL = "https://etherscan.io/token/"+soldAddress
	let tokenOutURL = "https://etherscan.io/token/"+boughtAddress
	let poolURL = "https://etherscan.io/address/"+poolAddress
	let txHashURL = "https://etherscan.io/tx/"+txHash
	let buyerURL = "https://etherscan.io/address/"+buyer

	if(dollarAmount=="NaN"){
		var dollarAddon = ""
	}else{
		var dollarAddon = " ($" + dollarAmount + ")"
	}

	sold_amount = formatForPrint(sold_amount)
	bought_amount = formatForPrint(bought_amount)

	console.log("sold", sold_amount, token_sold_name, "bought", bought_amount, token_bought_name)

	if(writeToFile == true) {
		let unixtime = (await web3HTTP.eth.getBlock(blockNumber)).timestamp
		let entry = {
			"type":"swap",
			"txHash":txHash,
			"blockNumber":blockNumber,
			"position":position,
			"trader":buyer,
			"tradeDetails":{
				"amountIn":parseFloat(sold_amount.replaceAll(',', '')),
				"nameIn":token_sold_name,
				"amountOut":parseFloat(bought_amount.replaceAll(',', '')),
				"nameOut":token_bought_name,
				"feeUSD":parseFloat(holderFee.replaceAll(',', '')),
				"valueUSD":parseFloat(dollarAmount.replaceAll(',', ''))
			},
			"unixtime":unixtime
		}

		emitter.emit("Update Table-ALL" + poolAddress,entry)
		saveTxEntry(poolAddress, entry)

		await savePriceEntry(poolAddress,blockNumber,unixtime)
		emitter.emit("Update Price-Chart" + poolAddress,unixtime)

		let balances_entry = await fetchBalanceOnce(poolAddress,blockNumber)
		emitter.emit("Update Balance-Chart" + poolAddress,balances_entry)

		return [poolAddress, entry]
	}
	
	if(telegramMessage == true){
		let message = "🚀Swap " + sold_amount + hyperlink(tokenInURL,token_sold_name) + " to " + bought_amount + hyperlink(tokenOutURL,token_bought_name) + dollarAddon
			+ "\n" + "LP & veCRV Holder Fee: $" + holderFee + "💰"
			+ "\n" + "Links:" +  hyperlink(poolURL,poolName) + " |" + hyperlink(txHashURL,"Tx Hash") + " |" + hyperlink(buyerURL,buyers_tag) + " 🦙🦙🦙"
			+ "\n" + position_indicator

		return message
	}
}

async function buildPostRemovalMessage(blockNumber,coin_amount,token_removed_name,removedAddress,poolAddress,txHash,agentAddress,to,position,forcePush){
	let dollarAmount = "-"
	dollarAmount = await convertToUSD(token_removed_name,coin_amount)

	if (isNaN(dollarAmount)) return "abort"

	// filter small amounts
	if(forcePush!== true){
		if(dollarAmount<dollar_filter) {
			console.log(formatForPrint(dollarAmount)+"$")
			return "abort"
		}
		if(typeof dollarAmount == "undefined"){
			console.log("abort, undefined dollarAmount sold",coin_amount,token_removed_name,poolAddress)
			return "abort"
		}
	}


	dollarAmount = (Number(Number(dollarAmount).toFixed(0))).toLocaleString()

	// adding tag
	if((to.substring(2,9))=="0000000") {
		var buyers_tag = "MEV Bot"
	} else if (agentAddress == "0x561f551f0C65A14Df1966E5d38C19D03b03263F5"){
		var buyers_tag = "Notorious USDT-Trader"
	} else {
		var buyers_tag = "Provider"
	}

	coin_amount = formatForPrint(coin_amount)

	let tokenURL = "https://etherscan.io/token/"+removedAddress
	let poolURL = "https://etherscan.io/address/"+poolAddress
	let txHashURL = "https://etherscan.io/tx/"+txHash
	let buyerURL = "https://etherscan.io/address/"+agentAddress

	// adding position
	if(position<8){
		var position_indicator = "<i>block " + blockNumber + "</i>" + " | #" + position
	} else {
		var position_indicator = ""
	}

	let poolName = await buildPoolName(poolAddress)

	if((typeof poolName == undefined)||(poolName=="undefined")){
		console.log("pool name fetch failed for",txHash)
		poolName = "Pool"
	}

	console.log("removed",coin_amount,token_removed_name,"from",poolName,txHash)

	if(dollarAmount=="NaN"){
		var dollarAddon = ""
	}else{
		var dollarAddon = " ($" + dollarAmount + ")"
	}

	let stakedTokenArray = []
	stakedTokenArray.push({
		"amountOut":parseFloat(coin_amount.replaceAll(',', '')),
		"nameOut":token_removed_name,
		"valueUSD":parseFloat(dollarAmount.replaceAll(',', ''))
	})
	
	if(writeToFile == true) {
		let unixtime = (await web3HTTP.eth.getBlock(blockNumber)).timestamp
		let entry = {
			"type":"remove",
			"txHash":txHash,
			"blockNumber":blockNumber,
			"position":position,
			"trader":agentAddress,
			"tradeDetails":stakedTokenArray,
			"unixtime":unixtime
		}
		emitter.emit("Update Table-ALL" + poolAddress,entry)

		saveTxEntry(poolAddress, entry)
		await savePriceEntry(poolAddress,blockNumber,unixtime)
		emitter.emit("Update Price-Chart" + poolAddress,unixtime)

		let balances_entry = await fetchBalanceOnce(poolAddress,blockNumber)
		emitter.emit("Update Balance-Chart" + poolAddress,balances_entry)

		return [poolAddress, entry]
	}

	if(telegramMessage == true){
		let message = "💰Removed " + coin_amount + hyperlink(tokenURL,token_removed_name) + dollarAddon
			+ "\n" + "Links:" +  hyperlink(poolURL,poolName) + " |" + hyperlink(txHashURL,"Tx Hash") + " |" + hyperlink(buyerURL,buyers_tag) + " 🦙🦙🦙"
			+ "\n" + position_indicator

		return message
	}
}

async function buildPost_DepositMessage(blockNumber,coinArray,originalPoolAddress,feeArray,poolAddress,txHash,agentAddress,to,position,forcePush){
	let depositedTokenString = ""
	let depositedTokenArray = []
	let dollarAmountTotal = 0
	for(const coin of coinArray) {
		let token_deposited_name = coin.token_deposited_name
		let coin_amount = coin.coin_amount

		if(Number(coin_amount)==0) continue

		let dollarAmount
		dollarAmount = await convertToUSD(token_deposited_name,coin_amount)
		if(typeof dollarAmount == "undefined"){
			dollarAmount = coin_amount
			console.log("no dollar value known for", token_deposited_name, "(undefined)")
			return "abort"
		}
		dollarAmountTotal += Number(dollarAmount)

		coin_amount = formatForPrint(coin_amount)

		let deposited_Address = coin.deposited_Address
		let tokenURL = "https://etherscan.io/token/"+deposited_Address
		depositedTokenString += coin_amount + hyperlink(tokenURL,token_deposited_name) + " | "
		depositedTokenArray.push({
			"amountIn":parseFloat(coin_amount.replaceAll(',', '')),
			"nameIn":token_deposited_name,
			"valueUSD":Number(dollarAmount)
		})
	}

	if (isNaN(dollarAmountTotal)) {
		console.log("no dollar value known for", token_deposited_name, "(NaN)")
		return "abort"
	}

	// filter small amounts
	if(forcePush!== true){
		if(dollarAmountTotal<dollar_filter) {
			console.log(formatForPrint(dollarAmountTotal)+"$")
			return "abort"
		}
		if(typeof dollarAmountTotal == "undefined"){
			console.log("abort, undefined dollarAmount sold",coinArray,poolAddress)
			return "abort"
		}
	}

	let dollarAmount = formatForPrint(dollarAmountTotal)
	depositedTokenString = depositedTokenString.slice(0,-2)
	

	// adding tag
	if((to.substring(2,9))=="0000000") {
		var buyers_tag = "MEV Bot"
	} else if (agentAddress == "0x561f551f0C65A14Df1966E5d38C19D03b03263F5"){
		var buyers_tag = "Notorious USDT-Trader"
	} else {
		var buyers_tag = "Provider"
	}
	
	// adding position
	if(position<8){
		var position_indicator = "<i>block " + blockNumber + "</i>" + " | #" + position
	} else {
		var position_indicator = ""
	}

	let poolURL = "https://etherscan.io/address/"+poolAddress
	let txHashURL = "https://etherscan.io/tx/"+txHash
	let buyerURL = "https://etherscan.io/address/"+agentAddress

	let poolName = await buildPoolName(poolAddress)

	if((typeof poolName == undefined)||(poolName=="undefined")){
		console.log("pool name fetch failed for",txHash)
		poolName = "Pool"
	}

	if((dollarAmount==0)||(dollarAmount==NaN)) {
		dollarAmount = "-"
		var dollarAddon = "" 
	} else {
		var dollarAddon = " ($" + dollarAmount + ")"
	}

	// removed, too much text for 1.5$ fee on a 5M$ deposit
	//adding LP & veCRV Holder Fees: 
	//let holderFee = await getFeesSimple(originalPoolAddress, feeArray)

	console.log("deposited",dollarAmount+"$ into",poolName,"txHash",txHash)

	if(writeToFile == true) {
		let unixtime = (await web3HTTP.eth.getBlock(blockNumber)).timestamp
		let entry = {
			"type":"deposit",
			"txHash":txHash,
			"blockNumber":blockNumber,
			"position":position,
			"trader":agentAddress,
			"tradeDetails":depositedTokenArray,
			"unixtime":unixtime
		}
		emitter.emit("Update Table-ALL" + poolAddress,entry)

		saveTxEntry(poolAddress,entry)
		await savePriceEntry(poolAddress,blockNumber,unixtime)
		emitter.emit("Update Price-Chart" + poolAddress,unixtime)

		let balances_entry = await fetchBalanceOnce(poolAddress,blockNumber)
		emitter.emit("Update Balance-Chart" + poolAddress,balances_entry)

		return [poolAddress, entry]
	}

	if(telegramMessage == true){
		let message = "💰Deposit " + depositedTokenString + dollarAddon
			//+ "\n" + "LP & veCRV Holder Fee: " + holderFee
			+ "\n" + "Links:" +  hyperlink(poolURL,poolName) + " |" + hyperlink(txHashURL,"Tx Hash") + " |" + hyperlink(buyerURL,buyers_tag) + " 🦙🦙🦙"
			+ "\n" + position_indicator

		return message
	}
}

async function post_classicCurveMonitor(blockNumber,sold_amount,bought_amount,token_sold_name,soldAddress,token_bought_name,boughtAddress,poolAddress,txHash,buyer,to,position,poolName){
	let message = await buildClassicCurveMonitorMessage(blockNumber,sold_amount,bought_amount,token_sold_name,soldAddress,token_bought_name,boughtAddress,poolAddress,txHash,buyer,to,position,poolName)
	if((typeof message == 'undefined')||(message == 'abort')) return
	await send(message)
}

async function post_Removal(blockNumber,coin_amount,token_removed_name,removedAddress,poolAddress,txHash,agentAddress,to,position){
	let message = await buildPostRemovalMessage(blockNumber,coin_amount,token_removed_name,removedAddress,poolAddress,txHash,agentAddress,to,position)
	if((typeof message == 'undefined')||(message == 'abort')) return
	await send(message)
}

async function post_Deposit(blockNumber,coinArray,originalPoolAddress,feeArray,poolAddress,txHash,agentAddress,to,position){
	let message = await buildPost_DepositMessage(blockNumber,coinArray,originalPoolAddress,feeArray,poolAddress,txHash,agentAddress,to,position)
	if((typeof message == 'undefined')||(message == 'abort')) return
	await send(message)
}

let HACKED_ABI_TokenExchange = [{"name":"TokenExchange","inputs":[{"name":"buyer","type":"address","indexed":true},{"name":"sold_id","type":"int128","indexed":false},{"name":"tokens_sold","type":"uint256","indexed":false},{"name":"bought_id","type":"int128","indexed":false},{"name":"tokens_bought","type":"uint256","indexed":false}],"anonymous":false,"type":"event"},]
let HACKED_ABI_TokenExchange2 = [{"name":"TokenExchange","inputs":[{"name":"buyer","type":"address","indexed":true},{"name":"sold_id","type":"uint256","indexed":false},{"name":"tokens_sold","type":"uint256","indexed":false},{"name":"bought_id","type":"uint256","indexed":false},{"name":"tokens_bought","type":"uint256","indexed":false}],"anonymous":false,"type":"event"}]
let HACKED_ABI_Exchange_Underlying = [{"name":"TokenExchangeUnderlying","inputs":[{"type":"address","name":"buyer","indexed":true},{"type":"int128","name":"sold_id","indexed":false},{"type":"uint256","name":"tokens_sold","indexed":false},{"type":"int128","name":"bought_id","indexed":false},{"type":"uint256","name":"tokens_bought","indexed":false}],"anonymous":false,"type":"event"}]
let HACKED_ABI_AddLiquidity = [{"name":"AddLiquidity","inputs":[{"type":"address","name":"provider","indexed":true},{"type":"uint256[3]","name":"token_amounts","indexed":false},{"type":"uint256[3]","name":"fees","indexed":false},{"type":"uint256","name":"invariant","indexed":false},{"type":"uint256","name":"token_supply","indexed":false}],"anonymous":false,"type":"event"}]
let HACKED_ABI_AddLiquidity2 =[{"name":"AddLiquidity","inputs":[{"type":"address","name":"provider","indexed":true},{"type":"uint256[4]","name":"token_amounts","indexed":false},{"type":"uint256[4]","name":"fees","indexed":false},{"type":"uint256","name":"invariant","indexed":false},{"type":"uint256","name":"token_supply","indexed":false}],"anonymous":false,"type":"event"}]
let HACKED_ABI_RemoveLiquidity = [{"name":"RemoveLiquidity","inputs":[{"type":"address","name":"provider","indexed":true},{"type":"uint256[3]","name":"token_amounts","indexed":false},{"type":"uint256[3]","name":"fees","indexed":false},{"type":"uint256","name":"token_supply","indexed":false}],"anonymous":false,"type":"event"}]
let HACKED_ABI_RemoveLiquidityOne = [{"name":"RemoveLiquidityOne","inputs":[{"type":"address","name":"provider","indexed":true},{"type":"uint256","name":"token_amount","indexed":false},{"type":"uint256","name":"coin_amount","indexed":false}],"anonymous":false,"type":"event"}]
let HACKED_ABI_RemoveLiquidityImbalance = [{"name":"RemoveLiquidityImbalance","inputs":[{"type":"address","name":"provider","indexed":true},{"type":"uint256[3]","name":"token_amounts","indexed":false},{"type":"uint256[3]","name":"fees","indexed":false},{"type":"uint256","name":"invariant","indexed":false},{"type":"uint256","name":"token_supply","indexed":false}],"anonymous":false,"type":"event"}]
let HACKED_ABI_GET_DY1 = [{"name":"get_dy","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"int128","name":"i"},{"type":"int128","name":"j"},{"type":"uint256","name":"dx"}],"constant":true,"payable":false,"type":"function","gas":3489637}]
let HACKED_ABI_GET_DY2 = [{"stateMutability":"view","type":"function","name":"get_dy","inputs":[{"name":"i","type":"uint256"},{"name":"j","type":"uint256"},{"name":"dx","type":"uint256"}],"outputs":[{"name":"","type":"uint256"}],"gas":3122}]
let HACKED_ABI_GET_DY_UNDERLYING = [{"name":"get_dy_underlying","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"int128","name":"i"},{"type":"int128","name":"j"},{"type":"uint256","name":"dx"}],"stateMutability":"view","type":"function","gas":2393485}]
let HACKED_ABI_CALC_TOKEN_AMOUNT = [{"name":"calc_token_amount","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"uint256[4]","name":"amounts"},{"type":"bool","name":"deposit"}],"constant":true,"payable":false,"type":"function","gas":6103471}]

let CurvePools = getCurvePools()

async function buildPoolName(poolAddress){
	if(poolAddress == "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7") return "3Pool"
	if(poolAddress == "0xA5407eAE9Ba41422680e2e00537571bcC53efBfD") return "sUSD v2 Swap"
	if(poolAddress == "0xD51a44d3FaE010294C616388b506AcdA1bfAAE46") return "tricrypto2"
	var poolName = ""
	let id = 0
	while(true){
		let tokenAddress = await getTokenAddress(poolAddress, id)
		if (tokenAddress == "0x0000000000000000000000000000000000000000") break
		if (typeof tokenAddress == "undefined") break
		let tokenName = await getTokenName(tokenAddress)
		id+=1
		poolName+=tokenName+"/"
	}
	poolName = poolName.slice(0, -1)
	if(poolName.length>=18) poolName = "Pool"
	return poolName
}

// first wave of susbscribing to Token Exchanges
async function activateRealTimeMonitoring(singlePoolModus,whiteListedPoolAddress){
	console.log("Real-Time-Monitoring active\n")
	for(const poolAddress of CurvePools) {
		if(singlePoolModus == true){
			// for mvp modus, we only listen to events on a single pool (susd -> whiteListedPoolAddress)
			if(poolAddress.toLocaleLowerCase() !== whiteListedPoolAddress.toLocaleLowerCase()) continue
		}
		if(poolAddress == "0x675993fB30a2d58Cd4D29d15F89B4Be9ca8765AE") console.log("init complete")

		//RemoveLiquidity
		let CONTRACT_RemoveLiquidity = new ws_KEY1.eth.Contract(HACKED_ABI_RemoveLiquidity, poolAddress)
		CONTRACT_RemoveLiquidity.events.RemoveLiquidity()
		.on("data", async (data) => {
			//if(tempTxHashStorage.find(tx => tx.txHash === data.transactionHash)) return
			await processRemoveLiquidity (data,poolAddress)
		})

		//RemoveLiquidityOne
		let CONTRACT_RemoveLiquidityOne = new ws_KEY2.eth.Contract(HACKED_ABI_RemoveLiquidityOne, poolAddress)
		CONTRACT_RemoveLiquidityOne.events.RemoveLiquidityOne()
		.on("data", async (data) => {
			//if(tempTxHashStorage.find(tx => tx.txHash === data.transactionHash)) return
			await processRemoveLiquidityOne (data,poolAddress)
		})

		//RemoveLiquidityImbalance
		let CONTRACT_RemoveLiquidityImbalance = new ws_KEY3.eth.Contract(HACKED_ABI_RemoveLiquidityImbalance, poolAddress)
		CONTRACT_RemoveLiquidityImbalance.events.RemoveLiquidityImbalance()
		.on("data", async (data) => {
			//if(tempTxHashStorage.find(tx => tx.txHash === data.transactionHash)) return
			await processRemoveLiquidityImbalance (data,poolAddress)
		})

		// AddLiquidity
		let CONTRACT_AddLiquidity = new ws_KEY4.eth.Contract(HACKED_ABI_AddLiquidity, poolAddress)
		CONTRACT_AddLiquidity.events.AddLiquidity()
		.on("data", async (data) => {
			await new Promise(resolve => setTimeout(resolve, 5000))
			await processAddLiquidity (data,poolAddress)
		})

		// TokenExchange
		let CONTRACT_TokenExchange = new ws_KEY5.eth.Contract(HACKED_ABI_TokenExchange, poolAddress)
		CONTRACT_TokenExchange.events.TokenExchange()
		.on("data", async (data) => {
			//if(tempTxHashStorage.find(tx => tx.txHash === data.transactionHash)) return
			console.log("\n new TokenExchange spotted with the following data:\n",data,"\n")
			await processTokenExchange (data,poolAddress)
		})

		// TokenExchange2
		let CONTRACT_TokenExchange2 = new ws_KEY1.eth.Contract(HACKED_ABI_TokenExchange2, poolAddress)
		CONTRACT_TokenExchange2.events.TokenExchange()
		.on("data", async (data) => {
			//if(tempTxHashStorage.find(tx => tx.txHash === data.transactionHash)) return
			console.log("\n new TokenExchange spotted with the following data:\n",data,"\n")
			await processTokenExchange (data,poolAddress)
		})

		// TokenExchangeUnderlying
		let CONTRACT_Exchange_Underlying = new ws_KEY2.eth.Contract(HACKED_ABI_Exchange_Underlying, poolAddress)
		CONTRACT_Exchange_Underlying.events.TokenExchangeUnderlying()
		.on("data", async (data) => {
			//if(tempTxHashStorage.find(tx => tx.txHash === data.transactionHash)) return
			console.log("\n new TokenExchangeUnderlying spotted with the following data:\n",data,"\n")
			await processTokenExchange (data,poolAddress,"TokenExchangeUnderlying")
		})

	}
}

// Function to retrieve the addresses of the effected token
async function getTokenAddress(poolAddress, id){

	let coins = await get_coins(poolAddress)
	return coins[id]
}

async function findCoinId(poolAddress,tokenAddress){
	for(var i = 0; i < 100; i++){
		let returnedAddress = await getTokenAddress(poolAddress, i)
		if(returnedAddress.toUpperCase()==tokenAddress.toUpperCase()) return i
		if(returnedAddress=="0x0000000000000000000000000000000000000000") return 0 // metapool coin case a la LUSD/3Pool
	}
}
	
async function getTokenDecimals(tokenAddress){
	if(tokenAddress == "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE") return 18
	if(tokenAddress == "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee") return 18

	// web3 call
	/*
	let ABI_DECIMALS = [{"constant":true,"inputs":[],"name":"decimals","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},]
	let CONTRACT = set(ABI_DECIMALS, address)
	let decimals
	for (let i = 0; i < maxRetries; i++) {
		try {
			decimals = await CONTRACT.methods.decimals().call() 
			break
		} catch(error){await errHandler(error)}
	}
	return decimals
	*/

	// local storage check up
	tokenAddress = tokenAddress.toLowerCase();
	let curveJSON = JSON.parse(fs.readFileSync("CurvePoolData.json"))
	for (const [key, value] of Object.entries(curveJSON)) {
		const index = value.coins.map(str => str.toLowerCase()).indexOf(tokenAddress)
		if (index !== -1) {
			return value.decimals[index]
		}
	}
	return null
	//
}

async function getCleanedTokenAmount(address,amount){
	let decimals = await getTokenDecimals(address)
	let cleanedTokensSold = amount/10**decimals
	return Number(cleanedTokensSold)
}

function formatForPrint(someNumber){
	someNumber = Math.abs(someNumber)
	if(someNumber>100) {
		someNumber = (Number(Number(someNumber).toFixed(0))).toLocaleString()
	} else if (someNumber>5) {
		someNumber = (Number(Number(someNumber).toFixed(2))).toLocaleString()
	} else {
		someNumber = (Number(Number(someNumber).toFixed(3))).toLocaleString()
	}
	return someNumber
}

// builds a string of fee amounts and the connected token, avoiding dollar for now
async function getFeesSimple(poolAddress, feeArray){
	let feeString = ""
	for(var i = 0; i < feeArray.length; i++){
		let tokenAddress = await getTokenAddress(poolAddress, i)
		let amount = await getCleanedTokenAmount(tokenAddress,feeArray[i])
		let name = await getTokenName(tokenAddress)
		feeString += formatForPrint(amount) + " " + name + " | "
	}
	feeString = feeString.substring(0, feeString.length - 3)
	return "<i>"+feeString+"</i>"
}

// returns an array with occured "AddLiquidity" events for a given pool and a given blockNumber
async function getAddLiquidityAmounts(CONTRACT,block){
	let AddLiquidityAmounts = []
	await CONTRACT.getPastEvents("AddLiquidity", { fromBlock: block, toBlock: block }, async function (errors, events) {
		if (errors) {
			console.log(errors)
		} else {
			for(const event of events) {
				let token_amounts = event.returnValues.token_amounts
				let valid_amounts = token_amounts.map(Number).filter(x => x > 0)
				AddLiquidityAmounts = AddLiquidityAmounts.concat(valid_amounts)
			}
		}
	})
	return AddLiquidityAmounts
}

async function getTokenTransfers(tokenAddress,block){
	let ABI_TRANSFER_EVENT = [{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"_from","type":"address"},{"indexed":true,"internalType":"address","name":"_to","type":"address"},{"indexed":false,"internalType":"uint256","name":"_value","type":"uint256"}],"name":"Transfer","type":"event"}]
	let CONTRACT = set(ABI_TRANSFER_EVENT, tokenAddress)
	let TransferAmounts = []
	await CONTRACT.getPastEvents("Transfer", { fromBlock: block, toBlock: block }, async function (errors, events) {
		if (errors) {
			console.log(errors)
		} else {
			for(const event of events) {
				let token_amounts = event.returnValues._value
				TransferAmounts.push(Number(token_amounts))
			}
		}
	})
	return TransferAmounts
}

async function getTokenAddressFromStake(poolAddress,blockNumber,coin_amount){
	let id = 0
	let ethSpotter = 0
	while(true){
		var tokenAddress = await getTokenAddress(poolAddress, id)
		if(tokenAddress=="0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE") ethSpotter = 1
		if(tokenAddress == "0x0000000000000000000000000000000000000000") break
		let transferAmounts = await getTokenTransfers(tokenAddress,blockNumber)
		for(let transferAmount of transferAmounts) {
			if(transferAmount == coin_amount) {
				return tokenAddress
			}
		}
		id+=1
	}
	if((tokenAddress=="0x0000000000000000000000000000000000000000")&&(ethSpotter==1)) {
		return "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
	}
}

// when there was an AddLiquidity-Event, we call this function
// it checks if there was a swap in the same pool in the same block
// if there wasn't any, we know for sure that it was a deposit
// if there are events, we compare txHashes. Matching txHases show it was actually just a swap

async function checkForTokenExchange(poolAddress,block,txHash){
	let data = "empty"
	let ABI_TokenExchange0 = [{"name":"TokenExchange","inputs":[{"type":"address","name":"buyer","indexed":true},{"type":"int128","name":"sold_id","indexed":false},{"type":"uint256","name":"tokens_sold","indexed":false},{"type":"int128","name":"bought_id","indexed":false},{"type":"uint256","name":"tokens_bought","indexed":false}],"anonymous":false,"type":"event"}]
	let ABI_TokenExchange1 = [{"name":"TokenExchange","inputs":[{"name":"buyer","type":"address","indexed":true},{"name":"sold_id","type":"uint256","indexed":false},{"name":"tokens_sold","type":"uint256","indexed":false},{"name":"bought_id","type":"uint256","indexed":false},{"name":"tokens_bought","type":"uint256","indexed":false}],"anonymous":false,"type":"event"}]
	let ABIS = [ABI_TokenExchange0,ABI_TokenExchange1]

	for (const ABI of ABIS) {
		let CONTRACT_Event_Exchange_Underlying = set(ABI, poolAddress)
	  
		await CONTRACT_Event_Exchange_Underlying.getPastEvents("TokenExchange", { fromBlock: block, toBlock: block }, async function (errors, events) {
			if (errors) {
				console.log(errors)
			} else {
				if (events.length !== 0) {
					data = events.find((event) => event.transactionHash === txHash)
				}
			}
		})
	}
	
	return data
}

async function checkForTokenExchangeUnderlying(poolAddress,block,txHash){
	let data = "empty"
	//used to be just: let data
	let ABI_TokenExchangeUnderlying = [{"name":"TokenExchangeUnderlying","inputs":[{"type":"address","name":"buyer","indexed":true},{"type":"int128","name":"sold_id","indexed":false},{"type":"uint256","name":"tokens_sold","indexed":false},{"type":"int128","name":"bought_id","indexed":false},{"type":"uint256","name":"tokens_bought","indexed":false}],"anonymous":false,"type":"event"}]
	let ABIS = [ABI_TokenExchangeUnderlying]

	for(const ABI of ABIS) {
		let CONTRACT_Event_Exchange_Underlying = set(ABI, poolAddress)

		await CONTRACT_Event_Exchange_Underlying.getPastEvents("TokenExchangeUnderlying", { fromBlock: block, toBlock: block }, async function (errors, events) {
			if (errors) {
				console.log(errors)
			} else {
				if (events.length !== 0) {
					data = events.find((event) => event.transactionHash === txHash)
				}
			}
		})
	}
	return data
}

// RemoveLiquidity
async function processRemoveLiquidity(data, poolAddress){
	console.log("\nRemoveLiquidity spotted\n","pool",poolAddress,"txHash",data.transactionHash,"\n")
}

// RemoveLiquidityOne
async function processRemoveLiquidityOne(data, poolAddress){
	let txHash = data.transactionHash
	let blockNumber = data.blockNumber
	let provider = data.returnValues.provider
	let type = undefined
	console.log("\nRemoveLiquidityOne spotted\n","poolAddress",poolAddress,"txHash",txHash,"\n")
	if(typeof data.event !== 'undefined'){
		if(data.event=="TokenExchange") return
	}
	if(CurvePools.includes(provider) == true){
		let data = await checkForTokenExchangeUnderlying(provider,blockNumber,txHash)
		await processTokenExchange(data, provider,"TokenExchangeUnderlying")
		return
	}
	if(provider == "0xA79828DF1850E8a3A3064576f380D90aECDD3359"){ // Curve Finance: 3Pool Deposit Zap
		console.log("aborting")
		return
	}
	console.log("proceeding")

	let coin_amount = data.returnValues.coin_amount
	let removedAddress = await getTokenAddressFromStake(poolAddress,blockNumber,coin_amount)
	coin_amount = await getCleanedTokenAmount(removedAddress,coin_amount)
	let token_removed_name = await getTokenName(removedAddress)

	let tx = await getTx(txHash)

	// might be exchange_multiple
	if(tx.to=="0x55B916Ce078eA594c10a874ba67eCc3d62e29822"){
		let decodedTx = abiDecoder.decodeMethod(tx.input)
		let methodName = decodedTx.name
		if(methodName=="exchange_multiple"){
			let route = decodedTx.params[0].value
			for(let poolAddress of route) {
				if(poolAddress=="0x0000000000000000000000000000000000000000") continue
				let data = await checkForTokenExchange(poolAddress,blockNumber,txHash)
				if(data=="empty") continue
				await processTokenExchange(data, poolAddress)
				return
			}
		}
	}

	// or just a simple exchange	
	if(tx.to=="0x97aDC08FA1D849D2C48C5dcC1DaB568B169b0267"){
		let decodedTx = abiDecoder.decodeMethod(tx.input)
		if(decodedTx.name == "exchange"){
			let _poolAddress = decodedTx.params[0].value
			let dataExchange = await checkForTokenExchange(_poolAddress,blockNumber,txHash)
			if(data!=="empty"){
				let buyer = tx.from
				let position = tx.transactionIndex
				let to = tx.to
				let poolName = await buildPoolName(_poolAddress)

				let soldAddress = await getTokenAddress(_poolAddress, decodedTx.params[1].value)
				let token_sold_name = await getTokenName(soldAddress)
				let sold_amount = dataExchange.returnValues.tokens_sold
				sold_amount = await getCleanedTokenAmount(soldAddress,sold_amount)

				let boughtAddress = await getTokenAddress(poolAddress, decodedTx.params[2].value-1)
				let token_bought_name = await getTokenName(boughtAddress)
				let bought_amount = data.returnValues.coin_amount
				bought_amount = await getCleanedTokenAmount(boughtAddress,bought_amount)

				if(position>7){
					await post_classicCurveMonitor(blockNumber,sold_amount,bought_amount,token_sold_name,soldAddress,token_bought_name,boughtAddress,_poolAddress,txHash,buyer,to,position,poolName)
				} else {
					let extraData = {
						"sold_amount":sold_amount,
						"bought_amount":bought_amount,
						"token_sold_name":token_sold_name,
						"soldAddress":soldAddress,
						"token_bought_name":token_bought_name,
						"boughtAddress":boughtAddress,
						"_poolAddress":_poolAddress,
						"txHash":txHash,
						"buyer":buyer,
						"to":to,
						"position":position,
						"poolName":poolName
					}
					await mevBuffer(blockNumber,position,txHash,"classicCurveMonitor",extraData,type,data)
				}
				return
			}
		}
		if(decodedTx.name == "remove_liquidity_one_coin"){
			poolAddress = decodedTx.params[0].value
		}
	}

	try{
		let ABI = [{"stateMutability":"view","type":"function","name":"pool","inputs":[],"outputs":[{"name":"","type":"address"}]}]
		let CONTRACT = set(ABI,data.returnValues.provider)
		for (let i = 0; i < maxRetries; i++) {
			try {
				poolAddress = await CONTRACT.methods.pool().call()
				break
			} catch(error){
				let goodError = "Returned values aren't valid, did it run Out of Gas? You might also see this error if you are not using the correct ABI for the contract you are retrieving data from, requesting data from a block number that does not exist, or querying a node which is not fully synced."
				if(error.message == goodError) continue
				await errHandler(error)
			}
		}
	}catch(err){
		console.log("no pool function found")
	}

	let agentAddress = tx.from
	let to = tx.to
	let position = tx.transactionIndex

	if(position>7){
		tempTxHashStorage.push({"txHash":txHash,"time":Math.floor(new Date().getTime() / 1000)})
		await post_Removal(blockNumber,coin_amount,token_removed_name,removedAddress,poolAddress,txHash,agentAddress,to,position)
	} else {
		let extraData = {
			"coin_amount":coin_amount,
			"token_removed_name":token_removed_name,
			"removedAddress":removedAddress,
			"poolAddress":poolAddress,
			"txHash":txHash,
			"agentAddress":agentAddress,
			"to":to,
			"position":position
		}
		await mevBuffer(blockNumber,position,txHash,"Removal",extraData,type,data)
	}
}

// RemoveLiquidityImbalance
async function processRemoveLiquidityImbalance(data, poolAddress){
	console.log("RemoveLiquidityImbalance spotted")
	console.log("poolAddress",poolAddress,"txHash",data.transactionHash)

	let curveJSON = JSON.parse(fs.readFileSync("CurvePoolData.json"))

	let type = undefined

	let txHash = data.transactionHash
	let tx = await getTx(txHash)
	let position = tx.transactionIndex
	let blockNumber = data.blockNumber

	let coin_amount = data.returnValues.token_amounts[0]
	for (var i = 0; i < data.returnValues.token_amounts.length; i++) {
		if (coin_amount < data.returnValues.token_amounts[i] ) {
			coin_amount = data.returnValues.token_amounts[i]
		}
	}

	i = data.returnValues.token_amounts.indexOf(coin_amount)
	let removedAddress = curveJSON[poolAddress].coins[i]
	let token_removed_name = curveJSON[poolAddress].coin_names[i]
	let agentAddress = tx.from
	let to = tx.to

	coin_amount = await getCleanedTokenAmount(removedAddress,coin_amount)

	if(position>7){
		tempTxHashStorage.push({"txHash":txHash,"time":Math.floor(new Date().getTime() / 1000)})
		await post_Removal(blockNumber,coin_amount,token_removed_name,removedAddress,poolAddress,txHash,agentAddress,to,position)
	} else {
		let extraData = {
			"coin_amount":coin_amount,
			"token_removed_name":token_removed_name,
			"removedAddress":removedAddress,
			"poolAddress":poolAddress,
			"txHash":txHash,
			"agentAddress":agentAddress,
			"to":to,
			"position":position
		}
		await mevBuffer(blockNumber,position,txHash,"Removal",extraData,type,data)
	}
}

// AddLiquidity
async function processAddLiquidity(data, poolAddress){
	let originalPoolAddress = poolAddress
	let txHash = data.transactionHash
	let tx = await getTx(txHash)
	let to = tx.to
	let agentAddress = tx.from
	let position = tx.transactionIndex
	let token_amounts = data.returnValues.token_amounts
	let numberOfCoins = token_amounts.length
	let provider = data.returnValues.provider
	let blockNumber = tx.blockNumber
	let type = undefined

	if(provider=="0x97aDC08FA1D849D2C48C5dcC1DaB568B169b0267"){
		//
		console.log('provider=="0x97aDC08FA1D849D2C48C5dcC1DaB568B169b0267')
	}

	if(to == "0x55B916Ce078eA594c10a874ba67eCc3d62e29822"){
		var decodedTx = abiDecoder.decodeMethod(tx.input)
		console.log(decodedTx.params[4])
		if(typeof decodedTx !== 'undefined'){
			if(decodedTx.name=="exchange_multiple"){
				if (decodedTx.params[4].value[0] !== "0x0000000000000000000000000000000000000000"){
					poolAddress = decodedTx.params[4].value[0]
				}
			}
		}
	}

	if(CurvePools.includes(provider)){
		let tempData  = await checkForTokenExchangeUnderlying(provider,blockNumber,txHash)
		if(tempData !== "empty") {
			data = tempData
			await processTokenExchange(data, provider)
			return
		}
	}
	let tempData = await checkForTokenExchange(poolAddress,blockNumber,txHash)
	if((tempData !== "empty")&&(typeof tempData !== 'undefined')) {
		data = tempData
		await processTokenExchange(data, poolAddress)
		return
	}

	//await new Promise(resolve => setTimeout(resolve, 2000))

	for(let i = 0; i < tempTxHashStorage.length; i++){
		if(data.transactionHash == tempTxHashStorage[i]["txHash"]) return
	}
	console.log("\nAddLiquidity spotted")
	console.log("poolAddress",poolAddress,"txHash",txHash)

	let coinArray = []

	let feeArray = data.returnValues.fees
	// (Curve Finance: 3Pool Deposit Zap)
	if(to == "0xA79828DF1850E8a3A3064576f380D90aECDD3359"){
		let decodedTx = abiDecoder.decodeMethod(tx.input)
		var realPool = decodedTx.params[0].value
		token_amounts = decodedTx.params[1].value
		numberOfCoins = token_amounts.length
		for(let i = 0; i < numberOfCoins; i++){
			if(token_amounts[i]==0) continue
			let coin_amount = Number(token_amounts[i])
			if(i==0){
				var deposited_Address = await getTokenAddress(realPool, i)
			} else {
				var deposited_Address = await getTokenAddress(poolAddress, i-1)
			}
			var token_deposited_name = await getTokenName(deposited_Address)
			coin_amount = await getCleanedTokenAmount(deposited_Address,coin_amount)
			coinArray.push({
				"token_deposited_name":token_deposited_name,
				"coin_amount":coin_amount,
				"deposited_Address":deposited_Address
			})
		}
	// Zap for 3pool metapools
	} else if(to == "0x97aDC08FA1D849D2C48C5dcC1DaB568B169b0267"){
		var decodedTx = abiDecoder.decodeMethod(tx.input)
		if(decodedTx["name"] == "exchange") return
		if(decodedTx["name"] !== "add_liquidity") {
			console.log("something went wrong at Zap for 3pool metapools")
			return
		}
		var realPool = decodedTx.params[0].value
		token_amounts = decodedTx.params[1].value
		numberOfCoins = token_amounts.length
		for(let i = 0; i < numberOfCoins; i++){
			if(token_amounts[i]==0) continue
			let coin_amount = Number(token_amounts[i])
			if(i==0){
				var deposited_Address = await getTokenAddress(realPool, i)
			} else {
				var deposited_Address = await getTokenAddress(poolAddress, i-1)
			}
			var token_deposited_name = await getTokenName(deposited_Address)
			coin_amount = await getCleanedTokenAmount(deposited_Address,coin_amount)
			coinArray.push({
				"token_deposited_name":token_deposited_name,
				"coin_amount":coin_amount,
				"deposited_Address":deposited_Address
			})
		}
	}else {
		for(let i = 0; i < numberOfCoins; i++){
			let coin_amount = Number(token_amounts[i])
			let deposited_Address = await getTokenAddress(poolAddress, i)
			let token_deposited_name = await getTokenName(deposited_Address)
			coin_amount = await getCleanedTokenAmount(deposited_Address,coin_amount)
			coinArray.push({
				"token_deposited_name":token_deposited_name,
				"coin_amount":coin_amount,
				"deposited_Address":deposited_Address
			})
		}
		try{
			let ABI = [{"stateMutability":"view","type":"function","name":"pool","inputs":[],"outputs":[{"name":"","type":"address"}]}]
			let CONTRACT = set(ABI,data.returnValues.provider)
			for (let i = 0; i < maxRetries; i++) {
				try {
					poolAddress = await CONTRACT.methods.pool().call()
					break
				} catch(error){await errHandler(error)}
			}
		}catch(err){
			console.log("no pool function found")
		}
	}

	if((to == "0x97aDC08FA1D849D2C48C5dcC1DaB568B169b0267") || (to == "0xA79828DF1850E8a3A3064576f380D90aECDD3359")){
		poolAddress = realPool
	}

	if(position>7){
		tempTxHashStorage.push({"txHash":txHash,"time":Math.floor(new Date().getTime() / 1000)})
		post_Deposit(blockNumber,coinArray,originalPoolAddress,feeArray,poolAddress,txHash,agentAddress,to,position)
	} else {
		let extraData = {
			"coinArray":coinArray,
			"originalPoolAddress":originalPoolAddress,
			"feeArray":feeArray,
			"poolAddress":poolAddress,
			"txHash":txHash,
			"agentAddress":agentAddress,
			"to":to,
			"position":position
		}
		await mevBuffer(blockNumber,position,txHash,"Deposit",extraData,type,data)
	}
}

// TokenExchange
async function processTokenExchange(data, poolAddress, type){

	console.log("\nprocessTokenExchange spotted")
	let returnValues = data.returnValues
	let sold_id = returnValues.sold_id
	let tokens_sold = returnValues.tokens_sold

	if(data.event == "TokenExchangeUnderlying"){
		type = "TokenExchangeUnderlying"
	}

	let token1Address = await getTokenAddress(poolAddress, 1)

	let txHash = data.transactionHash
	console.log("poolAddress",poolAddress,"type:",type,"txHash", txHash)

	let tx = await getTx(txHash)
	let to = tx.to
	let blockNumber = tx.blockNumber

	let decodedTx = abiDecoder.decodeMethod(tx.input)
	if( typeof decodedTx !== 'undefined'){
		var exchange_multiple_CHECK = decodedTx.name
		data.hacked_data = decodedTx.params
	} else {
		//console.log("decodedTx undefined")
	}
	// exchange_multiple
	if(exchange_multiple_CHECK=="exchange_multiple" && !zoom){
			console.log("\nexchange_multiple spotted",txHash)

			var soldAddress = decodedTx.params[0].value[0]
			var sold_amount = decodedTx.params[2].value
			
			sold_amount = await getCleanedTokenAmount(soldAddress,sold_amount)
			var token_sold_name = await getTokenName(soldAddress)
	
	// 3Pool
	}else if((type == "TokenExchangeUnderlying") && (token1Address == "0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490")) {
		if(sold_id == 0) {
			var soldAddress = await getTokenAddress(poolAddress, 0)
			var sold_amount = data.returnValues.tokens_sold
			sold_amount = await getCleanedTokenAmount(soldAddress,sold_amount)
			var token_sold_name = await getTokenName(soldAddress)
		}
		if(sold_id == 1) {
			var soldAddress = "0x6B175474E89094C44Da98b954EedeAC495271d0F"
			if((to == "0x55B916Ce078eA594c10a874ba67eCc3d62e29822") || (to == poolAddress)){
				var sold_amount = ((abiDecoder.decodeMethod(tx.input)).params[2].value)/10**18
			} else {
				let addedLiquidityAmounts = await getAddLiquidityAmounts(THREEPOOL,blockNumber)
				let closestDeposit = addedLiquidityAmounts.reduce((prev, curr) => Math.abs(curr - tokens_sold) < Math.abs(prev - tokens_sold) ? curr : prev)
				var sold_amount = closestDeposit/10**18
				/*
				var sold_amount = data.returnValues.tokens_sold
				sold_amount = sold_amount/10**18
				*/
			}
			var token_sold_name = "DAI"
		}
		if(sold_id == 2) {
			var soldAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
			if((to == "0x55B916Ce078eA594c10a874ba67eCc3d62e29822") || (to == poolAddress)){
				var sold_amount = ((abiDecoder.decodeMethod(tx.input)).params[2].value)/10**6
			} else {
				//example case at block 16139972 (TokenExchangeUnderlying)
				let addedLiquidityAmounts = await getAddLiquidityAmounts(THREEPOOL,blockNumber)
				let closestDeposit = addedLiquidityAmounts.reduce((prev, curr) => Math.abs(curr - tokens_sold/1e12) < Math.abs(prev - tokens_sold/1e12) ? curr : prev)
				var sold_amount = closestDeposit/10**6
				/*
				var sold_amount = data.returnValues.tokens_sold
				sold_amount = sold_amount/10**6
				*/
			}
			var token_sold_name = "USDC"
		}
		if(sold_id == 3) {
			var soldAddress = "0xdAC17F958D2ee523a2206206994597C13D831ec7"
			if((to == "0x55B916Ce078eA594c10a874ba67eCc3d62e29822") || (to == poolAddress)){
				var sold_amount = ((abiDecoder.decodeMethod(tx.input)).params[2].value)/10**6
			} else {
				
				let addedLiquidityAmounts = await getAddLiquidityAmounts(THREEPOOL,blockNumber)
				let closestDeposit = addedLiquidityAmounts.reduce((prev, curr) => Math.abs(curr - tokens_sold/1e12) < Math.abs(prev - tokens_sold/1e12) ? curr : prev)
				var sold_amount = closestDeposit/10**6
				/*
				var sold_amount = data.returnValues.tokens_sold
				sold_amount = sold_amount/10**6
				*/
			}
			var token_sold_name = "USDT"
		}
	// BTC Metapool
	} else if((type == "TokenExchangeUnderlying") && (sold_id != 0) && (token1Address == "0x075b1bb99792c9E1041bA13afEf80C91a1e70fB3")) {
		if(sold_id == 1) {
			var token_sold_name = "renBTC"
			var soldAddress = "0xEB4C2781e4ebA804CE9a9803C67d0893436bB27D"
			let addedLiquidityAmounts = await getAddLiquidityAmounts(BTC_Swap,blockNumber)
			let closestDeposit = addedLiquidityAmounts.reduce((prev, curr) => Math.abs(curr - tokens_sold) < Math.abs(prev - tokens_sold) ? curr : prev)
			var sold_amount = closestDeposit/10**8
		}
		if(sold_id == 2) {
			var token_sold_name = "WBTC"
			var soldAddress = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599"
			let addedLiquidityAmounts = await getAddLiquidityAmounts(BTC_Swap,blockNumber)
			let closestDeposit = addedLiquidityAmounts.reduce((prev, curr) => Math.abs(curr - tokens_sold) < Math.abs(prev - tokens_sold) ? curr : prev)
			var sold_amount = closestDeposit/10**8
		}
		if(sold_id == 3) {
			var token_sold_name = "sBTC"
			var soldAddress = "0xfE18be6b3Bd88A2D2A7f928d00292E7a9963CfC6"
			let addedLiquidityAmounts = await getAddLiquidityAmounts(BTC_Swap,blockNumber)
			let closestDeposit = addedLiquidityAmounts.reduce((prev, curr) => Math.abs(curr - tokens_sold) < Math.abs(prev - tokens_sold) ? curr : prev)
			var sold_amount = closestDeposit/10**18
		}

	// FRAX/USDC
	} else if((type == "TokenExchangeUnderlying") && (sold_id != 0) && (token1Address == "0x3175Df0976dFA876431C2E9eE6Bc45b65d3473CC")) {
		if(sold_id == 1) {
			var token_sold_name = "FRAX"
			var soldAddress = "0x853d955aCEf822Db058eb8505911ED77F175b99e"
			if((to == "0x55B916Ce078eA594c10a874ba67eCc3d62e29822") || (to == poolAddress)){
				var sold_amount = ((abiDecoder.decodeMethod(tx.input)).params[2].value)/10**18
			} else {
				let addedLiquidityAmounts = await getAddLiquidityAmounts(FRAXBP,blockNumber)
				let closestDeposit = addedLiquidityAmounts.reduce((prev, curr) => Math.abs(curr - tokens_sold) < Math.abs(prev - tokens_sold) ? curr : prev)
				var sold_amount = closestDeposit/10**18
			}
		}
		if(sold_id == 2) {
			var token_sold_name = "USDC"
			var soldAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
			if((to == "0x55B916Ce078eA594c10a874ba67eCc3d62e29822") || (to == poolAddress)){
				//var sold_amount = ((abiDecoder.decodeMethod(tx.input)).params[2].value)/10**6
			} else {
				let addedLiquidityAmounts = await getAddLiquidityAmounts(FRAXBP,blockNumber)
				let closestDeposit = addedLiquidityAmounts.reduce((prev, curr) => Math.abs(curr - tokens_sold) < Math.abs(prev - tokens_sold) ? curr : prev)
				var sold_amount = closestDeposit/10**6
			}
		}

	// no metapool
	} else {
		var soldAddress = await getTokenAddress(poolAddress, sold_id)
		var sold_amount = await getCleanedTokenAmount(soldAddress,tokens_sold)
		var token_sold_name = await getTokenName(soldAddress)
	}

	let bought_id = returnValues.bought_id
	let tokens_bought = returnValues.tokens_bought

	let poolName = await buildPoolName(poolAddress)

	// exchange_multiple
	if(exchange_multiple_CHECK=="exchange_multiple" && !zoom) {
		poolName = "Pool"

		let numberOfNullAddresses = decodedTx.params[0].value.filter(x => x == "0x0000000000000000000000000000000000000000").length
		var boughtAddress = decodedTx.params[0].value[decodedTx.params[0].value.length-numberOfNullAddresses-1]

		let expected = decodedTx.params[3].value

		if(boughtAddress!="0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"){
			let tokenTransfers = await getTokenTransfers(boughtAddress,blockNumber)
			var closestTransfer = tokenTransfers.reduce((prev, curr) => Math.abs(curr - expected) < Math.abs(prev - expected) ? curr : prev)
		} else {
			let _expected = decodedTx.params[3].value
			var closestTransfer = _expected
		}

		var bought_amount = await getCleanedTokenAmount(boughtAddress,closestTransfer)
		var token_bought_name = await getTokenName(boughtAddress)
	
	// 3Pool
	}else if((type == "TokenExchangeUnderlying") && (bought_id != 0) && (token1Address == "0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490")) {
		if(bought_id == 1) {
			var boughtAddress = "0x6B175474E89094C44Da98b954EedeAC495271d0F"
			var bought_amount = tokens_bought/10**18
			var token_bought_name = "DAI"
		}
		if(bought_id == 2) {
			var boughtAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
			var bought_amount = tokens_bought/10**6
			var token_bought_name = "USDC"
		}
		if(bought_id == 3) {
			var boughtAddress = "0xdAC17F958D2ee523a2206206994597C13D831ec7"
			var bought_amount = tokens_bought/10**6
			var token_bought_name = "USDT"
		}

	// BTC Metapool
	} else if ((type == "TokenExchangeUnderlying") && (bought_id != 0) && (token1Address == "0x075b1bb99792c9E1041bA13afEf80C91a1e70fB3")) {
		if(bought_id == 0) {
			var boughtAddress = await getTokenAddress(poolAddress, 0)
			console.log("boughtAddress",boughtAddress)
			var bought_amount = await getCleanedTokenAmount(boughtAddress,tokens_bought)
			console.log("bought_amount",bought_amount)
			var token_bought_name = await getTokenName(boughtAddress)
		}
		if(bought_id == 1) {
			var token_bought_name = "renBTC"
			var bought_amount = tokens_bought/10**8
			var boughtAddress = "0xEB4C2781e4ebA804CE9a9803C67d0893436bB27D"
		}
		if(bought_id == 2) {
			var token_bought_name = "WBTC"
			var bought_amount = tokens_bought/10**8
			var boughtAddress = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599"
		}
		if(bought_id == 3) {
			var token_bought_name = "sBTC"
			var bought_amount = tokens_bought/10**18
			var boughtAddress = "0xfE18be6b3Bd88A2D2A7f928d00292E7a9963CfC6"
		}
		
	// FRAX/USDC
	} else if ((type == "TokenExchangeUnderlying") && (bought_id != 0) && (token1Address == "0x3175Df0976dFA876431C2E9eE6Bc45b65d3473CC")) {
		if(bought_id == 1) {
			var boughtAddress = "0x853d955aCEf822Db058eb8505911ED77F175b99e"
			var bought_amount = tokens_bought/10**18
			var token_bought_name = "FRAX"
		}
		if(bought_id == 2) {
			var boughtAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
			var bought_amount = tokens_bought/10**6
			var token_bought_name = "USDC"
		}

	// no metapool
	} else {
		var boughtAddress = await getTokenAddress(poolAddress, bought_id)
		var bought_amount = await getCleanedTokenAmount(boughtAddress,tokens_bought)
		var token_bought_name = await getTokenName(boughtAddress)
	}

	let buyer = tx.from
	
	let position = tx.transactionIndex

	if(position>7){
		tempTxHashStorage.push({"txHash":txHash,"time":Math.floor(new Date().getTime() / 1000)})
		await post_classicCurveMonitor(blockNumber,sold_amount,bought_amount,token_sold_name,soldAddress,token_bought_name,boughtAddress,poolAddress,txHash,buyer,to,position,poolName)
	} else {
		let extraData = {
			"sold_amount":sold_amount,
			"bought_amount":bought_amount,
			"token_sold_name":token_sold_name,
			"soldAddress":soldAddress,
			"token_bought_name":token_bought_name,
			"boughtAddress":boughtAddress,
			"poolAddress":poolAddress,
			"txHash":txHash,
			"buyer":buyer,
			"to":to,
			"position":position,
			"poolName":poolName
		}
		await mevBuffer(blockNumber,position,txHash,"classicCurveMonitor",extraData,type,data)
	}
}

async function debugBlock(blockNumber, poolAddress_){
	for(const poolAddress of CurvePools) {
		if(typeof poolAddress_ !== 'undefined' && poolAddress!==poolAddress_) continue

		let ABI = await getABI(poolAddress_)
		let CONTRACT = set(ABI, poolAddress)

		//RemoveLiquidity
		for (let i = 0; i < maxRetries; i++) {
			try {
				await CONTRACT.getPastEvents("RemoveLiquidity", { fromBlock: blockNumber, toBlock: blockNumber }, async function (errors, events) {
					if (errors) {
						console.log(errors)
					} else {
						if(events.length==0) return
						for(const data of events) {
							await processRemoveLiquidity(data, poolAddress)
						}
					}
				})
				break
			} catch(error){await errHandler(error)}
		}
		
		//RemoveLiquidityOne
		for (let i = 0; i < maxRetries; i++) {
			try {
				await CONTRACT.getPastEvents("RemoveLiquidityOne", { fromBlock: blockNumber, toBlock: blockNumber }, async function (errors, events) {
					if (errors) {
						console.log(errors)
					} else {
						if(events.length==0) return
						for(const data of events) {
							await processRemoveLiquidityOne(data, poolAddress)
						}
					}
				})
				break
			} catch(error){await errHandler(error)}
		}

		//RemoveLiquidityImbalance
		for (let i = 0; i < maxRetries; i++) {
			try {
				await CONTRACT.getPastEvents("RemoveLiquidityImbalance", { fromBlock: blockNumber, toBlock: blockNumber }, async function (errors, events) {
					if (errors) {
						console.log(errors)
					} else {
						if(events.length==0) return
						for(const data of events) {
							await processRemoveLiquidityImbalance(data, poolAddress)
						}
					}
				})
				break
			} catch(error){await errHandler(error)}
		}

		// AddLiquidity
		for (let i = 0; i < maxRetries; i++) {
			try {
				await CONTRACT.getPastEvents("AddLiquidity", { fromBlock: blockNumber, toBlock: blockNumber }, async function (errors, events) {
					if (errors) {
						console.log(errors)
					} else {
						if(events.length==0) return
						for(const data of events) {
							await processAddLiquidity(data, poolAddress)
						}
					}
				})
				break
			} catch(error){await errHandler(error)}
		}

		// TokenExchange
		for (let i = 0; i < maxRetries; i++) {
			try {
				await CONTRACT.getPastEvents("TokenExchange", { fromBlock: blockNumber, toBlock: blockNumber }, async function (errors, events) {
					if (errors) {
						console.log(errors)
					} else {
						if(events.length==0) return
						for(const data of events) {
							await processTokenExchange(data, poolAddress)
						}
					}
				})
				break
			} catch(error){await errHandler(error)}
		}

		// TokenExchangeUnderlying
		for (let i = 0; i < maxRetries; i++) {
			try {
				await CONTRACT.getPastEvents("TokenExchangeUnderlying", { fromBlock: blockNumber, toBlock: blockNumber }, async function (errors, events) {
					if (errors) {
						console.log(errors)
					} else {
						if(events.length==0) return
						for(const data of events) {
							await processTokenExchange(data, poolAddress,"TokenExchangeUnderlying")
						}
					}
				})
				break
			} catch(error){await errHandler(error)}
		}
	}
}

async function scanBlockRange(oldestBlock,newestBlock,poolAddress){
	let blocksToScan = newestBlock-oldestBlock
	let scannedBlocks = 0
	for (let block = oldestBlock; block < newestBlock; block++){


		var percentage = Number(((scannedBlocks / blocksToScan) * 100).toFixed(2))
  		console.log("blocksToScan",blocksToScan,"scannedBlocks",scannedBlocks,percentage+"%")

		await debugBlock(block,poolAddress)
		scannedBlocks+=1
	}
	console.log("done")
}

let eventNames = [
	"RemoveLiquidity",
	"RemoveLiquidityOne",
	"RemoveLiquidityImbalance",
	"AddLiquidity",
	"TokenExchange",
	"TokenExchangeUnderlying"
]

async function searchEventsInBlock(blockNumber,unprocessedEventLogs){
    let foundEvents = []
    for(var poolAddress in unprocessedEventLogs){
        for(const eventName of eventNames){
            let eventSpecificLogs = unprocessedEventLogs[poolAddress][eventName]
            for(const event of eventSpecificLogs){
                if(blockNumber==event.blockNumber){
                    foundEvents.push(event)
					let eventName = event.event
					if(eventName == "RemoveLiquidity") await processRemoveLiquidity(event, poolAddress) 
					if(eventName == "RemoveLiquidityOne") await processRemoveLiquidityOne(event, poolAddress) 
					if(eventName == "RemoveLiquidityImbalance") await processRemoveLiquidityImbalance(event, poolAddress) 
					if(eventName == "AddLiquidity") await processAddLiquidity(event, poolAddress) 
					if(eventName == "TokenExchange") await processTokenExchange(event, poolAddress) 
					if(eventName == "TokenExchangeUnderlying") await processTokenExchange(event, poolAddress,"TokenExchangeUnderlying") 
                }
        
            }
        }
    }
    return foundEvents
}

async function searchFromLogsInRange(firstBlock,range){
	let unprocessedEventLogs = JSON.parse(fs.readFileSync("unprocessedEventLogs.json"))
	let last_percentage = 0
	let i = 0
    for(var blockNumber = firstBlock; blockNumber < firstBlock+range; blockNumber++){
		await cleanMevTxBuffer(blockNumber)
		let percentage = Number((i / range * 100).toFixed(0))
		//let percentage = Number((i / range * 100).toFixed(1))

		if(percentage!==last_percentage){
			//console.log(percentage, "%")
			last_percentage = percentage
		}

        await searchEventsInBlock(blockNumber,unprocessedEventLogs)
		i+=1
    }
}

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

async function collectionCycle(nextBlockToProceedProcessing,range){
	await collection()

	//  this loop is used to give the raw log collection enough time to be processed and saved.
	while(true){
		let isCollecting = JSON.parse(fs.readFileSync("collectorState.json"))
		if(isCollecting.collectingRawLogs == false) break
		await new Promise(resolve => setTimeout(resolve, 10))
	}

	await searchFromLogsInRange(nextBlockToProceedProcessing,range)
}

/**
 * does multiple things
 * goal: up to date json with sorted and processed transaction-lists
 * steps:
 * 1: removes entries older than x days (31 for mvp) from the file which stores the raw, unprocessed events (unprocessedEventLogs.json)
 * 2: adds raw log entries to the file
 * 3: processes the newly added events and stores the processed data in processedTxLog_ALL.json & processedTxLog_MEV.json
 * 4: repeats the cycle until it is truely up do date
 */
async function collectionMain(){
	let oldRange = 10

	try{
		var nextBlockToProceedProcessing = await findLastProcessedEvent("0xA5407eAE9Ba41422680e2e00537571bcC53efBfD")
	} catch(err){
		var nextBlockToProceedProcessing = await getStartBlock()
	}
	let latestBlock = await web3.eth.getBlockNumber()
	let newRange = latestBlock - nextBlockToProceedProcessing

	while(newRange!==oldRange){
		oldRange = newRange
		await collectionCycle(nextBlockToProceedProcessing,newRange)
	}
	console.log("collection completed, all events fetched and processed")
}

// toggle to have messages send out to the telegram-bot
let telegramMessage

// toggle to write the trades to the json
let writeToFile

// for mvp, only listens to new events on a single poolAddress
let singlePoolModus

// sUSD pool for mvp
let whiteListedPoolAddress

// show ExchangeMultiple zoomed into target pool (for susd in mvp)
let zoom = true

async function telegramBot(){

	// by default 2M for both main and test env, but can be set to 1$ here
	//dollar_filter = 2000000 //2M

	// toggle to have messages send out to the telegram-bot
	telegramMessage = true

	if(telegramMessage) {
		bot = new TelegramBot(token, { polling: true })
		bot.on("message", async(msg) => {
			if (msg.text == "bot u with us") {
				const chatId = msg.chat.id
				console.log(chatId)	
				await new Promise(resolve => setTimeout(resolve, 500))
				bot.sendMessage(chatId, "yes ser")
			}
		})
	}

	// toggle to write the trades to the json
	writeToFile = false

	// for mvp, only listens to new events on a single poolAddress
	singlePoolModus = false

	// show ExchangeMultiple zoomed into target pool (for susd in mvp)
	zoom = false

	//await searchFromLogsInRange(await getStartBlock(),214272)
	//await searchFromLogsInRange(16338795,1)

	await debugBlock(16412930,"0xA5407eAE9Ba41422680e2e00537571bcC53efBfD")
	await debugBlock(16412930,"0xD51a44d3FaE010294C616388b506AcdA1bfAAE46")
	//await activateRealTimeMonitoring(singlePoolModus)
	//await activateRealTimeMonitoring(singlePoolModus,"0xA5407eAE9Ba41422680e2e00537571bcC53efBfD")
	//await scanBlockRange(16241695,16253755,"0x5a6A4D54456819380173272A5E8E9B9904BdF41B")
}

async function CurveMonitor(){

	// toggle to have messages send out to the telegram-bot
	telegramMessage = false

	// toggle to write the trades to the json
	writeToFile = true

	// for mvp, only listens to new events on a single poolAddress
	singlePoolModus = true

	// show ExchangeMultiple zoomed into target pool (for susd in mvp)
	zoom = true

	// sUSD pool for mvp
	whiteListedPoolAddress = "0xA5407eAE9Ba41422680e2e00537571bcC53efBfD"

	await collectionMain()
	await activateRealTimeMonitoring(singlePoolModus,whiteListedPoolAddress)

	// using socket.io, this function will iterate over all pools and create and open a custom sockets per pool, for the frontend to connect to.
	if(mode == "local"){
		await http_SocketSetup()
	}
	if(mode == "https"){
		await https_SocketSetup()
	}

	//these belong together, otherwise mayhem 
	//await new Promise(resolve => setTimeout(resolve, 30000))
	await subscribeToNewBlocks() //should be active by default, unless during some tests

	// start with price collection
	await priceCollectionMain(whiteListedPoolAddress)

	// start with balances collection
	bootBalancesJSON()
	await(balancesCollectionMain(whiteListedPoolAddress))
}


//let mode = "local"
let mode = "https"
console.log(mode+"-mode")

await CurveMonitor()
//await telegramBot()

