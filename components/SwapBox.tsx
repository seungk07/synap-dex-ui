'use client'

import { useEffect, useState } from 'react'
import { ethers } from 'ethers'
import { toast, ToastContainer } from 'react-toastify'
import { useAccount, useDisconnect, useNetwork } from 'wagmi'
import Link from 'next/link'
import 'react-toastify/dist/ReactToastify.css'

import {
  getTokenContract,
  getSwapContract,
  isContract,
  fetchTokenMetadata,
  fetchPriceFromCoingecko,
  getFee,
  getMinReceived,
  TOKEN_CONFIGS,
  CONTRACT_ADDRESSES
} from '../lib/contract'

const SwapBox = () => {
  const { isConnected, address } = useAccount()
  const { disconnect } = useDisconnect()
  const { chain } = useNetwork()

  const chainId = chain?.id || 97
  const supportedTokens = TOKEN_CONFIGS[chainId] || []
  const contractAddress = CONTRACT_ADDRESSES[chainId]

  const [selectedToken, setSelectedToken] = useState(supportedTokens[0])
  const [decimals, setDecimals] = useState(18)
  const [symbol, setSymbol] = useState(selectedToken?.name || '')
  const [exchangeRate, setExchangeRate] = useState(10000)
  const [slippage, setSlippage] = useState(1)
  const [gasWarning, setGasWarning] = useState(false)

  const [bnbAmount, setBnbAmount] = useState('')
  const [tokenAmount, setTokenAmount] = useState('')
  const [userBalance, setUserBalance] = useState('')
  const [contractBalance, setContractBalance] = useState('')
  const [txHistory, setTxHistory] = useState<{ message: string, hash: string }[]>([])
  const [mode, setMode] = useState<'bnbToToken' | 'tokenToBnb'>('bnbToToken')
  const [loading, setLoading] = useState(false)

  const provider = typeof window !== 'undefined'
    ? new ethers.providers.Web3Provider(window.ethereum as any)
    : null

  const fetchTokenInfo = async () => {
    if (!provider || !selectedToken) return
    const isValid = await isContract(selectedToken.address, provider)
    if (!isValid) {
      toast.error('🚫 Invalid token address or not deployed on current network.')
      return
    }
    try {
      const metadata = await fetchTokenMetadata(selectedToken.address, provider)
      setDecimals(metadata.decimals)
      setSymbol(metadata.symbol)
    } catch {
      toast.error('🚫 Token metadata fetch failed.')
      setDecimals(18)
      setSymbol(selectedToken.name)
    }
  }

  const fetchBalances = async () => {
    if (!provider || !isConnected || !selectedToken) return
    const signer = provider.getSigner()
    const userAddr = await signer.getAddress()
    const token = getTokenContract(selectedToken.address, signer)
    const userBal = await token.balanceOf(userAddr)
    const contractBal = await token.balanceOf(contractAddress)
    setUserBalance(ethers.utils.formatUnits(userBal, decimals))
    setContractBalance(ethers.utils.formatUnits(contractBal, decimals))
  }

  const fetchExchangeRate = async () => {
    try {
      const bnbUsd = await fetchPriceFromCoingecko('BNB')
      if (bnbUsd && selectedToken?.usdPrice) {
        setExchangeRate(bnbUsd / selectedToken.usdPrice)
      }
    } catch {
      setExchangeRate(10000)
    }
  }

  const checkGas = async () => {
    const signer = provider?.getSigner()
    const gasPrice = await provider?.getGasPrice()
    const balance = await signer?.getBalance()
    if (balance && gasPrice) {
      const estimate = gasPrice.mul(21000)
      setGasWarning(balance.lt(estimate))
    }
  }

  const executeSwap = async () => {
    if (!provider) return
    try {
      setLoading(true)
      const signer = provider.getSigner()
      const token = getTokenContract(selectedToken.address, signer)
      const contract = getSwapContract(chainId, signer)

      if (mode === 'bnbToToken') {
        const tx = await contract.swap({ value: ethers.utils.parseEther(bnbAmount) })
        await tx.wait()
        setTxHistory(prev => [{ message: `Swapped ${bnbAmount} BNB`, hash: tx.hash }, ...prev])
        setBnbAmount('')
      } else {
        const amount = ethers.utils.parseUnits(tokenAmount, decimals)
        const allowance = await token.allowance(address, contractAddress)
        if (allowance.lt(amount)) {
          const approval = await token.approve(contractAddress, amount)
          await approval.wait()
        }
        const tx = await contract.swapBack(amount)
        await tx.wait()
        setTxHistory(prev => [{ message: `Swapped back ${tokenAmount} ${symbol}`, hash: tx.hash }, ...prev])
        setTokenAmount('')
      }

      await fetchBalances()
    } catch (err: any) {
      toast.error(`❌ Swap failed: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isConnected) {
      fetchTokenInfo()
      fetchBalances()
      fetchExchangeRate()
      checkGas()
    }
  }, [isConnected, selectedToken, txHistory])

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow mt-8 border text-center">
      <ToastContainer position="top-center" autoClose={3000} />
      <h2 className="text-xl font-bold mb-4">
        {mode === 'bnbToToken' ? `Swap BNB → ${symbol}` : `Swap ${symbol} → BNB`}
      </h2>

      <select
        className="w-full border px-3 py-2 mb-4 rounded"
        value={selectedToken.name}
        onChange={(e) => {
          const selected = supportedTokens.find(t => t.name === e.target.value)
          if (selected) setSelectedToken(selected)
        }}
      >
        {supportedTokens.map((t) => (
          <option key={t.name} value={t.name}>{t.name}</option>
        ))}
      </select>

      <div className="text-left text-sm mb-4">
        <p>💰 <strong>Your {symbol}:</strong> {Number(userBalance).toLocaleString()}</p>
        <p>🏦 <strong>Contract {symbol}:</strong> {Number(contractBalance).toLocaleString()}</p>
        <p>📊 <strong>Rate:</strong> 1 BNB ≈ {Math.floor(exchangeRate).toLocaleString()} {symbol}</p>
        <p>⚙️ <strong>Slippage:</strong>
          <input
            type="number"
            value={slippage}
            onChange={(e) => setSlippage(Number(e.target.value))}
            className="ml-2 px-2 border rounded w-16"
          /> %
        </p>
        {gasWarning && (
          <p className="text-red-600 mt-1 text-sm">⚠️ Not enough BNB to cover gas!</p>
        )}
      </div>

      <div className="space-y-2">
        {mode === 'bnbToToken' ? (
          <>
            <input
              type="number"
              value={bnbAmount}
              onChange={(e) => setBnbAmount(e.target.value)}
              placeholder="BNB Amount"
              className="w-full border px-3 py-2 rounded"
            />
            {bnbAmount && (
              <p className="text-sm text-left text-red-600">
                Fee: {parseFloat(bnbAmount) * 0.01} BNB → Net: {getMinReceived(ethers.utils.parseEther((parseFloat(bnbAmount) * 0.99).toString()), slippage).div(1e18).toFixed(4)} BNB
              </p>
            )}
          </>
        ) : (
          <>
            <input
              type="number"
              value={tokenAmount}
              onChange={(e) => setTokenAmount(e.target.value)}
              placeholder={`${symbol} Amount`}
              className="w-full border px-3 py-2 rounded"
            />
            {tokenAmount && (
              <p className="text-sm text-left text-red-600">
                Fee: {(parseFloat(tokenAmount) * 0.01).toFixed(2)} {symbol} → Net: {(parseFloat(tokenAmount) * (1 - slippage / 100) * 0.99).toFixed(2)} {symbol}
              </p>
            )}
          </>
        )}
      </div>

      <button
        onClick={executeSwap}
        disabled={loading || (!bnbAmount && !tokenAmount)}
        className="mt-4 w-full bg-green-600 text-white py-2 rounded hover:bg-green-700"
      >
        {loading ? '⏳ Processing...' : 'Swap'}
      </button>

      <button
        onClick={() => setMode(mode === 'bnbToToken' ? 'tokenToBnb' : 'bnbToToken')}
        className="mt-2 w-full border border-gray-300 py-2 rounded hover:bg-gray-50"
      >
        🔁 Switch to {mode === 'bnbToToken' ? `${symbol} → BNB` : 'BNB → ' + symbol}
      </button>

      <Link href="/dashboard">
        <button className="mt-4 w-full bg-gray-800 text-white py-2 rounded hover:bg-gray-700">
          📊 Go to Dashboard
        </button>
      </Link>

      <button
        onClick={() => disconnect()}
        className="mt-2 w-full border border-gray-400 py-2 rounded hover:bg-gray-50"
      >
        Disconnect
      </button>

      <div className="mt-6 text-left">
        <h4 className="font-semibold mb-2">Transaction History</h4>
        <ul className="list-disc ml-5 space-y-1 text-sm">
          {txHistory.map((tx, i) => (
            <li key={i}>
              {tx.message}{' '}
              <a href={`https://testnet.bscscan.com/tx/${tx.hash}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                View
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default SwapBox