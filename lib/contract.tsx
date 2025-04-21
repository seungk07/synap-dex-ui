import { ethers } from 'ethers'

// ---------------------
// ✅ ABI 정의
// ---------------------
const tokenAbi = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
  'function approve(address, uint256) returns (bool)',
  'function allowance(address, address) view returns (uint256)'
]

const contractAbi = [
  'function swap() payable',
  'function swapBack(uint256)'
]

const aggregatorAbi = [
  'function latestAnswer() view returns (int256)'
]

// ---------------------
// ✅ 네트워크별 주소
// ---------------------
export const CONTRACT_ADDRESSES: Record<number, string> = {
  97: '0xefaf38e43aaba4205b2b20d43f787756583c58c9', // testnet
  56: '0x메인넷_CONTRACT_주소'                      // mainnet
}

export const TOKEN_CONFIGS: Record<number, any[]> = {
  97: [
    {
      name: 'SYNAP',
      address: '0xDFAE14a349E70C88C45a8E949A383e0639C45CF0',
      usdPrice: 0.01
    }
  ],
  56: [
    {
      name: 'SYNAP',
      address: '0x메인넷_SYNAP_주소',
      usdPrice: 0.01
    },
    {
      name: 'USDT',
      address: '0x55d398326f99059ff775485246999027b3197955',
      usdPrice: 1.0
    }
  ]
}

// ---------------------
// ✅ 컨트랙트 인스턴스 생성
// ---------------------
export const getTokenContract = (tokenAddress: string, signerOrProvider: any) => {
  return new ethers.Contract(tokenAddress, tokenAbi, signerOrProvider)
}

export const getSwapContract = (chainId: number, signerOrProvider: any) => {
  const address = CONTRACT_ADDRESSES[chainId]
  return new ethers.Contract(address, contractAbi, signerOrProvider)
}

// ---------------------
// ✅ 컨트랙트 여부 확인
// ---------------------
export const isContract = async (address: string, provider: any): Promise<boolean> => {
  const code = await provider.getCode(address)
  return code && code !== '0x'
}

// ---------------------
// ✅ 토큰 메타데이터 조회
// ---------------------
export const fetchTokenMetadata = async (tokenAddress: string, provider: any) => {
  const token = getTokenContract(tokenAddress, provider)
  const [symbol, decimals] = await Promise.all([
    token.symbol(),
    token.decimals()
  ])
  return { symbol, decimals }
}

// ---------------------
// ✅ Chainlink 가격 조회
// ---------------------
export const fetchPriceFromChainlink = async (aggregatorAddress: string, provider: any) => {
  const aggregator = new ethers.Contract(aggregatorAddress, aggregatorAbi, provider)
  const price = await aggregator.latestAnswer()
  return Number(price) / 1e8
}

// ---------------------
// ✅ Coingecko 가격 조회 (Fallback)
// ---------------------
export const fetchPriceFromCoingecko = async (tokenSymbol: string): Promise<number> => {
  try {
    const symbolMap: Record<string, string> = {
      BNB: 'binancecoin',
      SYNAP: 'synapse', // 실제 등록된 이름 확인 필요
      USDT: 'tether'
    }
    const id = symbolMap[tokenSymbol] || tokenSymbol.toLowerCase()
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`)
    const data = await res.json()
    return data?.[id]?.usd || 0
  } catch {
    return 0
  }
}

// ---------------------
// ✅ 수수료 계산
// ---------------------
export const getFee = (amount: ethers.BigNumber, rate = 0.01) => {
  const fee = amount.mul(Math.floor(rate * 100)).div(100)
  const net = amount.sub(fee)
  return { fee, net }
}

// ---------------------
// ✅ 슬리피지 반영 최소 수령량 계산
// ---------------------
export const getMinReceived = (amount: ethers.BigNumber, slippage: number) => {
  return amount.mul(100 - slippage).div(100)
}