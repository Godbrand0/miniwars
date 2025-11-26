import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useGameContract } from '../hooks/useGameContract';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Trophy, Medal, Award, TrendingUp, Users, DollarSign } from 'lucide-react';

interface PlayerStats {
  address: string;
  gamesPlayed: bigint;
  gamesWon: bigint;
  gamesLost: bigint;
  totalEarned: bigint;
  totalLost: bigint;
  winRate: bigint;
}

interface LeaderboardEntry {
  rank: number;
  address: string;
  gamesPlayed: string;
  gamesWon: string;
  gamesLost: string;
  winRate: string;
  totalEarned: string;
  totalLost: string;
  netProfit: string;
}

// Known player addresses - in a real app, this would come from events or a registry
// For now, we'll use some example addresses to demonstrate functionality
const knownPlayerAddresses = [
  '0x1234567890123456789012345678901234567890',
  '0x2345678901234567890123456789012345678901',
  '0x3456789012345678901234567890123456789012',
  '0x4567890123456789012345678901234567890123',
  '0x5678901234567890123456789012345678901234'
];

type SortCriteria = 'winRate' | 'gamesWon' | 'netProfit' | 'gamesPlayed';

export function Leaderboard() {
  const { address } = useAccount();
  const { getPlayerStats } = useGameContract();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortCriteria>('winRate');
  const [currentPlayer, setCurrentPlayer] = useState<LeaderboardEntry | null>(null);

  useEffect(() => {
    loadLeaderboard();
  }, [sortBy]);

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      // Fetch real player stats from contract
      const playerStatsPromises = knownPlayerAddresses.map(async (playerAddress) => {
        try {
          const stats = await getPlayerStats(playerAddress);
          // Type assertion to handle the unknown return type from contract
          const statsArray = stats as unknown as bigint[];
          return {
            address: playerAddress,
            gamesPlayed: statsArray[0] || 0n,
            gamesWon: statsArray[1] || 0n,
            gamesLost: statsArray[2] || 0n,
            totalEarned: statsArray[3] || 0n,
            totalLost: statsArray[4] || 0n,
            winRate: statsArray[5] || 0n
          };
        } catch (error) {
          console.error(`Failed to fetch stats for ${playerAddress}:`, error);
          // Return default stats for players who haven't played yet
          return {
            address: playerAddress,
            gamesPlayed: 0n,
            gamesWon: 0n,
            gamesLost: 0n,
            totalEarned: 0n,
            totalLost: 0n,
            winRate: 0n
          };
        }
      });

      const allPlayerStats = await Promise.all(playerStatsPromises);
      
      // Filter out players with zero games played
      const activePlayers = allPlayerStats.filter(player => player.gamesPlayed > 0n);
      
      const processedData = processLeaderboardData(activePlayers, sortBy);
      setLeaderboard(processedData);
      
      // Check if current user is in leaderboard
      if (address) {
        const userEntry = processedData.find(entry => 
          entry.address.toLowerCase() === address.toLowerCase()
        );
        setCurrentPlayer(userEntry || null);
      }
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const processLeaderboardData = (players: PlayerStats[], criteria: SortCriteria): LeaderboardEntry[] => {
    const processed = players.map((player, index) => {
      const netProfit = player.totalEarned - player.totalLost;
      return {
        rank: 0, // Will be set after sorting
        address: player.address,
        gamesPlayed: player.gamesPlayed.toString(),
        gamesWon: player.gamesWon.toString(),
        gamesLost: player.gamesLost.toString(),
        winRate: player.winRate.toString(),
        totalEarned: formatEther(player.totalEarned),
        totalLost: formatEther(player.totalLost),
        netProfit: formatEther(netProfit)
      };
    });

    // Sort based on criteria
    processed.sort((a, b) => {
      switch (criteria) {
        case 'winRate':
          return parseFloat(b.winRate) - parseFloat(a.winRate);
        case 'gamesWon':
          return parseInt(b.gamesWon) - parseInt(a.gamesWon);
        case 'netProfit':
          return parseFloat(b.netProfit) - parseFloat(a.netProfit);
        case 'gamesPlayed':
          return parseInt(b.gamesPlayed) - parseInt(a.gamesPlayed);
        default:
          return 0;
      }
    });

    // Assign ranks
    processed.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    return processed;
  };

  const formatEther = (value: bigint) => {
    return (Number(value) / 1e18).toFixed(4);
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-6 w-6 text-yellow-500" />;
      case 2:
        return <Medal className="h-6 w-6 text-gray-400" />;
      case 3:
        return <Award className="h-6 w-6 text-amber-600" />;
      default:
        return <span className="h-6 w-6 flex items-center justify-center text-sm font-bold text-gray-600">#{rank}</span>;
    }
  };

  const getSortLabel = (criteria: SortCriteria) => {
    switch (criteria) {
      case 'winRate':
        return 'Win Rate';
      case 'gamesWon':
        return 'Games Won';
      case 'netProfit':
        return 'Net Profit';
      case 'gamesPlayed':
        return 'Games Played';
      default:
        return 'Win Rate';
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading leaderboard from contract...</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Trophy className="h-8 w-8 text-yellow-500" />
            <h2 className="text-2xl font-bold">Leaderboard</h2>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {(['winRate', 'gamesWon', 'netProfit', 'gamesPlayed'] as SortCriteria[]).map((criteria) => (
              <Button
                key={criteria}
                variant={sortBy === criteria ? "default" : "outline"}
                size="sm"
                onClick={() => setSortBy(criteria)}
                className="text-xs"
              >
                {getSortLabel(criteria)}
              </Button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-2">Rank</th>
                <th className="text-left py-3 px-2">Player</th>
                <th className="text-center py-3 px-2">Win Rate</th>
                <th className="text-center py-3 px-2">Games</th>
                <th className="text-center py-3 px-2">W/L</th>
                <th className="text-center py-3 px-2">Net Profit</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry) => (
                <tr 
                  key={entry.address}
                  className={`border-b hover:bg-gray-50 ${
                    currentPlayer?.address === entry.address ? 'bg-blue-50' : ''
                  }`}
                >
                  <td className="py-3 px-2">
                    <div className="flex items-center justify-center">
                      {getRankIcon(entry.rank)}
                    </div>
                  </td>
                  <td className="py-3 px-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm">
                        {formatAddress(entry.address)}
                      </span>
                      {currentPlayer?.address === entry.address && (
                        <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                          You
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="text-center py-3 px-2">
                    <div className="flex items-center justify-center gap-1">
                      <span className="font-semibold">{entry.winRate}%</span>
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    </div>
                  </td>
                  <td className="text-center py-3 px-2">
                    <div className="flex items-center justify-center gap-1">
                      <Users className="h-4 w-4 text-gray-400" />
                      <span>{entry.gamesPlayed}</span>
                    </div>
                  </td>
                  <td className="text-center py-3 px-2">
                    <div className="flex justify-center gap-2 text-sm">
                      <span className="text-green-600">{entry.gamesWon}</span>
                      <span className="text-gray-400">/</span>
                      <span className="text-red-600">{entry.gamesLost}</span>
                    </div>
                  </td>
                  <td className="text-center py-3 px-2">
                    <div className={`flex items-center justify-center gap-1 ${
                      parseFloat(entry.netProfit) >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      <DollarSign className="h-4 w-4" />
                      <span className="font-semibold">
                        {parseFloat(entry.netProfit) >= 0 ? '+' : ''}{entry.netProfit} cUSD
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {leaderboard.length === 0 && (
          <div className="text-center py-8">
            <Trophy className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No players found on leaderboard yet</p>
            <p className="text-sm text-gray-500 mt-2">Be the first to play and claim the top spot!</p>
          </div>
        )}
      </Card>

      {currentPlayer && (
        <Card className="p-6 bg-blue-50 border-blue-200">
          <h3 className="text-lg font-semibold mb-4 text-blue-900">Your Ranking</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">#{currentPlayer.rank}</div>
              <div className="text-sm text-blue-700">Rank</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{currentPlayer.winRate}%</div>
              <div className="text-sm text-blue-700">Win Rate</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{currentPlayer.gamesWon}</div>
              <div className="text-sm text-blue-700">Games Won</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${
                parseFloat(currentPlayer.netProfit) >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {parseFloat(currentPlayer.netProfit) >= 0 ? '+' : ''}{currentPlayer.netProfit} cUSD
              </div>
              <div className="text-sm text-blue-700">Net Profit</div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}