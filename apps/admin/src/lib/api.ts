import { NextResponse } from 'next/server';

export function apiError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export function apiOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function internalError(logContext: string, err: unknown) {
  console.error(`[Naijavend Admin] ${logContext}:`, err);
  return apiError(500, 'internal_error', 'Something failed on our side. Try again shortly.');
}
