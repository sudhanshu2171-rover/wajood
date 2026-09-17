import { KiteTicker } from 'kiteconnect';

export type LiveTick = {
  instrument_token: number;
  last_price: number;
  volume?: number;
  oi?: number;
  timestamp?: string;
  exchange_timestamp?: string;
};

type Listener = (ticks: LiveTick[]) => void;

export class KiteMarketStream {
  private ticker: any = null;
  private listeners = new Set<Listener>();
  private subscribed = new Set<number>();
  private connected = false;
  private lastTickAt: string | null = null;
  private lastError: string | null = null;

  constructor(private readonly apiKey: string, private readonly accessToken: string) {}

  connect() {
    if (this.connected || this.ticker) return;
    this.ticker = new KiteTicker({ api_key: this.apiKey, access_token: this.accessToken });
    this.ticker.autoReconnect(true, 10, 5);
    this.ticker.on('connect', () => {
      this.connected = true;
      this.lastError = null;
      if (this.subscribed.size) this.ticker.subscribe([...this.subscribed]);
      if (this.subscribed.size) this.ticker.setMode(this.ticker.modeFull, [...this.subscribed]);
    });
    this.ticker.on('ticks', (ticks: LiveTick[]) => {
      this.lastTickAt = new Date().toISOString();
      this.listeners.forEach(listener => listener(ticks));
    });
    this.ticker.on('disconnect', () => { this.connected = false; });
    this.ticker.on('error', (error: Error) => { this.lastError = error?.message || 'KITE_STREAM_ERROR'; });
    this.ticker.on('close', () => { this.connected = false; });
    this.ticker.connect();
  }

  subscribe(tokens: number[]) {
    tokens.filter(Number.isInteger).forEach(token => this.subscribed.add(token));
    if (this.connected && this.subscribed.size) {
      const list = [...this.subscribed];
      this.ticker.subscribe(list);
      this.ticker.setMode(this.ticker.modeFull, list);
    }
  }

  onTicks(listener: Listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }

  status() {
    return {
      configured: Boolean(this.apiKey && this.accessToken),
      connected: this.connected,
      subscribedTokens: [...this.subscribed],
      lastTickAt: this.lastTickAt,
      lastError: this.lastError,
      stale: !this.lastTickAt || Date.now() - Date.parse(this.lastTickAt) > 10000,
    };
  }
}

export function createKiteMarketStreamFromEnv() {
  const apiKey = process.env.KITE_API_KEY?.trim();
  const accessToken = process.env.KITE_ACCESS_TOKEN?.trim();
  if (!apiKey || !accessToken) return null;
  return new KiteMarketStream(apiKey, accessToken);
}
