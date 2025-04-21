'use client'

import { useEffect, useState } from 'react'
import { ethers } from 'ethers'
import { useAccount } from 'wagmi'
import { toast, ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

import {
  getTokenContract,
  isContract,
  TOKEN_CONFIGS,
  CONTRACT_ADDRESSES
} from '../lib/contract'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar
} from 'recharts'

const BSC_SCAN_API = 'https://api-testnet.bscscan.com/api'
const MAX_TX_COUNT = 50
const BSC_SCAN_API_KEY = process.env.NEXT_PUBLIC_BSC_SCAN_API_KEY
const CHART_COLORS = ['#00bcd4', '#ab47bc']

const Dashboard = () => {
  const { address, isConnected } = useAccount()

  const [bnbBalance, setBnbBalance] = useState('0')
  const [tokenBalance, setTokenBalance] = useState('0')
  const [isOwner, setIsOwner] = useState(false)
  const [gasPrice, setGasPrice] = useState('0')
  const [txHistory, setTxHistory] = useState<any[]>([])
  const [totalFees, setTotalFees] = useState('0')

  const provider = typeof window !== 'undefined'
    ? new ethers.providers.Web3Provider(window.ethereum as any)
    : null

  const chainId = 97
  const token = TOKEN_CONFIGS[chainId][0]
  const tokenAddress = token.address
  const contractAddress = CONTRACT_ADDRESSES[chainId]

  const fetchDashboardData = async () => {
    if (!provider || !isConnected || !address) return

    try {
      const bnb = await provider.getBalance(contractAddress)
      setBnbBalance(ethers.utils.formatEther(bnb))
      setTotalFees(ethers.utils.formatEther(bnb))

      const tokenContract = getTokenContract(tokenAddress, provider)
      const decimals = await tokenContract.decimals()
      const tokenBal = await tokenContract.balanceOf(contractAddress)
      setTokenBalance(ethers.utils.formatUnits(tokenBal, decimals))

      const contract = new ethers.Contract(contractAddress, ['function owner() view returns (address)'], provider)
      const ownerAddr = await contract.owner()
      setIsOwner(ownerAddr.toLowerCase() === address.toLowerCase())

      const gwei = await provider.getGasPrice()
      setGasPrice(ethers.utils.formatUnits(gwei, 'gwei'))

      fetchTxHistory()
    } catch (err: any) {
      toast.error(`❌ Dashboard fetch error: ${err.message}`)
    }
  }

  const fetchTxHistory = async () => {
    try {
      const res = await fetch(`${BSC_SCAN_API}?module=account&action=txlist&address=${contractAddress}&startblock=0&endblock=99999999&page=1&offset=${MAX_TX_COUNT}&sort=desc&apikey=${BSC_SCAN_API_KEY}`)
      const json = await res.json()
      if (json.status === '1') {
        const filtered = json.result.filter((tx: any) =>
          tx.from.toLowerCase() === address?.toLowerCase() || tx.to.toLowerCase() === address?.toLowerCase()
        )
        setTxHistory(filtered.slice(0, MAX_TX_COUNT))
      } else {
        toast.warn('⚠️ No transactions found.')
      }
    } catch (err) {
      console.error('fetchTxHistory error:', err)
    }
  }

  const withdraw = async () => {
    if (!provider) return
    try {
      const signer = provider.getSigner()
      const contract = new ethers.Contract(contractAddress, ['function withdraw() public'], signer)
      const tx = await contract.withdraw()
      await tx.wait()
      toast.success('✅ BNB Withdrawn!')
      fetchDashboardData()
    } catch (err: any) {
      toast.error('❌ Withdraw failed: ' + err.message)
    }
  }

  const withdrawTokens = async () => {
    if (!provider) return
    try {
      const signer = provider.getSigner()
      const contract = new ethers.Contract(contractAddress, ['function withdrawTokens() public'], signer)
      const tx = await contract.withdrawTokens()
      await tx.wait()
      toast.success('✅ SYNAP Withdrawn!')
      fetchDashboardData()
    } catch (err: any) {
      toast.error('❌ Token withdraw failed: ' + err.message)
    }
  }

  const parseTxChartData = () => {
    return txHistory.map((tx: any) => {
      const date = new Date(parseInt(tx.timeStamp) * 1000)
      const label = `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      })}`
      return {
        name: label,
        value: Number(tx.value) / 1e18
      }
    }).reverse()
  }

  const parseBarChartByDate = () => {
    const daily: Record<string, number> = {}
    txHistory.forEach((tx: any) => {
      const date = new Date(parseInt(tx.timeStamp) * 1000)
      const day = date.toLocaleDateString()
      const value = Number(tx.value) / 1e18
      if (value > 0) {
        daily[day] = (daily[day] || 0) + value
      }
    })
    return Object.entries(daily)
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }

  const parseBalanceRatioData = () => {
    return [
      { name: 'BNB', value: parseFloat(bnbBalance) },
      { name: 'SYNAP', value: parseFloat(tokenBalance) }
    ]
  }

  useEffect(() => {
    if (isConnected) fetchDashboardData()
  }, [isConnected])

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow mt-10 border text-center">
      <ToastContainer position="top-center" autoClose={3000} />
      <h2 className="text-2xl font-bold mb-4">📊 Synap DEX Dashboard</h2>

      <div className="text-left text-sm mb-6 space-y-1">
        <p>🔗 <strong>Contract Address:</strong> {contractAddress}</p>
        <p>💰 <strong>Contract BNB:</strong> {bnbBalance} BNB</p>
        <p>🧠 <strong>Contract SYNAP:</strong> {tokenBalance} SYNAP</p>

        {isOwner && (
          <>
            <p>📈 <strong>Total Fees (BNB):</strong> {totalFees}</p>
            <p>⛽ <strong>Current Gas Price:</strong> {gasPrice} gwei</p>
          </>
        )}
      </div>

      {isOwner && (
        <>
          <button
            onClick={withdraw}
            className="w-full mb-2 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            🔓 Withdraw BNB
          </button>
          <button
            onClick={withdrawTokens}
            className="w-full py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
          >
            🪙 Withdraw SYNAP Tokens
          </button>
        </>
      )}

      <div className="mt-10 text-left">
        <h4 className="font-semibold mb-2">🧾 Your Recent Activity</h4>
        <ul className="list-disc ml-5 space-y-1 text-xs">
          {txHistory.length > 0 ? txHistory.map((tx, idx) => {
            const value = Number(tx.value) / 1e18
            return (
              <li key={idx}>
                {tx.from.substring(0, 6)} → {tx.to.substring(0, 6)} | {value.toFixed(4)} BNB{' '}
                <a
                  className="text-blue-600 hover:underline"
                  href={`https://testnet.bscscan.com/tx/${tx.hash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View
                </a>
              </li>
            )
          }) : <li>No recent activity</li>}
        </ul>
      </div>

      {/* 📈 시간별 거래량 */}
      <div className="mt-10">
        <h4 className="text-lg font-semibold mb-3">📈 Transaction Volume by Time</h4>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={parseTxChartData()}>
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke="#00bcd4" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 📊 일자별 누적 수익 */}
      <div className="mt-10">
        <h4 className="text-lg font-semibold mb-3">📊 Daily BNB Volume</h4>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={parseBarChartByDate()}>
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" fill="#ab47bc" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 🍩 보유 자산 비율 */}
      <div className="mt-10">
        <h4 className="text-lg font-semibold mb-3">🍩 Contract Holdings Ratio</h4>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={parseBalanceRatioData()}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={80}
              label
            >
              {parseBalanceRatioData().map((entry, index) => (
                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Legend />
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default Dashboard