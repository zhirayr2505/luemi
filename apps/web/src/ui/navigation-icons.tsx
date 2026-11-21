import type {ReactNode} from "react";

function NavigationGlyph({children}: {children:ReactNode}){
 return <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.1"
  strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
  {children}
 </svg>;
}

export function NavigationDiscover(){
 return <NavigationGlyph>
  <path d="m10.4 9.8-7 1.9a2.3 2.3 0 0 0-1.6 2.8l3.3 12.7a2.3 2.3 0 0 0 2.8 1.6l8.9-2.4"/>
  <rect x="13" y="4" width="15.7" height="20.5" rx="3" transform="rotate(15 20.85 14.25)"/>
 </NavigationGlyph>;
}

export function NavigationLikes(){
 return <NavigationGlyph>
  <path d="M16 28.2 4.1 16.7a7.2 7.2 0 0 1 10.1-10.3L16 8.2l1.8-1.8a7.2 7.2 0 1 1 10.1 10.3L16 28.2Z"/>
 </NavigationGlyph>;
}

export function NavigationChats(){
 return <NavigationGlyph>
  <path d="M4 12.8A8 8 0 0 1 12 4.8h8.1a8 8 0 0 1 8 8v2a8 8 0 0 1-8 8h-6.5l-6.8 5.4.8-6.7A8 8 0 0 1 4 14.8v-2Z"/>
 </NavigationGlyph>;
}

export function NavigationProfile(){
 return <NavigationGlyph>
  <circle cx="16" cy="9.2" r="5"/>
  <path d="M6.4 26.6v-3.5c0-4.4 4.3-7 9.6-7s9.6 2.6 9.6 7v3.5a1 1 0 0 1-1 1H7.4a1 1 0 0 1-1-1Z"/>
 </NavigationGlyph>;
}
