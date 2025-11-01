import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { useState, useEffect } from 'react'
import { checkSafesAndAvatars } from './safeAvatarChecker'
import './App.css'
import { createPublicClient, http, parseEventLogs, parseAbiItem } from 'viem';
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

function App() {
  const { address, isConnected } = useAccount()
  const { connectors, connect } = useConnect()
  const { disconnect } = useDisconnect()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [safesWithAvatars, setSafesWithAvatars] = useState<SafeWithAvatar[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [recipientAddresses, setRecipientAddresses] = useState<{[key: string]: string}>({})
  const [addressValidation, setAddressValidation] = useState<{[key: string]: boolean}>({})
  const [transactionHashes, setTransactionHashes] = useState<{[key: string]: string}>({})

  const isValidEthereumAddress = (address: string): boolean => {
    return /^0x[a-fA-F0-9]{40}$/.test(address) // TODO: use ethers.utils.isAddress() to check for validity
  }

  const generateMetriUrl = (recipientAddress: string): string => {
    // Remove 0x prefix and pad to 32 bytes (64 hex chars)
    const addressWithoutPrefix = recipientAddress.slice(2)
    const abiEncodedAddress = '0x' + '0'.repeat(24) + addressWithoutPrefix
    
    const faucetOrgAddress = import.meta.env.VITE_CYCLE_CONTRACT
    const crcAmount = import.meta.env.VITE_CRC_AMOUNT
    
    return `https://app.metri.xyz/transfer/${faucetOrgAddress}/crc/${crcAmount}?data=${abiEncodedAddress}`
  }

  const queryTransactionHash = async (recipientAddress: string) => {
    try {
      const sepoliaPublicClient = createPublicClient({
        chain: sepolia,
        transport: http()
      })

      const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS
      if (!CONTRACT_ADDRESS) {
        console.error('Missing VITE_CONTRACT_ADDRESS environment variable')
        return
      }

      const unwatch = sepoliaPublicClient.watchContractEvent({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: [
          parseAbiItem(
            "event TokenWithdrawn(address indexed to, uint256 indexed amount)"
          ),
        ],
        eventName: "TokenWithdrawn",
        onLogs: async (logs) => {
          const txHash = await checkTokenWithdrawRecipient(logs, recipientAddress)
          if (txHash) {
            setTransactionHashes(prev => ({
              ...prev,
              [recipientAddress]: txHash
            }))
            unwatch()
          }
        },
      })
    } catch (error) {
      console.error('Error querying transaction hash:', error)
    }
  }

  const checkTokenWithdrawRecipient = async (logs: any[], recipientAddress: string): Promise<string | null> => {
    try {
      for (const log of logs) {
        const parsedLogs = parseEventLogs({
          abi: [
            parseAbiItem(
              "event TokenWithdrawn(address indexed to, uint256 indexed amount)"
            ),
          ],
          logs: [log],
        })
        
        for (const parsedLog of parsedLogs) {
          if (parsedLog.args.to?.toLowerCase() === recipientAddress.toLowerCase()) {
            return parsedLog.transactionHash
          }
        }
      }
      return null
    } catch (error) {
      console.error('Error parsing logs:', error)
      return null
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
      
      // Query transaction hash when valid address is entered
      if (isValid) {
        queryTransactionHash(value.trim())
      }
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
      
      <div className="main-content">
        <p>
          {isConnected 
            ? `Connected to ${address}` 
            : 'Please connect your wallet using the button in the top right corner'
          }
        </p>
        
        {isConnected && (
          <div className="safes-section">
          
            {isLoading ? (
              <p>Loading safes and avatars...</p>
            ) : safesWithAvatars.length > 0 ? (
              <div className="safes-list">
                {safesWithAvatars.map((safe, index) => (
                  <div key={safe.safeAddress} className="safe-item">
                    <h3>Circles account #{index + 1}</h3>
                    <p><strong>Address:</strong> {safe.safeAddress}</p>
                    <p><strong>Avatar Info:</strong></p>
                    {safe.avatarInfo?.isHuman ? (
                      <p>Registered human</p>
                    ) : (
                      <p>Not registered as human</p>
                    )}
                    
                    {safe.trustScore && (
                      <div>
                        <p><strong>Trust Score:</strong></p>
                        {safe.trustScore.results && safe.trustScore.results.length > 0 ? (
                          <p>{safe.trustScore.results[0].score?.toFixed(2)}</p>
                        ) : (
                          <p>No trust score data available</p>
                        )}
                      </div>
                    )}

                    {safe.avatarInfo?.isHuman && 
                     safe.trustScore?.results?.[0]?.score && safe.trustScore.results[0].score > (Number(import.meta.env.VITE_TRUST_SCORE_THRESHOLD) || 40) && (
                      <div style={{ backgroundColor: '#e8f5e8', padding: '10px', margin: '10px 0', borderRadius: '5px' }}>
                        <p><strong>✅ You are eligible for claiming faucet, please transfer ${import.meta.env.VITE_CRC_AMOUNT} CRC</strong></p>
                        <div style={{ marginTop: '10px' }}>
                          <label htmlFor={`recipient-${safe.safeAddress}`} style={{ display: 'block', marginBottom: '5px' }}>
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
                              padding: '8px',
                              borderRadius: '4px',
                              border: recipientAddresses[safe.safeAddress] 
                                ? (addressValidation[safe.safeAddress] ? '2px solid green' : '2px solid red')
                                : '1px solid #ccc',
                              fontSize: '14px'
                            }}
                          />
                          {recipientAddresses[safe.safeAddress] && !addressValidation[safe.safeAddress] && (
                            <p style={{ color: 'red', fontSize: '12px', margin: '5px 0 0 0' }}>
                              Please enter a valid Ethereum address
                            </p>
                          )}
                          {recipientAddresses[safe.safeAddress] && addressValidation[safe.safeAddress] && (
                            <>
                              <p style={{ color: 'green', fontSize: '12px', margin: '5px 0 0 0' }}>
                                ✅ Valid Ethereum address
                              </p>
                              <a
                                href={generateMetriUrl(recipientAddresses[safe.safeAddress])}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  display: 'inline-block',
                                  marginTop: '10px',
                                  padding: '10px 20px',
                                  backgroundColor: '#007bff',
                                  color: 'white',
                                  textDecoration: 'none',
                                  borderRadius: '5px',
                                  fontSize: '14px',
                                  fontWeight: 'bold'
                                }}
                              >
                                Transfer with Metri now
                              </a>
                              {transactionHashes[recipientAddresses[safe.safeAddress]] && (
                                <div style={{ 
                                  marginTop: '15px', 
                                  padding: '10px', 
                                  backgroundColor: '#f0f8ff', 
                                  border: '1px solid #b3d9ff',
                                  borderRadius: '5px' 
                                }}>
                                  <p style={{ 
                                    color: '#0066cc', 
                                    fontSize: '14px', 
                                    margin: '0',
                                    fontWeight: 'bold'
                                  }}>
                                    Sepolia tx hash: {transactionHashes[recipientAddresses[safe.safeAddress]]}
                                  </p>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p>No safes with avatars found for this account.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default App
