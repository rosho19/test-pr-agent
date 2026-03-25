import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  const reviews = await prisma.review.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const parsed = reviews.map((r) => ({
    ...r,
    issues: JSON.parse(r.issues),
    toolCalls: JSON.parse(r.toolCalls),
  }));

  return NextResponse.json(parsed);
}
