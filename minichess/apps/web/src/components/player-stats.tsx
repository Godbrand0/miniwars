import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useGameContract } from '../hooks/useGameContract';
import { Card } from './ui/card';
import { Button } from './ui/button';

interface PlayerStats {
  gamesPlayed: bigint;
  gamesWon: bigint;
  gamesLost: bigint;
  totalEarned: bigint;
  totalLost: bigint;
  winRate: bigint;
}

export function PlayerStats() {
  const { address } = useAccount();
  const { getPlayerStats, getPlayerGameHistory, getPlayerGameCount } = useGameContract();
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [gameHistory, setGameHistory] = useState<bigint[]>([]);
  const [gameCount, setGameCount] = useState<bigint>(0n);
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (address) {
      loadPlayerStats();
    }
  }, [address]);

  const loadPlayerStats = async () => {
    if (!address) return;
    
    setLoading(true);
    try {
      const [playerStats, count] = await Promise.all([
        getPlayerStats(address),
        getPlayerGameCount(address)
      ]);
      
      setStats(playerStats as PlayerStats);
      setGameCount(count as bigint);
    } catch (error) {
      console.error('Failed to load player stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadGameHistory = async () => {
    if (!address) return;
    
    try {
      const history = await getPlayerGameHistory(address, 10, 0);
      setGameHistory(history as bigint[]);
      setShowHistory(true);
    } catch (error) {
      console.error('Failed to load game history:', error);
    }
  };

  if (!address) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-2">Player Statistics</h3>
        <p className="text-gray-600">Connect your wallet to view your statistics</p>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-2">Player Statistics</h3>
        <p className="text-gray-600">Loading...</p>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-2">Player Statistics</h3>
        <p className="text-gray-600">No games played yet</p>
      </Card>
    );
  }

  const formatNumber = (value: bigint) => {
    return value.toString();
  };

  const formatEther = (value: bigint) => {
    return (Number(value) / 1e18).toFixed(4);
  };

  return (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Player Statistics</h3>
        <Button 
          variant="outline" 
          size="sm"
          onClick={loadPlayerStats}
        >
          Refresh
        </Button>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">
            {formatNumber(stats.gamesPlayed)}
          </div>
          <div className="text-sm text-gray-600">Games Played</div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">
            {formatNumber(stats.gamesWon)}
          </div>
          <div className="text-sm text-gray-600">Games Won</div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-bold text-red-600">
            {formatNumber(stats.gamesLost)}
          </div>
          <div className="text-sm text-gray-600">Games Lost</div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-bold text-purple-600">
            {formatNumber(stats.winRate)}%
          </div>
          <div className="text-sm text-gray-600">Win Rate</div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">
            {formatEther(stats.totalEarned)} cUSD
          </div>
          <div className="text-sm text-gray-600">Total Earned</div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-bold text-red-600">
            {formatEther(stats.totalLost)} cUSD
          </div>
          <div className="text-sm text-gray-600">Total Lost</div>
        </div>
      </div>
      
      <div className="border-t pt-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-600">
            Total Games in History: {formatNumber(gameCount)}
          </span>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
          >
            {showHistory ? 'Hide' : 'Show'} History
          </Button>
        </div>
        
        {showHistory && (
          <div className="mt-4">
            <h4 className="font-semibold mb-2">Recent Games</h4>
            {gameHistory.length > 0 ? (
              <div className="space-y-2">
                {gameHistory.map((gameId, index) => (
                  <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-sm">Game #{formatNumber(gameId)}</span>
                    <span className="text-xs text-gray-500">
                      {new Date().toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-600">No game history available</p>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}