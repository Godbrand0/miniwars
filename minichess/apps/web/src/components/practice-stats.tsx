'use client';

import { useState, useEffect } from 'react';
import { PracticeStatsManager } from '@/lib/practice-stats';

export default function PracticeStats() {
  const [stats, setStats] = useState(PracticeStatsManager.getStatsSummary());
  const [recentGames, setRecentGames] = useState(PracticeStatsManager.getRecentGames(5));

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(PracticeStatsManager.getStatsSummary());
      setRecentGames(PracticeStatsManager.getRecentGames(5));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const getResultColor = (result: string) => {
    switch (result) {
      case 'win': return 'text-green-600';
      case 'lose': return 'text-red-600';
      case 'draw': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  const getResultIcon = (result: string) => {
    switch (result) {
      case 'win': return '✓';
      case 'lose': return '✗';
      case 'draw': return '=';
      default: return '';
    }
  };

  return (
    <div className="bg-white shadow-lg rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">📊 Practice Statistics</h2>
        <button 
          onClick={() => PracticeStatsManager.clearStats()}
          className="text-red-600 hover:text-red-800 text-sm"
        >
          Clear Stats
        </button>
      </div>

      {stats.totalGames === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No practice games played yet</p>
          <p className="text-sm mt-2">Start playing to see your statistics!</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{stats.totalGames}</div>
              <div className="text-sm text-gray-600">Total Games</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{stats.winRate.toFixed(1)}%</div>
              <div className="text-sm text-gray-600">Win Rate</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{stats.averageMoves.toFixed(1)}</div>
              <div className="text-sm text-gray-600">Avg Moves</div>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{formatTime(Math.floor(stats.averageTime))}</div>
              <div className="text-sm text-gray-600">Avg Time</div>
            </div>
          </div>

          <div className="mb-4">
            <h3 className="font-semibold mb-2">Record</h3>
            <div className="flex gap-4 text-sm">
              <span className="text-green-600">W: {stats.wins}</span>
              <span className="text-red-600">L: {stats.losses}</span>
              <span className="text-yellow-600">D: {stats.draws}</span>
            </div>
          </div>

          {recentGames.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Recent Games</h3>
              <div className="space-y-2">
                {recentGames.map((game) => (
                  <div key={game.id} className="flex justify-between items-center text-sm bg-gray-50 p-2 rounded">
                    <div className="flex items-center gap-2">
                      <span className={`font-bold ${getResultColor(game.result)}`}>
                        {getResultIcon(game.result)}
                      </span>
                      <span className={getResultColor(game.result)}>
                        {game.result.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex gap-4 text-gray-600">
                      <span>{game.moves} moves</span>
                      <span>{formatTime(game.time)}</span>
                      <span>{formatDate(game.date)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}