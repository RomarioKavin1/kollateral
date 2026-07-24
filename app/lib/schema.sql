CREATE TABLE IF NOT EXISTS influencers (
  id INTEGER PRIMARY KEY, handle TEXT UNIQUE NOT NULL, display_name TEXT,
  wallet_address TEXT, avatar_url TEXT, claimed INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY, influencer_id INTEGER NOT NULL REFERENCES influencers(id),
  x_post_id TEXT UNIQUE NOT NULL, content TEXT NOT NULL, content_hash TEXT NOT NULL,
  url TEXT NOT NULL, posted_at INTEGER NOT NULL, deleted_at INTEGER, raw_json TEXT);
CREATE TABLE IF NOT EXISTS calls (
  id INTEGER PRIMARY KEY, post_id INTEGER UNIQUE NOT NULL REFERENCES posts(id),
  template TEXT NOT NULL CHECK(template IN ('DIRECTIONAL','TARGET_CALL','GEM_SHILL','AMBIGUOUS')),
  asset_symbol TEXT, asset_address TEXT, chain TEXT DEFAULT 'mainnet',
  direction TEXT CHECK(direction IN ('long','short')), expiry_at INTEGER,
  confidence REAL NOT NULL, status TEXT DEFAULT 'open'
    CHECK(status IN ('open','settled','unpriceable','ambiguous')));
CREATE TABLE IF NOT EXISTS artifacts (
  id INTEGER PRIMARY KEY, call_id INTEGER NOT NULL REFERENCES calls(id),
  request_json TEXT NOT NULL, response_json TEXT NOT NULL,
  chat_id TEXT, tee_signature TEXT, provider_address TEXT, verified INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS marks (
  id INTEGER PRIMARY KEY, call_id INTEGER NOT NULL REFERENCES calls(id),
  kind TEXT NOT NULL CHECK(kind IN ('entry','d1','d7','d30','settle','live')),
  price_usd REAL NOT NULL, source TEXT NOT NULL, marked_at INTEGER NOT NULL,
  UNIQUE(call_id, kind));
CREATE TABLE IF NOT EXISTS wallet_events (
  id INTEGER PRIMARY KEY, influencer_id INTEGER NOT NULL REFERENCES influencers(id),
  tx_hash TEXT NOT NULL, token_address TEXT NOT NULL, side TEXT CHECK(side IN ('buy','sell')),
  usd_value REAL, occurred_at INTEGER NOT NULL, UNIQUE(tx_hash, token_address, side));
CREATE TABLE IF NOT EXISTS contradictions (
  id INTEGER PRIMARY KEY, call_id INTEGER NOT NULL REFERENCES calls(id),
  wallet_event_id INTEGER NOT NULL REFERENCES wallet_events(id), gap_hours REAL);
