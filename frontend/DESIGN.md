# RoomFlow DESIGN.md -- Sport Athletic / Professional

Pattern: Minimalism Hero+Features+CTA | Style: Minimalism + sport energy
Generated via ui-ux-pro-max, adjusted for mobile-first 375/768/1024.

## Tokens (globals.css :root)
- Background #FFFBEB | Foreground #78350F | Card #FFFFFF | Muted #F1F2EF
- Primary Navy #143258 on #FFFFFF (trust) | Secondary #FBBF24 on #0F172A
- Accent/Sport Amber #F59E0B on #0F172A | Sport Blue #2563EB on #FFF
- Border #FDE68A | Destructive #DC2626 | Ring #F59E0B
- Sidebar #0F172A / #FFFBEB -- navy retained for app chrome
- Dark: Bg #0F172A, Card #1E293B, Border #334155, Primary becomes amber

## Typography
- Barlow Condensed 400/500/600/700 -- headings, uppercase, tight -0.02em, 32px+ mobile
- Barlow 300/400/500/600/700 -- body
- CSS vars: --font-barlow, --font-barlow-condensed; --font-heading uses condensed first

## Spacing and Layout
- --section-gap 3rem (48px) | --header-height 64px | scroll-margin-top = header
- --touch-min 44px | 8px gap | bottom nav <=5 items | peeking + snap on FeaturedSpaces
- safe-area-inset-bottom respected; reduced-motion respected

## Components
- Button: min-h 44px, focus-visible ring amber, active scale 0.98, secondary white/amber border
- Navbar: scrolled = white/amber border, transparent over hero before scroll; 44px toggle, drawer lock
- Hero: navy overlay + amber diagonal, condensed headline, stats 2x2 on mobile, sticky CTA sm
- SportsZone: whole card = button to /login, price badge, booked overlay, amber left border
- FeaturedSpaces: snap mandatory, 280px mobile peeking, 320px desktop, chevrons desktop only
- MobileBottomNav: <md fixed, 5 items, safe-bottom, amber top border

## Accessibility
- Viewport: maximumScale 5, userScalable true, viewportFit cover
- Focus rings 2px amber, contrast 4.5:1 (amber on navy 7.2:1, white on navy passes)
- Reduced-motion disables animations; Input 16px prevents iOS zoom
