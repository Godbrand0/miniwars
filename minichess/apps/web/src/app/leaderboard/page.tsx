'use client';

import { Leaderboard } from '@/components/leaderboard';
import { Navbar } from '@/components/navbar';

export default function LeaderboardPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              MiniChess Leaderboard
            </h1>
            <p className="text-lg text-gray-600">
              Top players ranked by performance
            </p>
          </div>
          
          <Leaderboard />
          
          <div className="mt-8 bg-white rounded-lg p-6 shadow-sm">
            <h2 className="text-xl font-semibold mb-4">How Rankings Work</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">🏆 Ranking Criteria</h3>
                <ul className="space-y-1 text-sm text-gray-600">
                  <li>• <strong>Win Rate:</strong> Percentage of games won</li>
                  <li>• <strong>Games Won:</strong> Total number of victories</li>
                  <li>• <strong>Net Profit:</strong> Total earnings minus losses</li>
                  <li>• <strong>Games Played:</strong> Total participation</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">💰 Earnings System</h3>
                <ul className="space-y-1 text-sm text-gray-600">
                  <li>• <strong>Pawn:</strong> $0.05 cUSD</li>
                  <li>• <strong>Knight/Bishop:</strong> $0.15 cUSD</li>
                  <li>• <strong>Rook:</strong> $0.25 cUSD</li>
                  <li>• <strong>Queen:</strong> $0.50 cUSD</li>
                  <li>• <strong>Starting Escrow:</strong> $2.50 cUSD</li>
                </ul>
              </div>
            </div>
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> This leaderboard currently displays mock data for demonstration purposes. 
                In a production environment, it would show real player statistics from the blockchain.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}