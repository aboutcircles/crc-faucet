import SafeApiKit from '@safe-global/api-kit'
import { Sdk } from "@circles-sdk/sdk";
import { PrivateKeyContractRunner } from "@circles-sdk/adapter-ethers";
import { JsonRpcProvider } from "ethers";
import type { CirclesConfig } from '@circles-sdk/sdk';
import { createPublicClient, http } from 'viem';
import { gnosis } from 'viem/chains';

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


  private static readonly BACKERS_GROUP = '0x1aca75e38263c79d9d4f10df0635cc6fcfe6f026';
  
  private async fetchBackersMembers(): Promise<string[]> {
    const payload = {
      jsonrpc: '2.0',
      id: 1,
      method: 'circles_query',
      params: [{
        Namespace: 'V_CrcV2',
        Table: 'GroupMemberships',
        Filter: [{
          Type: 'FilterPredicate',
          FilterType: 'Equals',
          Column: 'group',
          Value: SafeAvatarChecker.BACKERS_GROUP
        }],
        Order: [{ Column: 'member', SortOrder: 'Asc' }],
        Limit: 10000
      }]
    };

    try {
      console.log('Fetching Backers group members from RPC...');
      const response = await fetch('https://rpc.aboutcircles.com/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      console.log(`RPC Response status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`RPC Error Response: ${errorText}`);
        throw new Error(`RPC request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('RPC Response data:', data);

      if (data.result && data.result.rows) {
        const backersMembers = data.result.rows.map((row: any[]) => row[6]);
        console.log(`Loaded ${backersMembers.length} Backers group members`);
        console.log('Sample members:', backersMembers.slice(0, 3));

        // Validate addresses are in correct format
        const addressRegex = /^0x[a-fA-F0-9]{40}$/;
        const validMembers = backersMembers.filter((addr: any) => 
          addr && typeof addr === 'string' && addressRegex.test(addr)
        );

        if (validMembers.length !== backersMembers.length) {
          console.log(`Filtered ${backersMembers.length - validMembers.length} invalid addresses`);
        }

        return validMembers;
      } else {
        console.error('Unexpected response format:', data);
        throw new Error('Invalid response format from RPC');
      }
    } catch (error) {
      console.error(`Error fetching Backers members: ${error}`);
      throw new Error(`Failed to fetch Backers members: ${error}`);
    }
  }
  async getTrustScore(avatarAddress: string): Promise<any> {
    try {
      const trustScoreUrl = import.meta.env.VITE_TRUST_SCORE_URL;
      if (!trustScoreUrl) {
        console.warn('VITE_TRUST_SCORE_URL not configured');
        return null;
      }

      // Fetch backers members first
      const targetAddresses = await this.fetchBackersMembers();

      const analyticsApi = `${trustScoreUrl}/aboutcircles-advanced-analytics2/scoring/relative_trustscore`;
      const payload = {
        "avatars": [avatarAddress],
        "target_set": targetAddresses,
        "include_details": false
      };
    

      const response = await fetch(analyticsApi, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      // Return only the relative_score from the first result
      if (result.results && result.results.length > 0) {
        console.log("Trust score ", result.results[0].relative_score )
        return result.results[0].relative_score
        // {
        //   relative_score: result.results[0].relative_score,
        //   targets_reached: result.results[0].targets_reached,
        //   total_targets: result.results[0].total_targets,
        //   penetration_rate: result.results[0].penetration_rate,
        //   hop_breakdown: result.results[0].hop_breakdown
        // };
      }else{
        return 0;
      }
      
    } catch (error) {
      console.error(`Error fetching trust score for ${avatarAddress}:`, error);
      return null;
    }
  }


  // We don't use RiskScore but Relative Trust Score instead
  async getRiskScore(avatarAddress: string): Promise<any> {
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
    

      // TODO: also check connectedAccount by calling 
      //const safeInfo = await apiKit.getSafeInfo(connectedAccountAddress)
      let safes: string[] = [];
      const gnoClient = createPublicClient({
        chain: gnosis,
        transport: http()
      })

      const codeSize = await gnoClient.getCode({
        address: connectedAccountAddress
      })

      if(codeSize !== undefined && codeSize.length > 0){
        safes.push(connectedAccountAddress)

      }else{
        safes = (await this.apiKit.getSafesByOwner(connectedAccountAddress)).safes;
        if (!safes || safes.length === 0) {
          return [];
        }

      }
      console.log("safe info", safes)
      
      

      // Check each safe for avatar and filter out those with avatars
      const safesWithAvatars: SafeWithAvatar[] = [];
      
      for (const safeAddress of safes) {
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
  console.log("Get Safe with Avatars", avatars);
  return avatars;
}