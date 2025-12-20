import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Handle CORS for API routes and other requests
  const response = NextResponse.next();

  // Get allowed origins from environment variable or use defaults
  // Format in .env: NEXT_PUBLIC_CORS_ORIGINS=http://localhost:5173,http://localhost:3000,capacitor://localhost
  const allowedOrigins = process.env.NEXT_PUBLIC_CORS_ORIGINS?.split(',').map(o => o.trim()) || [
    'http://localhost:5173',
    'http://localhost:3000',
    'capacitor://localhost',
    'ionic://localhost',
    'http://localhost',
  ];

  // Get the origin from the request
  const origin = request.headers.get('origin');

  // Set CORS headers if origin is allowed or if it's a same-origin request
  if (origin && (allowedOrigins.includes(origin) || allowedOrigins.includes('*'))) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD'
    );
    response.headers.set(
      'Access-Control-Allow-Headers',
      'Authorization, X-Space-Code, Content-Type, Accept, Cache-Control, Connection, Pragma, Expires, X-Accel-Buffering'
    );
    response.headers.set('Access-Control-Expose-Headers', 'Authorization, X-Space-Code, Content-Disposition, Content-Type, Cache-Control, Connection');
    response.headers.set('Access-Control-Max-Age', '600');
  }

  // Handle preflight OPTIONS requests
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': origin || '*',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD',
        'Access-Control-Allow-Headers': 'Authorization, X-Space-Code, Content-Type, Accept, Cache-Control, Connection, Pragma, Expires, X-Accel-Buffering',
        'Access-Control-Max-Age': '600',
      },
    });
  }

  return response;
}

// Configure which routes the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};


