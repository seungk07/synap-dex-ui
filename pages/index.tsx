'use client'

import { useEffect } from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { InjectedConnector } from 'wagmi/connectors/injected'
import SwapBox from '../components/SwapBox'

export default function Home() {
  const { address, isConnected } = useAccount()
  const { connect } = useConnect({ connector: new InjectedConnector() })
  const { disconnect } = useDisconnect()

  useEffect(() => {
    if (typeof window !== 'undefined' && !window.ethereum) {
      alert('🦊 MetaMask is not installed. Please install it to use this DApp.')
    }
  }, [])

  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-4 py-12 font-sans bg-white text-gray-900">
      {/* 🔽 로고 */}
      <img
        src="/logo.png"
        alt="Synap Logo"
        className="w-[58px] h-[58px] object-contain rounded-full mb-3"
      />

      <h1 className="text-3xl font-bold mb-4">Synap DEX UI</h1>

      <p className="text-sm text-gray-600 mb-1">Connected Wallet:</p>

      {isConnected ? (
        <>
          <p className="text-blue-600 text-sm font-mono mb-6 break-all text-center max-w-xs">
            {address}
          </p>

          {/* ✅ 스왑 박스 */}
          <SwapBox />

          {/* 로그아웃 버튼 */}
          <button
            onClick={() => disconnect()}
            className="mt-6 px-6 py-3 bg-blue-600 text-white font-semibold rounded hover:bg-blue-700 transition"
          >
            Disconnect
          </button>
        </>
      ) : (
        <button
          onClick={() => connect()}
          className="px-6 py-3 bg-green-600 text-white font-semibold rounded hover:bg-green-700 transition"
        >
          Connect Wallet
        </button>
      )}
    </main>
  )
}