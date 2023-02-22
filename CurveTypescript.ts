type ClientToServerEvents = Record<string, never>;
type ServerToClientEvents = {
  initial_all: (dto: TransactionDto) => void;
  message: (dto: TransactionDto) => void;
};

type TransactionDto = {
  type: "swap" | "deposit" | "remove" | string;
  txHash: string;
  blockNumber: number;
  position: number;
  trader: string;
  unixtime: number;
};

type TransactionDtoSwap = TransactionDto & {
  type: "swap";
  tradeDetails: {
    amountIn: number;
    nameIn: string;
    amountOut: number;
    nameOut: string;
    feeUSD: number;
    valueUSD: number;
  };
};

type TransactionDtoDeposit = TransactionDto & {
  type: "deposit";
  tradeDetails: {
    amountIn: number;
    nameIn: string;
    valueUSD: number;
  }[];
};

type TransactionDtoRemove = TransactionDto & {
  type: "remove";
  tradeDetails: {
    amountOut: number;
    nameOut: string;
    valueUSD: number;
  }[];
};

type NamesDto = {
    data: string[];
};

type priceDto = {
    [unixtime: string]: number;
};

type balanceDto = {
    [unixtime: string]: number[];
};

type volumeDto = {
  [unixtime: string]: number;
};

type tvlDto = {
  [unixtime: string]: number;
};

type bondingCurveDto = {
  coin0: string;
  coin1: string;
  x: number[];
  y: number[];
  balance0: number;
  balance1: number;
};
