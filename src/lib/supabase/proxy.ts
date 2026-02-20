import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

type CookieToSet = {
  name: string
  value: string
  options: CookieOptions
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isProtectedRoute = path.startsWith('/dashboard') ||
                            path.startsWith('/onboarding') ||
                            path.startsWith('/settings')
  const isAuthRoute = path.startsWith('/login') || path.startsWith('/signup')

  // 1. Sin sesión + ruta protegida → /login
  if (isProtectedRoute && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // 2. Con sesión + ruta auth → /dashboard
  if (isAuthRoute && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // 3. Con sesión en dashboard/settings → verificar org membership
  if (user && (path.startsWith('/dashboard') || path.startsWith('/settings'))) {
    const { data: membership } = await supabase
      .from('org_members')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()

    if (!membership) {
      return NextResponse.redirect(new URL('/onboarding', request.url))
    }
  }

  // 4. Con sesión en /onboarding + ya tiene org → /dashboard
  if (user && path.startsWith('/onboarding')) {
    const { data: membership } = await supabase
      .from('org_members')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()

    if (membership) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return supabaseResponse
}
