import { NextResponse } from 'next/server';
import { ReturnService } from '@/services/return-service';
import { changeStatusSchema } from '@/lib/validations';
import { errorResponse } from '@/lib/errors';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const json = await request.json();
    const parsed = changeStatusSchema.parse(json);
    const { status, resolution, refundAmount } = parsed;
    const updated = await ReturnService.changeStatus(params.id, status as any, { resolution, refundAmount });
    return NextResponse.json(updated);
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
