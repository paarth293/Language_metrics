import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const adminSession = request.cookies.get('admin_session')?.value
  
  // If no session cookie exists and the user is not already on /login, redirect to /login
  if (!adminSession && !request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // If session exists and user is on /login, redirect to dashboard
  if (adminSession && request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  // Apply middleware to all routes except api, _next/static, _next/image, and favicon/brand assets
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|brand).*)'],
}
