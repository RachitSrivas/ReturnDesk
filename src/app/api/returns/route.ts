import { NextResponse } from 'next/server';
import { ReturnService } from '@/services/return-service';
import { createReturnSchema, editReturnSchema, changeStatusSchema, addNoteSchema } from '@/lib/validations';
import { errorResponse } from '@/lib/errors';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const params = {
    search: url.searchParams.get('search') ?? undefined,
    status: url.searchParams.getAll('status'),
    reason: url.searchParams.getAll('reason'),
    sortBy: (url.searchParams.get('sortBy') as any) ?? 'createdAt',
    sortOrder: (url.searchParams.get('order') as any) ?? 'desc',
    page: parseInt(url.searchParams.get('page') ?? '1'),
    limit: parseInt(url.searchParams.get('limit') ?? '10'),
  };
  try {
    const result = await ReturnService.list(params);
    return NextResponse.json(result);
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = createReturnSchema.parse(json);
    const created = await ReturnService.create(parsed);
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
