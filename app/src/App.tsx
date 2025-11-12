import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { useState, useEffect, useRef } from 'react'
import { checkSafesAndAvatars } from './safeAvatarChecker'
import './App.css'
import CirclesLogo from './assets/CirclesLogo.png'
import { createPublicClient, http, parseAbiItem, parseEther } from 'viem';
import { sepolia, gnosis } from 'viem/chains';
import QRCode from 'qrcode';

interface SafeWithAvatar {
  safeAddress: string;
  avatarInfo: any;
  trustScore?: {
    results?: Array<{
      score: number;
    }>;
  };
  lastClaimTimestamp?: number;
  isEligible?: boolean;
}

const TRUST_SCORE_THRESHOLD = Number(import.meta.env.VITE_TRUST_SCORE_THRESHOLD) || 50;
const ONE_DAY_IN_SECONDS = 24 * 60 * 60;

// QR Code Component
function QRCodeComponent({ url }: { url: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && url) {
      QRCode.toCanvas(canvasRef.current, url, {
        width: 200,
        margin: 2,
        color: {
          dark: '#3B2E6E',
          light: '#FFFFFF'
        }
      }, (error) => {
        if (error) console.error('QR Code generation error:', error);
      });
    }
  }, [url]);

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      marginTop: '16px',
      padding: '16px',
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      borderRadius: '8px',
      border: '1px solid rgba(59, 46, 110, 0.2)'
    }}>
      <p style={{ 
        margin: '0 0 12px 0', 
        color: '#3B2E6E', 
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '14px',
        fontWeight: '500'
      }}>
        Or scan this QR code:
      </p>
      <canvas ref={canvasRef} style={{ border: '1px solid #E0E0E0', borderRadius: '4px' }} />
    </div>
  );
}

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
  const [claimAmounts, setClaimAmounts] = useState<{[key: string]: string}>({});
  const [tokenPrice, setTokenPrice] = useState<number>(Number(24000000000000000000)); // Default fallback price
  const [timers, setTimers] = useState<{[key: string]: NodeJS.Timeout | null}>({});
  const [autoProcessing, setAutoProcessing] = useState<{[key: string]: boolean}>({});


  const isValidEthereumAddress = (address: string): boolean => {
    return /^0x[a-fA-F0-9]{40}$/.test(address) // TODO: use ethers.utils.isAddress() to check for validity
  }

  const queryTokenPrice = async (): Promise<number> => {
    try {
      const gnosisPublicClient = createPublicClient({
        chain: gnosis,
        transport: http(import.meta.env.VITE_GNOSIS_RPC)
      })
      
      const faucetOrgAddress = import.meta.env.VITE_FAUCET_ORG_ADDRESS as `0x${string}`
      
      const price = await gnosisPublicClient.readContract({
        address: faucetOrgAddress,
        abi: [parseAbiItem("function faucetTokenPriceInCRC() external returns(uint256 price)")],
        functionName: 'faucetTokenPriceInCRC'
      })
      
      return Number(price)
      
    } catch (error) {
      console.error('Error querying token price:', error)
      return Number(24000000000000000000) // fallback price
    }
  }

   const generateMetriUrl = (recipientAddress: string, claimAmount: string): string => {
    // Remove 0x prefix and pad to 32 bytes (64 hex chars)
    const addressWithoutPrefix = recipientAddress.slice(2)
    const abiEncodedAddress = '0x' + '0'.repeat(24) + addressWithoutPrefix

    const faucetOrgAddress = import.meta.env.VITE_FAUCET_ORG_ADDRESS
    const crcAmount = tokenPrice * parseFloat(claimAmount) / Number(1000000000000000000 )
    
    return `https://app.metri.xyz/transfer/${faucetOrgAddress}/crc/${crcAmount}?data=${abiEncodedAddress}`
  }

  const checkLastClaimTimestamp = async (avatarAddress: string): Promise<number> => {
    try {
      const gnosisPublicClient = createPublicClient({
        chain: gnosis,
        transport: http(import.meta.env.VITE_GNOSIS_RPC)
      })

      const faucetOrgAddress = import.meta.env.VITE_FAUCET_ORG_ADDRESS as `0x${string}`
      
      const lastClaim = await gnosisPublicClient.readContract({
        address: faucetOrgAddress,
        abi: [parseAbiItem("function lastClaimTimestamp(address avatar) external returns(uint256 lastClaim)")],
        functionName: 'lastClaimTimestamp',
        args: [avatarAddress as `0x${string}`]
      })

      return Number(lastClaim)
    } catch (error) {
      console.error('Error checking last claim timestamp:', error)
      return 0
    }
  }

  const checkEligibility = (safe: SafeWithAvatar): boolean => {
    // Must be registered as human
    if (!safe.avatarInfo?.isHuman) {
      return false
    }

    const currentTimestamp = Math.floor(Date.now() / 1000)
    const lastClaim = safe.lastClaimTimestamp || 0
    
    // Check if more than 1 day has passed since last claim or no claim yet
    const canClaimByTime = lastClaim === 0 || (currentTimestamp - lastClaim) > ONE_DAY_IN_SECONDS
    
    // Check trust score
    const trustScore = safe.trustScore?.results?.[0]?.score || 0
    const canClaimByTrust = trustScore > TRUST_SCORE_THRESHOLD
    
    // User is eligible if they meet the time requirement OR have sufficient trust score
    return canClaimByTime && canClaimByTrust
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

  const handleClaimAmountChange = (safeAddress: string, amount: string) => {
    setClaimAmounts(prev => ({
      ...prev,
      [safeAddress]: amount
    }))
  }

  useEffect(() => {
    const fetchSafesAndAvatars = async () => {
      if (isConnected && address) {
        setIsLoading(true)
        try {
          const apiKey = import.meta.env.VITE_SAFE_API_KEY


          if (!apiKey) {
            console.error('Missing environment variables: VITE_SAFE_API_KEY')
            return
          }

          const result = await checkSafesAndAvatars(address, apiKey)
          
          // Check last claim timestamps and calculate eligibility for each safe
          const safesWithEligibility = await Promise.all(
            result.map(async (safe) => {
              const lastClaimTimestamp = await checkLastClaimTimestamp(safe.safeAddress)
              const isEligible = checkEligibility({
                ...safe,
                lastClaimTimestamp
              })
              
              console.log(`Safe #${result.indexOf(safe) + 1} Avatar Info:`, safe.avatarInfo)
              console.log(`Last claim timestamp: ${lastClaimTimestamp}, Eligible: ${isEligible}`)
              
              return {
                ...safe,
                lastClaimTimestamp,
                isEligible
              }
            })
          )
          
          setSafesWithAvatars(safesWithEligibility)
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

  // Load token price when component mounts
  useEffect(() => {
    const loadTokenPrice = async () => {
      try {
        const price = await queryTokenPrice()
        setTokenPrice(price)
      } catch (error) {
        console.error('Error loading token price:', error)
        // Keep default fallback price
      }
    }
    loadTokenPrice()
  }, [])

  // Start timer when claim amount is selected
  useEffect(() => {
    Object.keys(claimAmounts).forEach(safeAddress => {
      const recipientAddress = recipientAddresses[safeAddress];
      
      // Only start timer if recipient address exists and not already tracking/processing
      if (recipientAddress && 
          !ethBalanceTracking[recipientAddress]?.tracking && 
          !autoProcessing[recipientAddress]) {
        
        // Clear existing timer for this address
        if (timers[recipientAddress]) {
          clearTimeout(timers[recipientAddress]!);
        }
        
        // Start new 30-second timer
        const timer = setTimeout(() => {
          // Auto-trigger ETH balance tracking
          setAutoProcessing(prev => ({
            ...prev,
            [recipientAddress]: true
          }));
          trackEthBalance(recipientAddress);
        }, 30000); // 30 seconds
        
        setTimers(prev => ({
          ...prev,
          [recipientAddress]: timer
        }));
      }
    });
    
    return () => {
      // Cleanup timers on unmount
      Object.values(timers).forEach(timer => {
        if (timer) clearTimeout(timer);
      });
    };
  }, [claimAmounts, recipientAddresses])

  // Clear autoProcessing when tracking completes
  useEffect(() => {
    Object.keys(autoProcessing).forEach(recipientAddress => {
      // If was auto-processing but now tracking is complete, clear auto-processing state
      if (autoProcessing[recipientAddress] && 
          ethBalanceTracking[recipientAddress] && 
          !ethBalanceTracking[recipientAddress].tracking) {
        setAutoProcessing(prev => ({
          ...prev,
          [recipientAddress]: false
        }));
      }
    });
  }, [ethBalanceTracking, autoProcessing])

  return (
    <div className="app">
      <div className="header">
        <div className="header-left">
          <img src={CirclesLogo} alt="Circles Logo" className="logo" />
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
              <div className="circles-profile-box info-box">
                <h3 style={{ marginTop: '0', marginBottom: '16px', color: '#3B2E6E', fontFamily: 'Inter, system-ui, sans-serif', fontWeight: '700' }}>Your Circles Profile</h3>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontWeight: '600', color: '#3B2E6E', fontFamily: 'Inter, system-ui, sans-serif' }}>Connected to</span>
                <span style={{ color: '#4582C1', fontSize: '14px', wordBreak: 'break-all', fontFamily: 'Inter, monospace, sans-serif' }}>{address}</span>
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
                              'Not registered as human, register with Metri now: https://app.metri.xyz/'                
                            }
                          </span>
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <span style={{ fontWeight: '600', color: '#3B2E6E', fontFamily: 'Inter, system-ui, sans-serif' }}>Eligibility</span>
                          <span style={{ color: safe.isEligible ? '#4582C1' : '#F19488', fontFamily: 'Inter, system-ui, sans-serif' }}>
                            {(() => {
                              if (!safe.avatarInfo?.isHuman) {
                                return 'Not registered as human'
                              }
                              if (safe.isEligible) {
                                return 'Eligible for faucet'
                              }
                              
                              const currentTimestamp = Math.floor(Date.now() / 1000)
                              const lastClaim = safe.lastClaimTimestamp || 0
                              const canClaimByTime = lastClaim === 0 || (currentTimestamp - lastClaim) > ONE_DAY_IN_SECONDS
                              const trustScore = safe.trustScore?.results?.[0]?.score || 0
                              
                              if (!canClaimByTime) {
                                return "You've claimed less than 1 day ago, please wait for 1 day to claim again"
                              } else if (trustScore <= TRUST_SCORE_THRESHOLD) {
                                return 'Avatar trust score is below 50'
                              }
                              
                              return 'Not eligible'
                            })()}
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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ color: '#F19488', fontFamily: 'Inter, system-ui, sans-serif' }}>Address is not related to any Circles account 😞</span>
                    <button 
                      style={{ 
                        color: '#F7F3EF', 
                        fontFamily: 'Inter, system-ui, sans-serif',
                        background: '#F19488',
                        border: 'none',
                        padding: 10,
                        cursor: 'pointer',
                       
                      }}
                      onClick={() => window.open("https://app.metri.xyz/", "_blank")}
                    >
                      Register with Metri now
                    </button>
                  </div>
                </div>
                )}
              </div>
            )}

            
            {isConnected && safesWithAvatars.length > 0 && (
              <div className="operation info-box">
                {safesWithAvatars.map((safe) => (
                  safe.isEligible && (
                    <div key={safe.safeAddress} className="info-box" style={{ backgroundColor: 'rgba(69, 130, 193, 0.1)', border: '1px solid rgba(69, 130, 193, 0.2)' }}>
                      <p style={{ fontFamily: 'Inter, system-ui, sans-serif', fontWeight: '600', color: '#3B2E6E' }}><strong>✅ You are eligible for claiming faucet </strong></p>
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
                            <div style={{ 
                              display: 'flex', 
                              justifyContent: 'flex-end', 
                              alignItems: 'center',
                              gap: '12px',
                              marginTop: '16px',
                              padding: '12px 0'
                            }}>
                              <span style={{ 
                                fontFamily: 'Inter, system-ui, sans-serif', 
                                fontWeight: '500', 
                                color: '#3B2E6E' 
                              }}>
                                I want to claim
                              </span>
                              <select
                                value={claimAmounts[safe.safeAddress] || '0.25'}
                                onChange={(e) => handleClaimAmountChange(safe.safeAddress, e.target.value)}
                                style={{
                                  padding: '8px 12px',
                                  borderRadius: '6px',
                                  border: '1px solid #3B2E6E',
                                  backgroundColor: '#F7F3EF',
                                  color: '#3B2E6E',
                                  fontFamily: 'Inter, system-ui, sans-serif',
                                  fontWeight: '500',
                                  fontSize: '14px',
                                  cursor: 'pointer'
                                }}
                              >
                                <option value="0.25">0.25 ETH</option>
                                <option value="0.5">0.5 ETH</option>
                                <option value="0.75">0.75 ETH</option>
                                <option value="1">1 ETH</option>
                              </select>
                            </div>
                            <a
                              href={generateMetriUrl(recipientAddresses[safe.safeAddress], claimAmounts[safe.safeAddress] || '0.25')}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => {
                                const recipientAddress = recipientAddresses[safe.safeAddress];
                                // Clear timer if user manually clicks
                                if (timers[recipientAddress]) {
                                  clearTimeout(timers[recipientAddress]!);
                                  setTimers(prev => ({
                                    ...prev,
                                    [recipientAddress]: null
                                  }));
                                }
                                trackEthBalance(recipientAddress);
                              }}
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
                            <QRCodeComponent url={generateMetriUrl(recipientAddresses[safe.safeAddress], claimAmounts[safe.safeAddress] || '0.25')} />
                            {(ethBalanceTracking[recipientAddresses[safe.safeAddress]]?.tracking || autoProcessing[recipientAddresses[safe.safeAddress]]) && (
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
                                  {autoProcessing[recipientAddresses[safe.safeAddress]] 
                                    ? 'Processing automatically' 
                                    : 'Processing'
                                  }
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
                                  🎉 You received {claimAmounts[safe.safeAddress]}!
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
            <p style={{ color: '#3B2E6E', lineHeight: '1.6', marginBottom: '16px', fontSize: '16px' }}>3. The Trust score of the Circles account is more than 50. <a href='https://aboutcircles.github.io/CirclesTools/trustScoreExplorer.html'>Click here to explorer How Trust Score works</a></p>
            <p style={{ color: '#3B2E6E', lineHeight: '1.6', marginBottom: '16px', fontSize: '16px' }}>4. Every Circles account can send maximum 24 CRC for 1 Sepolia ETH per day</p>
            <h2 style={{ color: '#3B2E6E', fontFamily: 'Inter, system-ui, sans-serif', fontWeight: '500', marginBottom: '24px' }}>Find out more about Circles: <a href="https://aboutcircles.com" target="_blank" rel="noopener noreferrer">https://aboutcircles.com</a></h2>          </div>
        )}
      </div>
    </div>

      )
  }

export default App
