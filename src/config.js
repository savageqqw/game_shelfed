// Donation details shown on /donate.
export const MONO_JAR_URL = 'https://send.monobank.ua/jar/2dtCTR24Th'

const EVM_ADDRESS = '0xa551001916727Bb94A48fb12549D5903B056B873'

// `tag` is the token standard / chain type printed next to the network name
export const CRYPTO_WALLETS = [
  { id: 'eth', network: 'Ethereum', tag: 'ERC-20', address: EVM_ADDRESS },
  { id: 'tron', network: 'Tron', tag: 'TRC-20', address: 'TJ7A1cPGQEVafgfna8Faj8koibHn7Xddxd' },
  { id: 'sol', network: 'Solana', tag: 'SPL', address: '9GcgZaVSJ3kjZKKC8MEdLpkvUzpeJPLQvqyCtKZw8B3w' },
  { id: 'bsc', network: 'BNB Smart Chain', tag: 'BEP-20', address: EVM_ADDRESS },
  { id: 'base', network: 'Base', tag: 'EVM', address: EVM_ADDRESS },
  { id: 'robinhood', network: 'Robinhood Chain', tag: 'EVM', address: EVM_ADDRESS }
]

// Contact for privacy questions, shown on /privacy. With no email set the
// page points to the project's GitHub issues instead.
export const CONTACT_EMAIL = ''
export const CONTACT_URL = 'https://github.com/savageqqw/game_shelfed/issues'
