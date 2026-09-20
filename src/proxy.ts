import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isGated } from "@/lib/geo";

/** Session refresh + route protection + CA/NY geo-gate (Next 16 proxy, formerly middleware). */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (all) => {
        all.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        all.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  // Geo-gate by Vercel's region header (state code for US requests). The signup form checks the chosen state too.
  if (path === "/signup" && request.headers.get("x-vercel-ip-country") === "US" && isGated(request.headers.get("x-vercel-ip-country-region"))) {
    const url = request.nextUrl.clone(); url.pathname = "/not-yet"; url.searchParams.set("state", request.headers.get("x-vercel-ip-country-region")!);
    return NextResponse.redirect(url);
  }
  if (path.startsWith("/app") && !user) {
    const url = request.nextUrl.clone(); url.pathname = "/login"; url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }
  if ((path === "/login" || path === "/signup") && user) {
    const url = request.nextUrl.clone(); url.pathname = "/app"; url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|api/cron|.*\\.(?:png|svg|ico|jpg)).*)"] };
