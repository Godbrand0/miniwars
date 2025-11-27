import { useEffect, useState } from 'react'
import { useAccount, useReadContract, useConfig } from 'wagmi'
import { formatEther } from 'viem'
import { readContract } from 'wagmi/actions'
import { Button } from './ui/button'

import MiniChessEscrowPaymasterABI from '../contracts/MiniChessEscrowPaymaster.json'

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`


export function PlayerProfile() {
  const config = useConfig()
  const { address } = useAccount()
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const GAMES_PER_PAGE = 10

  // Get player stats
  const { data: statsData } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: MiniChessEscrowPaymasterABI.abi,
    functionName: 'getPlayerStats',
    args: [address as `0x${string}`],
    query: {
      enabled: !!address
    }
  })

  // Get total game count
  const { data: gameCount } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: MiniChessEscrowPaymasterABI.abi,
    functionName: 'getPlayerGameCount',
    args: [address as `0x${string}`],
    query: {
      enabled: !!address
    }
  })

  // Get game history with pagination
  const { data: gameIds } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: MiniChessEscrowPaymasterABI.abi,
    functionName: 'getPlayerGameHistory',
    args: [address as `0x${string}`, BigInt(GAMES_PER_PAGE), BigInt(page * GAMES_PER_PAGE)],
    query: {
      enabled: !!address
    }
  })

  // Fetch game details for each game ID
  useEffect(() => {
    async function fetchGameDetails() {
      if (!gameIds || Array.isArray(gameIds) && gameIds.length === 0) {
        setHistory([])
        setLoading(false)
        return
      }

      setLoading(true)
      
      const games = await Promise.all(
        (gameIds as bigint[]).map(async (gameId) => {
          try {
            const gameData = await readContract(config, {
              address: CONTRACT_ADDRESS,
              abi: MiniChessEscrowPaymasterABI.abi,
              functionName: 'getGame',
              args: [gameId]
            })

            const gameDataResult = gameData as any[]
            if (!Array.isArray(gameDataResult) || gameDataResult.length === 0) {
              return null
            }
            
            const [
              player1,
              player2,
              player1Balance,
              player2Balance,
              status,
              winner,
              createdAt,
              lastMoveAt
            ] = gameDataResult

            const isPlayer1 = player1.toLowerCase() === address?.toLowerCase()
            const opponent = isPlayer1 ? player2 : player1
            const won = winner.toLowerCase() === address?.toLowerCase()
            const myPayout = isPlayer1 ? player1Balance : player2Balance

            return {
              gameId: gameId.toString(),
              opponent,
              won,
              payout: formatEther(myPayout),
              profit: formatEther(myPayout - BigInt('2500000000000000000')), // Minus escrow
              date: new Date(Number(createdAt) * 1000),
              status
            }
          } catch (error) {
            console.error(`Error fetching game ${gameId}:`, error)
            return null
          }
        })
      )

      setHistory(games.filter(g => g !== null))
      setLoading(false)
    }

    fetchGameDetails()
  }, [gameIds, address, config])

  if (!address) {
    return (
      <div className="profile-container">
        <p>Please connect your wallet to view profile</p>
      </div>
    )
  }

  if (!statsData) {
    return <div className="profile-container">Loading...</div>
  }

  const [gamesPlayed, gamesWon, gamesLost, totalEarned, totalLost, winRate] = statsData as any[]
  const netProfit = formatEther((totalEarned as bigint) - (totalLost as bigint))

  return (
    <div className="profile-container">
      <style dangerouslySetInnerHTML={{ __html: styles }}></style>
      
      {/* Header */}
      <div className="profile-header">
        <h1>Player Profile</h1>
        <div className="wallet-address">
          {address.slice(0, 6)}...{address.slice(-4)}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <StatCard 
          label="Games Played" 
          value={gamesPlayed.toString()}
          icon="🎮"
        />
        <StatCard 
          label="Win Rate" 
          value={`${winRate}%`}
          icon="🏆"
          highlight={Number(winRate) > 50}
        />
        <StatCard 
          label="Games Won" 
          value={gamesWon.toString()}
          icon="✅"
          positive
        />
        <StatCard 
          label="Games Lost" 
          value={gamesLost.toString()}
          icon="❌"
          negative
        />
      </div>

      {/* Financial Stats */}
      <div className="financial-stats">
        <div className="stat-row">
          <span className="label">Total Earned:</span>
          <span className="value positive">+${formatEther(totalEarned as bigint)}</span>
        </div>
        <div className="stat-row">
          <span className="label">Total Lost:</span>
          <span className="value negative">-${formatEther(totalLost as bigint)}</span>
        </div>
        <div className="stat-row divider">
          <span className="label">Net Profit:</span>
          <span className={`value ${Number(netProfit) >= 0 ? 'positive' : 'negative'}`}>
            {Number(netProfit) >= 0 ? '+' : ''}${netProfit}
          </span>
        </div>
      </div>

      {/* Game History */}
      <div className="game-history">
        <h2>Recent Games</h2>
        
        {loading ? (
          <div className="loading">Loading games...</div>
        ) : history.length === 0 ? (
          <div className="no-games">No games played yet</div>
        ) : (
          <>
            {history.map((game) => (
              <GameHistoryCard key={game.gameId} game={game} />
            ))}
            
            {/* Pagination */}
            <div className="pagination">
              <Button 
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                variant="outline"
              >
                Previous
              </Button>
              <span>Page {page + 1}</span>
              <Button 
                onClick={() => setPage(p => p + 1)}
                disabled={(page + 1) * GAMES_PER_PAGE >= Number(gameCount)}
                variant="outline"
              >
                Next
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, icon, positive, negative, highlight }: any) {
  return (
    <div className={`stat-card ${highlight ? 'highlight' : ''}`}>
      <div className="icon">{icon}</div>
      <div className="content">
        <div className="label">{label}</div>
        <div className={`value ${positive ? 'positive' : ''} ${negative ? 'negative' : ''}`}>
          {value}
        </div>
      </div>
    </div>
  )
}

function GameHistoryCard({ game }: any) {
  const profitNum = Number(game.profit)
  
  return (
    <div className={`game-card ${game.won ? 'won' : 'lost'}`}>
      <div className="result-badge">
        {game.won ? '✓ Victory' : '✗ Defeat'}
      </div>
      
      <div className="game-info">
        <div className="row">
          <span className="label">Opponent:</span>
          <span className="value">
            {game.opponent.slice(0, 6)}...{game.opponent.slice(-4)}
          </span>
        </div>
        
        <div className="row">
          <span className="label">Final Payout:</span>
          <span className="value">${game.payout} cUSD</span>
        </div>
        
        <div className="row">
          <span className="label">Profit/Loss:</span>
          <span className={`value ${profitNum >= 0 ? 'positive' : 'negative'}`}>
            {profitNum >= 0 ? '+' : ''}${game.profit} cUSD
          </span>
        </div>
        
        <div className="row">
          <span className="label">Date:</span>
          <span className="value">
            {game.date.toLocaleDateString()} {game.date.toLocaleTimeString()}
          </span>
        </div>
      </div>
      
      <div className="game-id">
        Game #{game.gameId}
      </div>
    </div>
  )
}

const styles = `
.profile-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.profile-header {
  text-align: center;
  margin-bottom: 2rem;
}

