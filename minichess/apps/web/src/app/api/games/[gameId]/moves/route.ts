import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

// Initialize Redis from environment variables
// Supports both Vercel KV (KV_REST_API_URL/KV_REST_API_TOKEN)
// and Upstash (UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN)
const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

interface GameMove {
  from: string;
  to: string;
  promotion?: string;
  player: string;
  timestamp: number;
  moveNumber: number;
}

/**
 * GET /api/games/[gameId]/moves
 * Retrieve all moves for a specific game from Upstash Redis
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { gameId: string } }
) {
  try {
    const gameId = params.gameId;
    
    if (!gameId) {
      return NextResponse.json(
        { error: 'Game ID is required' },
        { status: 400 }
      );
    }

    // Fetch moves from Redis
    // lrange returns a list of items. Upstash Redis automatically parses JSON if stored as such.
    const moves = await redis.lrange(`game:${gameId}:moves`, 0, -1) || [];
    
    return NextResponse.json({
      gameId,
      moves,
      count: moves.length,
      lastUpdate: moves.length > 0 ? (moves[moves.length - 1] as any).timestamp : null
    });
  } catch (error) {
    console.error('Error fetching moves:', error);
    return NextResponse.json(
      { error: 'Failed to fetch moves' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/games/[gameId]/moves
 * Submit a new move for a specific game to Upstash Redis
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { gameId: string } }
) {
  try {
    const gameId = params.gameId;
    
    if (!gameId) {
      return NextResponse.json(
        { error: 'Game ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { from, to, promotion, player } = body;

    // Validate required fields
    if (!from || !to || !player) {
      return NextResponse.json(
        { error: 'Missing required fields: from, to, player' },
        { status: 400 }
      );
    }

    // Get current count to determine move number
    const currentCount = await redis.llen(`game:${gameId}:moves`);

    // Create new move
    const newMove: GameMove = {
      from,
      to,
      promotion,
      player,
      timestamp: Date.now(),
      moveNumber: currentCount + 1
    };

    // Add move to Redis
    await redis.rpush(`game:${gameId}:moves`, newMove);

    console.log(`[Game ${gameId}] Move ${newMove.moveNumber}: ${from} -> ${to} by ${player.slice(0, 6)}...`);

    return NextResponse.json({
      success: true,
      move: newMove,
      totalMoves: currentCount + 1
    });
  } catch (error) {
    console.error('Error submitting move:', error);
    return NextResponse.json(
      { error: 'Failed to submit move' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/games/[gameId]/moves
 * Clear all moves for a game from Upstash Redis
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { gameId: string } }
) {
  try {
    const gameId = params.gameId;
    
    if (!gameId) {
      return NextResponse.json(
        { error: 'Game ID is required' },
        { status: 400 }
      );
    }

    await redis.del(`game:${gameId}:moves`);

    return NextResponse.json({
      success: true,
      message: `Moves cleared for game ${gameId}`
    });
  } catch (error) {
    console.error('Error clearing moves:', error);
    return NextResponse.json(
      { error: 'Failed to clear moves' },
      { status: 500 }
    );
  }
}
