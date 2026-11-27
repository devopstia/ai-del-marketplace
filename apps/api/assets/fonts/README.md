# Cover fonts

Schibsted Grotesk (600, 700, 800), the site's display font, used by `src/covers/cover-render.ts` to draw course covers on the
server. Licence: SIL Open Font License 1.1 (https://openfontlicense.org). Source: Google Fonts (Schibsted Grotesk, by
Schibsted). The same font is used by the web app through next/font.

# Certificate fonts

EB Garamond (Regular, Medium, SemiBold, Italic), used by `src/certificates/certificate-render.ts` for the official
certificate (Academic Excellence). Licence: SIL Open Font License 1.1. Source: the EB Garamond project
(https://github.com/octaviopardo/EBGaramond12, static TTFs), the same family Google Fonts serves.

# Receipt fonts

Atkinson Hyperlegible Next (400, 600, 700; the site's text font, by the Braille Institute) and JetBrains Mono (400, by
JetBrains), static TTFs from Google Fonts, embedded (subset) in receipt PDFs by `src/receipts/receipt-pdf.ts` together
with Schibsted Grotesk 700/800. Licence: SIL Open Font License 1.1.