.profile-header h1 {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
}

.wallet-address {
  font-family: monospace;
  color: #666;
  font-size: 1rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  display: flex;
  align-items: center;
  gap: 1rem;
  transition: transform 0.2s;
}

.stat-card:hover {
  transform: translateY(-4px);
}

.stat-card.highlight {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.stat-card .icon {
  font-size: 2.5rem;
}

.stat-card .label {
  font-size: 0.9rem;
  color: #666;
  margin-bottom: 0.25rem;
}

.stat-card.highlight .label {
  color: rgba(255,255,255,0.9);
}

.stat-card .value {
  font-size: 2rem;
  font-weight: bold;
}

.stat-card .value.positive {
  color: #10b981;
}

.stat-card .value.negative {
  color: #ef4444;
}

.financial-stats {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  margin-bottom: 2rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 0;
  border-bottom: 1px solid #e5e7eb;
}

.stat-row:last-child {
  border-bottom: none;
}

.stat-row.divider {
  border-top: 2px solid #e5e7eb;
  margin-top: 0.5rem;
  padding-top: 1.5rem;
}

.stat-row .label {
  font-size: 1.1rem;
  color: #374151;
}

.stat-row .value {
  font-size: 1.3rem;
  font-weight: bold;
}

.stat-row .value.positive {
  color: #10b981;
}

.stat-row .value.negative {
  color: #ef4444;
}

.game-history h2 {
  font-size: 1.8rem;
  margin-bottom: 1.5rem;
}

.game-card {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  border-left: 4px solid #e5e7eb;
}

.game-card.won {
  border-left-color: #10b981;
}

.game-card.lost {
  border-left-color: #ef4444;
}

.result-badge {
  display: inline-block;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-weight: bold;
  margin-bottom: 1rem;
  font-size: 0.9rem;
}

.game-card.won .result-badge {
  background: #d1fae5;
  color: #065f46;
}

.game-card.lost .result-badge {
  background: #fee2e2;
  color: #991b1b;
}

.game-info .row {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0;
  border-bottom: 1px solid #f3f4f6;
}

.game-info .row:last-child {
  border-bottom: none;
}

.game-info .label {
  color: #6b7280;
}

.game-info .value {
  font-weight: 500;
}

.game-id {
  margin-top: 1rem;
  text-align: right;
  color: #9ca3af;
  font-size: 0.85rem;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  margin-top: 2rem;
}

.pagination button {
  padding: 0.5rem 1rem;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
}

.pagination button:hover:not(:disabled) {
  background: #f3f4f6;
}

.pagination button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loading, .no-games {
  text-align: center;
  padding: 3rem;
  color: #6b7280;
}
`