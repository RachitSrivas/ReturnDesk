import { NextResponse } from 'next/server';
import { ReturnService } from '@/services/return-service';
import { editReturnSchema } from '@/lib/validations';
import { errorResponse } from '@/lib/errors';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const result = await ReturnService.get(params.id);
    return NextResponse.json(result);
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const json = await request.json();
    const parsed = editReturnSchema.parse(json);
    const updated = await ReturnService.edit(params.id, parsed);
    return NextResponse.json(updated);
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    await ReturnService.softDelete(params.id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
