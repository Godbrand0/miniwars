export interface PracticeGameResult {
  id: string;
  result: 'win' | 'lose' | 'draw';
  moves: number;
  captures: number;
  time: number;
  date: Date;
}

export class PracticeStatsManager {
  private static STORAGE_KEY = 'minichess-practice-stats';

  static saveGame(result: Omit<PracticeGameResult, 'id' | 'date'>): void {
    const gameResult: PracticeGameResult = {
      ...result,
      id: `practice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      date: new Date()
    };

    const stats = this.getStats();
    stats.push(gameResult);
    
    // Keep only the last 50 games to prevent storage bloat
    if (stats.length > 50) {
      stats.splice(0, stats.length - 50);
    }
    
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(stats));
  }

  static getStats(): PracticeGameResult[] {
    if (typeof window === 'undefined') return [];
    
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (!stored) return [];
    
    try {
      const parsed = JSON.parse(stored);
      return parsed.map((game: any) => ({
        ...game,
        date: new Date(game.date)
      }));
    } catch (error) {
      console.error('Error parsing practice stats:', error);
      return [];
    }
  }

  static getWinRate(): number {
    const games = this.getStats();
    if (games.length === 0) return 0;
    
    const wins = games.filter(game => game.result === 'win').length;
    return (wins / games.length) * 100;
  }

  static getAverageMoves(): number {
    const games = this.getStats();
    if (games.length === 0) return 0;
    
    const totalMoves = games.reduce((sum, game) => sum + game.moves, 0);
    return totalMoves / games.length;
  }

  static getAverageTime(): number {
    const games = this.getStats();
    if (games.length === 0) return 0;
    
    const totalTime = games.reduce((sum, game) => sum + game.time, 0);
    return totalTime / games.length;
  }

  static getRecentGames(count: number = 10): PracticeGameResult[] {
    const games = this.getStats();
    return games.slice(-count).reverse();
  }

  static clearStats(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  static getStatsSummary() {
    const games = this.getStats();
    const wins = games.filter(game => game.result === 'win').length;
    const losses = games.filter(game => game.result === 'lose').length;
    const draws = games.filter(game => game.result === 'draw').length;
    
    return {
      totalGames: games.length,
      wins,
      losses,
      draws,
      winRate: this.getWinRate(),
      averageMoves: this.getAverageMoves(),
      averageTime: this.getAverageTime()
    };
  }
}