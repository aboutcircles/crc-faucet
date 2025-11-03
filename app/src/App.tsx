import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { useState, useEffect } from 'react'
import { checkSafesAndAvatars } from './safeAvatarChecker'
import './App.css'
import { createPublicClient, http, parseEther } from 'viem';
import { sepolia } from 'viem/chains';

interface SafeWithAvatar {
  safeAddress: string;
  avatarInfo: any;
  trustScore?: {
    results?: Array<{
      score: number;
    }>;
  };
}

const TRUST_SCORE_THRESHOLD = Number(import.meta.env.VITE_TRUST_SCORE_THRESHOLD) || 40;

function App() {
  const { address, isConnected } = useAccount()
  const { connectors, connect } = useConnect()
  const { disconnect } = useDisconnect()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [safesWithAvatars, setSafesWithAvatars] = useState<SafeWithAvatar[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [recipientAddresses, setRecipientAddresses] = useState<{[key: string]: string}>({})
  const [addressValidation, setAddressValidation] = useState<{[key: string]: boolean}>({})
  const [ethBalanceTracking, setEthBalanceTracking] = useState<{[key: string]: { initial: bigint, tracking: boolean }}>({})
  const [ethTransferSuccess, setEthTransferSuccess] = useState<{[key: string]: boolean}>({})
  const [activeTab, setActiveTab] = useState('claim');


  const isValidEthereumAddress = (address: string): boolean => {
    return /^0x[a-fA-F0-9]{40}$/.test(address) // TODO: use ethers.utils.isAddress() to check for validity
  }

  const generateMetriUrl = (recipientAddress: string): string => {
    // Remove 0x prefix and pad to 32 bytes (64 hex chars)
    const addressWithoutPrefix = recipientAddress.slice(2)
    const abiEncodedAddress = '0x' + '0'.repeat(24) + addressWithoutPrefix
    
    const faucetOrgAddress = import.meta.env.VITE_FAUCET_ORG_ADDRESS
    const crcAmount = import.meta.env.VITE_CRC_AMOUNT
    
    return `https://app.metri.xyz/transfer/${faucetOrgAddress}/crc/${crcAmount}?data=${abiEncodedAddress}`
  }




  const trackEthBalance = async (recipientAddress: string) => {
    try {
      const sepoliaPublicClient = createPublicClient({
        chain: sepolia,
        transport: http(import.meta.env.VITE_SEPOLIA_RPC_URL)
      })

      // Get initial balance
      const initialBalance = await sepoliaPublicClient.getBalance({
        address: recipientAddress as `0x${string}`
      })

      // Update tracking state
      setEthBalanceTracking(prev => ({
        ...prev,
        [recipientAddress]: { initial: initialBalance, tracking: true }
      }))

      const threshold = parseEther('0.05')
      const checkInterval = setInterval(async () => {
        try {
          const currentBalance = await sepoliaPublicClient.getBalance({
            address: recipientAddress as `0x${string}`
          })

          if (currentBalance >= initialBalance + threshold) {
            // Balance increased by at least 0.05 ETH
            clearInterval(checkInterval)
            setEthBalanceTracking(prev => ({
              ...prev,
              [recipientAddress]: { ...prev[recipientAddress], tracking: false }
            }))
            
            // Set success state to show in-UI message
            setEthTransferSuccess(prev => ({
              ...prev,
              [recipientAddress]: true
            }))
          }
        } catch (error) {
          console.error('Error checking balance:', error)
        }
      }, 5000) // Check every 5 seconds

      // Stop tracking after 10 minutes to prevent infinite loops
      setTimeout(() => {
        clearInterval(checkInterval)
        setEthBalanceTracking(prev => ({
          ...prev,
          [recipientAddress]: { ...prev[recipientAddress], tracking: false }
        }))
      }, 600000) // 10 minutes

    } catch (error) {
      console.error('Error starting ETH balance tracking:', error)
    }
  }
  const handleAddressChange = (safeAddress: string, value: string) => {
    setRecipientAddresses(prev => ({
      ...prev,
      [safeAddress]: value
    }))
    
    if (value.trim()) {
      const isValid = isValidEthereumAddress(value.trim())
      setAddressValidation(prev => ({
        ...prev,
        [safeAddress]: isValid
      }))
      
    
    } else {
      setAddressValidation(prev => ({
        ...prev,
        [safeAddress]: false
      }))
    }
  }

  useEffect(() => {
    const fetchSafesAndAvatars = async () => {
      if (isConnected && address) {
        setIsLoading(true)
        try {
          const apiKey = import.meta.env.VITE_SAFE_API_KEY
          console.log("api ", apiKey)
          const privateKey = import.meta.env.VITE_PRIVATE_KEY
          console.log("privKey ", privateKey)
          
          if (!apiKey || !privateKey) {
            console.error('Missing environment variables: VITE_SAFE_API_KEY or VITE_PRIVATE_KEY')
            return
          }

          const result = await checkSafesAndAvatars(address, apiKey, privateKey)
          result.forEach((safe, index) => {
            console.log(`Safe #${index + 1} Avatar Info:`, safe.avatarInfo)
          })
          setSafesWithAvatars(result)
        } catch (error) {
          console.error('Error fetching safes and avatars:', error)
        } finally {
          setIsLoading(false)
        }
      } else {
        setSafesWithAvatars([])
      }
    }

    fetchSafesAndAvatars()
  }, [isConnected, address])

  return (
    <div className="app">
      <div className="header">
        <div className="header-left">
          <img src='/src/assets/CirclesLogo.png' alt="Circles Logo" className="logo" />
          <h1 className="title">Circles - Sepolia ETH Faucet</h1>
        </div>
        <div className="header-right">
          <div className="tabs">
            <button
              className={`tab-btn ${activeTab === 'claim' ? 'active' : ''}`}
              onClick={() => setActiveTab('claim')}
            >
              Claim
            </button>
            <button
              className={`tab-btn ${activeTab === 'how-it-works' ? 'active' : ''}`}
              onClick={() => setActiveTab('how-it-works')}
            >
              How it works
            </button>
          </div>
          <div className="wallet-section">
            {isConnected ? (
              <div className="connected">
                <span className="address">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
                <button onClick={() => disconnect()} className="disconnect-btn">
                  Disconnect
                </button>
              </div>
          ) : (
            <div className="wallet-dropdown">
              <button 
                className="dropdown-trigger"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              >
                Connect Wallet
                <span className={`dropdown-arrow ${isDropdownOpen ? 'open' : ''}`}>▼</span>
              </button>
              {isDropdownOpen && (
                <div className="dropdown-menu">
                  {connectors.map((connector) => (
                    <button
                      key={connector.uid}
                      onClick={() => {
                        connect({ connector })
                        setIsDropdownOpen(false)
                      }}
                      className="dropdown-item"
                    >
                      {connector.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      </div>
      
      <div className="main-content">
        {activeTab === 'claim' && (
          <>
            {!isConnected && (
              <p style={{ color: '#3B2E6E', fontFamily: 'Inter, system-ui, sans-serif', fontSize: '18px', lineHeight: '1.6' }}>Please connect your wallet using the button in the top right corner</p>
            )}
            
            {isConnected && (
              <div className="circles-profile-box" style={{ 
                border: '1px solid #3B2E6E', 
                borderRadius: '12px', 
                padding: '24px', 
                margin: '20px 0',
                backgroundColor: 'rgba(255, 255, 255, 0.8)',
                color: '#3B2E6E',
                boxShadow: '0 4px 16px rgba(59, 46, 110, 0.1)'
              }}>
                <h3 style={{ marginTop: '0', marginBottom: '16px', color: '#3B2E6E', fontFamily: 'Inter, system-ui, sans-serif', fontWeight: '700' }}>Your Circles Profile</h3>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontWeight: '600', color: '#3B2E6E', fontFamily: 'Inter, system-ui, sans-serif' }}>Connected to</span>
                  <span style={{ color: '#4582C1', fontFamily: 'Inter, monospace, sans-serif' }}>{address}</span>
                </div>
                
                {isLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontWeight: '600', color: '#3B2E6E', fontFamily: 'Inter, system-ui, sans-serif' }}>Status</span>
                    <span style={{ color: '#3B2E6E', fontFamily: 'Inter, system-ui, sans-serif' }}>Checking your Circles account and eligibility...</span>
                  </div>
                ) : safesWithAvatars.length > 0 ? (
                  <>
                    {safesWithAvatars.map((safe) => (
                      <div key={safe.safeAddress}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <span style={{ fontWeight: '600', color: '#3B2E6E', fontFamily: 'Inter, system-ui, sans-serif' }}>Avatar</span>
                          <span style={{ color: '#4582C1', fontSize: '14px', wordBreak: 'break-all', fontFamily: 'Inter, monospace, sans-serif' }}>{safe.safeAddress}</span>
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <span style={{ fontWeight: '600', color: '#3B2E6E', fontFamily: 'Inter, system-ui, sans-serif' }}>Status</span>
                          <span style={{ color: safe.avatarInfo?.isHuman ? '#4582C1' : '#F19488', fontFamily: 'Inter, system-ui, sans-serif' }}>
                            {safe.avatarInfo?.isHuman ? 
                              'Registered human' : 
                              'Not registered as human, please register as human first'
                            }
                          </span>
                        </div>
                        
                        {/* {safe.trustScore && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <span style={{ fontWeight: '600', color: '#3B2E6E', fontFamily: 'Inter, system-ui, sans-serif' }}>Trust Score</span>
                            <span style={{ color: '#4582C1', fontFamily: 'Inter, system-ui, sans-serif' }}>
                              {safe.trustScore.results && safe.trustScore.results.length > 0 ? 
                                safe.trustScore.results[0].score?.toFixed(2) : 
                                'No trust score data available'
                              }
                            </span>
                          </div>
                        )} */}

                      </div>
                    ))}
                  </>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontWeight: '600', color: '#3B2E6E', fontFamily: 'Inter, system-ui, sans-serif' }}>Status</span>
                    <span style={{ color: '#F19488', fontFamily: 'Inter, system-ui, sans-serif' }}>Connected address is not part of any Circle account 😞</span>
                  </div>
                )}
              </div>
            )}
            
            {isConnected && safesWithAvatars.length > 0 && (
              <div className="safes-section">
                {safesWithAvatars.map((safe) => (
                  safe.avatarInfo?.isHuman && 
                  safe.trustScore?.results?.[0]?.score && safe.trustScore.results[0].score > TRUST_SCORE_THRESHOLD && (
                    <div key={safe.safeAddress} style={{ backgroundColor: 'rgba(69, 130, 193, 0.1)', padding: '16px', margin: '16px 0', borderRadius: '12px', border: '1px solid rgba(69, 130, 193, 0.2)' }}>
                      <p style={{ fontFamily: 'Inter, system-ui, sans-serif', fontWeight: '600', color: '#3B2E6E' }}><strong>✅ You are eligible for claiming faucet </strong></p>
                      <p style={{ fontFamily: 'Inter, system-ui, sans-serif', fontWeight: '450', color: '#3B2E6E' }}>Please transfer {import.meta.env.VITE_CRC_AMOUNT} CRC to Faucet contract for 0.05 Sepolia ETH</p>
                      <div style={{ marginTop: '10px' }}>
                        <label htmlFor={`recipient-${safe.safeAddress}`} style={{ display: 'block', marginBottom: '8px', color: '#3B2E6E', fontFamily: 'Inter, system-ui, sans-serif', fontWeight: '500' }}>
                          Enter your recipient address on Sepolia:
                        </label>
                        <input
                          id={`recipient-${safe.safeAddress}`}
                          type="text"
                          value={recipientAddresses[safe.safeAddress] || ''}
                          onChange={(e) => handleAddressChange(safe.safeAddress, e.target.value)}
                          placeholder="0x..."
                          style={{
                            width: '100%',
                            padding: '12px',
                            borderRadius: '8px',
                            border: recipientAddresses[safe.safeAddress] 
                              ? (addressValidation[safe.safeAddress] ? '2px solid #4582C1' : '2px solid #F19488')
                              : '1px solid #3B2E6E',
                            fontSize: '14px',
                            fontFamily: 'Inter, monospace, sans-serif',
                            backgroundColor: '#F7F3EF',
                            color: '#4582C1'
                          }}
                        />
                        {recipientAddresses[safe.safeAddress] && !addressValidation[safe.safeAddress] && (
                          <p style={{ color: '#F19488', fontSize: '12px', margin: '8px 0 0 0', fontFamily: 'Inter, system-ui, sans-serif' }}>
                            Please enter a valid Ethereum address
                          </p>
                        )}
                        {recipientAddresses[safe.safeAddress] && addressValidation[safe.safeAddress] && (
                          <>
                            <p style={{ color: '#4582C1', fontSize: '12px', margin: '8px 0 0 0', fontFamily: 'Inter, system-ui, sans-serif' }}>
                              ✅ Valid Ethereum address
                            </p>
                            <a
                              href={generateMetriUrl(recipientAddresses[safe.safeAddress])}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => trackEthBalance(recipientAddresses[safe.safeAddress])}
                              style={{
                                display: 'inline-block',
                                marginTop: '16px',
                                padding: '12px 24px',
                                backgroundColor: '#3B2E6E',
                                color: 'white',
                                textDecoration: 'none',
                                borderRadius: '8px',
                                fontSize: '16px',
                                fontWeight: '600',
                                fontFamily: 'Inter, system-ui, sans-serif',
                                transition: 'all 0.2s ease',
                                boxShadow: '0 2px 8px rgba(59, 46, 110, 0.3)'
                              }}
                            >
                              Transfer with Metri now
                            </a>
                            {ethBalanceTracking[recipientAddresses[safe.safeAddress]]?.tracking && (
                              <div style={{ 
                                marginTop: '16px', 
                                padding: '16px', 
                                backgroundColor: 'rgba(241, 148, 136, 0.1)', 
                                border: '1px solid rgba(241, 148, 136, 0.3)',
                                borderRadius: '8px' 
                              }}>
                                <p className="loading-text" style={{ 
                                  color: '#F19488', 
                                  fontSize: '14px', 
                                  margin: '0',
                                  fontWeight: '600',
                                  fontFamily: 'Inter, system-ui, sans-serif'
                                }}>
                                </p>                    
                              </div>
                            )}
                            {ethTransferSuccess[recipientAddresses[safe.safeAddress]] && (
                              <div style={{ 
                                marginTop: '16px', 
                                padding: '20px', 
                                backgroundColor: 'rgba(69, 130, 193, 0.1)', 
                                border: '1px solid rgba(69, 130, 193, 0.3)',
                                borderRadius: '12px' 
                              }}>
                                <p style={{ 
                                  color: '#4582C1', 
                                  fontSize: '16px', 
                                  margin: '0 0 12px 0',
                                  fontWeight: '700',
                                  fontFamily: 'Inter, system-ui, sans-serif'
                                }}>
                                  🎉 You received 0.05 ETH!
                                </p>
                                <a 
                                  href={`https://sepolia.etherscan.io/address/${recipientAddresses[safe.safeAddress]}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    color: '#4582C1',
                                    textDecoration: 'underline',
                                    fontSize: '14px',
                                    fontFamily: 'Inter, system-ui, sans-serif',
                                    fontWeight: '500'
                                  }}
                                >
                                  Click here to check on explorer
                                </a>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )
                ))}
              </div>
            )}
          </>
        )}
        {activeTab === 'how-it-works' && (
          <div style={{ textAlign: 'left', fontFamily: 'Inter, system-ui, sans-serif' }}>
            <h2 style={{ color: '#3B2E6E', fontFamily: 'Inter, system-ui, sans-serif', fontWeight: '700', marginBottom: '24px' }}>How it works</h2>
            <p style={{ color: '#3B2E6E', lineHeight: '1.6', marginBottom: '16px', fontSize: '16px' }}>1. The connected account has to be one of the signer of Circles</p>
            <p style={{ color: '#3B2E6E', lineHeight: '1.6', marginBottom: '16px', fontSize: '16px' }}>2. The Circles account has to be registered as Human</p>
            <p style={{ color: '#3B2E6E', lineHeight: '1.6', marginBottom: '16px', fontSize: '16px' }}>3. The Trust score of the Circles account is more than 50 (This is an experimental feature)</p>
            <p style={{ color: '#3B2E6E', lineHeight: '1.6', marginBottom: '16px', fontSize: '16px' }}>4. Every Circles account can send 24 CRC and get 0.05 Sepolia ETH per day</p>
            <h2 style={{ color: '#3B2E6E', fontFamily: 'Inter, system-ui, sans-serif', fontWeight: '500', marginBottom: '24px' }}>Find out more about Circles: <a href="https://aboutcircles.com" target="_blank" rel="noopener noreferrer">https://aboutcircles.com</a></h2>          </div>
        )}
      </div>
    </div>

      )
  }

export default App
