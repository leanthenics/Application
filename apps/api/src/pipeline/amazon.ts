import { config } from '../config.js';

/**
 * Amazon affiliate link builder (architecture §5, decision 5). Each detected
 * product key-term becomes one affiliate **search** URL:
 *
 *   https://www.amazon.<AMAZON_TLD>/s?k=<urlencoded keyterm>&tag=<AMAZON_AFFILIATE_TAG>
 *
 * `AMAZON_TLD` (default `in`) and `AMAZON_AFFILIATE_TAG` come from env via
 * `config.amazon`. The tag is appended even when empty (URL ends `&tag=`) — that
 * matches the locked URL spec and is intentional until a real tag is provided.
 * No PA-API in phase 1.
 */
export function buildAmazonUrl(keyterm: string): string {
  const { tld, affiliateTag } = config.amazon;
  return `https://www.amazon.${tld}/s?k=${encodeURIComponent(keyterm)}&tag=${encodeURIComponent(affiliateTag)}`;
}
