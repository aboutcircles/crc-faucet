import SafeApiKit from '@safe-global/api-kit'
import { Sdk } from "@circles-sdk/sdk";
import { PrivateKeyContractRunner } from "@circles-sdk/adapter-ethers";
import { JsonRpcProvider } from "ethers";
import type { CirclesConfig } from '@circles-sdk/sdk';

interface SafeWithAvatar {
  safeAddress: string;
  avatarInfo: any;
  trustScore?: any;
}

export class SafeAvatarChecker {
  private apiKit: SafeApiKit;
  private sdk!: Sdk;
 
  

  constructor(apiKey: string) {
    // Initialize Safe API Kit
    this.apiKit = new SafeApiKit({
      chainId: 100n, // Gnosis Chain
      apiKey: apiKey
    });

   
  }

  async initialize(): Promise<void> {


    // Initialize Circles SDK
    const provider = new JsonRpcProvider("https://rpc.gnosischain.com");
    //Do not use this private key!
    const randomPrivKey = "0x30bea533d3bed0cba464e1f2f4163ff903e1815858526ee18e6c7caaa7fda8da"
    const runner = new PrivateKeyContractRunner(provider, randomPrivKey);
    await runner.init();
    const circlesConfig: CirclesConfig = {
      circlesRpcUrl: "https://rpc.aboutcircles.com/",
      pathfinderUrl: "https://pathfinder.aboutcircles.com",
      v1HubAddress: "0x29b9a7fbb8995b2423a71cc17cf9810798f6c543",
      v2HubAddress: "0xc12C1E50ABB450d6205Ea2C3Fa861b3B834d13e8",
      nameRegistryAddress: "0xA27566fD89162cC3D40Cb59c87AAaA49B85F3474",
      migrationAddress: "0xD44B8dcFBaDfC78EA64c55B705BFc68199B56376",
      profileServiceUrl: "https://rpc.aboutcircles.com/profiles/",
    };

    this.sdk = new Sdk(runner, circlesConfig);

  }

  async getTrustScore(avatarAddress: string): Promise<any> {
    try {
      const trustScoreUrl = import.meta.env.VITE_TRUST_SCORE_URL;
      if (!trustScoreUrl) {
        console.warn('VITE_TRUST_SCORE_URL not configured');
        return null;
      }

      const response = await fetch(
        `${trustScoreUrl}/aboutcircles-advanced-analytics2/scoring/riskscore/${avatarAddress}?include_details=false`,
        {
          method: 'GET',
          headers: {
            'accept': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log(`Trust score for ${avatarAddress}:`, result);
      return result;
    } catch (error) {
      console.error(`Error fetching trust score for ${avatarAddress}:`, error);
      return null;
    }
  }

  // there are two cases for registering as Human
  // 1. user calls registerHuman directly -> avatar is an EOA or contract
  // 2. user registers through Metri -> avatar is 
  async getSafesWithAvatars(connectedAccountAddress: string): Promise<SafeWithAvatar[]> {
    try {
      // Get all safes owned by the connected account
      const safes = await this.apiKit.getSafesByOwner(connectedAccountAddress);
      
      if (!safes.safes || safes.safes.length === 0) {
        return [];
      }

      // Check each safe for avatar and filter out those with avatars
      const safesWithAvatars: SafeWithAvatar[] = [];
      
      for (const safeAddress of safes.safes) {
        try {
          const avatar = await this.sdk.getAvatar(safeAddress as `0x${string}`, false);
          
          if (avatar && avatar.avatarInfo) {
            // Get trust score for the avatar
            const trustScore = await this.getTrustScore(avatar.avatarInfo.avatar);
            
            safesWithAvatars.push({
              safeAddress,
              avatarInfo: avatar.avatarInfo,
              trustScore
            });
          }
        } catch (error) {
          // Skip safes that don't have avatars or have errors
          console.log(`No avatar found for safe ${safeAddress}:`, error);
        }
      }

      return safesWithAvatars;
    } catch (error) {
      console.error('Error fetching safes or avatars:', error);
      throw error;
    }
  }
}

// Usage function
export async function checkSafesAndAvatars(
  connectedAccountAddress: string, 
  apiKey: string, 
  
): Promise<SafeWithAvatar[]> {
  const checker = new SafeAvatarChecker(apiKey);
  await checker.initialize();
  const avatars = await checker.getSafesWithAvatars(connectedAccountAddress);
  console.log("avatars", avatars);
  return avatars;
}