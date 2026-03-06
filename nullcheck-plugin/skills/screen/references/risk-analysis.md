# Risk Analysis — Deep Reference

## How nullcheck Scores Risk

nullcheck's risk engine analyzes four dimensions of token safety and produces a composite score from 0-100. Each dimension has a maximum contribution to the total score, weighted by how dangerous each type of risk is.

### Dimension 1: Honeypot Detection (0-50 points)

Honeypots are tokens designed to trap buyers — you can buy them but you cannot sell. This is the single most expensive mistake in DeFi, which is why it carries 50% of the total score weight.

**How nullcheck detects honeypots:**
- Simulates a buy and sell transaction on the token's DEX pair
- Measures the actual buy tax and sell tax applied by the contract
- Checks if the sell function reverts entirely (hard honeypot)
- Checks if the sell tax is so high it's effectively unsellable (soft honeypot)

**Key fields:**
- `isHoneypot` (boolean): If `true`, selling is blocked or economically impossible. This is the single most important field in the entire API. If true, DO NOT BUY.
- `buyTax` (number, 0-100): Percentage taken on purchase. Normal tokens: 0-2%. Suspicious: 5-10%.
- `sellTax` (number, 0-100): Percentage taken on sale. Normal: 0-2%. Scam indicator: >10%. Honeypot: >50% or sell reverts entirely.
- `cannotSell` (boolean): Whether selling is completely blocked at the contract level.

**Tax interpretation guide:**
| Buy Tax | Sell Tax | Interpretation |
|---|---|---|
| 0-2% | 0-2% | Normal. Most legitimate tokens. |
| 3-5% | 3-5% | Reflection/reward token. May be intentional. Check project. |
| 0-2% | 10-25% | Suspicious. Could be anti-dump mechanism or soft honeypot. |
| 0-2% | 50-100% | Honeypot. You lose most/all value on sell. |
| 0% | Reverts | Hard honeypot. Sell function disabled in contract. |
| 5-10% | 5-10% | High-tax token. Might be legitimate but costly to trade. |

**Common honeypot patterns:**
1. **Time-delayed honeypot:** Buy tax starts at 0%, sell tax increases over time via contract upgrade.
2. **Whitelist honeypot:** Only whitelisted addresses can sell. Buyers are not whitelisted.
3. **Balance-check honeypot:** Sell function checks caller's balance against a hidden requirement.
4. **Cooldown honeypot:** Sell function requires waiting period that keeps extending.
5. **Max-sell honeypot:** Sell function limits amount per transaction to tiny fractions.

### Dimension 2: Contract Analysis (0-30 points)

Smart contract red flags that indicate the creator retains too much control or the contract has dangerous capabilities.

**Key fields:**
- `verified` (boolean): Whether source code is published and verified on the block explorer (Etherscan, Basescan, Solscan). Unverified = you can't see what the code does. Major red flag.
- `renounced` (boolean): Whether contract ownership has been renounced (transferred to the zero address). If `false`, the owner can still call admin functions like pausing trading, changing taxes, minting tokens, or blacklisting addresses.
- `hasMintFunction` (boolean): Whether the contract has a function that can create new tokens. If `true`, the creator can print unlimited tokens and dump them on the market, diluting all holders to near-zero value.
- `maxTaxPercent` (number): The maximum buy or sell tax the contract allows. Some contracts have a hardcoded max (e.g., 25%); others allow the owner to set it to 100%.

**Risk combinations:**
| Verified | Renounced | Mint | Interpretation |
|---|---|---|---|
| Yes | Yes | No | Best case. Creator has no special powers. |
| Yes | No | No | Creator retains control but can't mint. Watch for tax changes. |
| Yes | No | Yes | Dangerous. Creator can mint and dump at any time. |
| No | No | Unknown | Worst case. You have no idea what the contract does. |
| No | Yes | Unknown | Slightly better — ownership renounced, but code is hidden. |

### Dimension 3: Holder Distribution (0-15 points)

How evenly the token supply is distributed across wallets. High concentration means a small group can manipulate the price.

**Key fields:**
- `totalHolders` (integer): Number of unique addresses holding the token.
- `top10Percent` (number): Percentage of total supply held by the top 10 wallets.
- `creatorHoldingPercent` (number): Percentage held by the deployer wallet.

**Concentration risk guide:**
| top10Percent | Risk Level | Meaning |
|---|---|---|
| < 30% | Low | Well-distributed. Hard for any group to coordinate a dump. |
| 30-50% | Medium | Moderate concentration. Watch for whale exits. |
| 50-70% | High | Top 10 wallets control majority. Rug pull possible. |
| > 70% | Extreme | Token is effectively controlled by a handful of wallets. |

**Creator holding guide:**
| Creator % | Interpretation |
|---|---|
| 0% | Creator sold or burned their allocation. Neutral to positive. |
| 1-5% | Normal. Small founder allocation. |
| 5-10% | Moderate. Creator still has meaningful position. |
| > 10% | High. Creator can significantly impact price by selling. |
| > 25% | Very high. Creator holds enough to crash the price. |

**Holder count guide:**
| Holders | Stage | Interpretation |
|---|---|---|
| < 50 | Very early | Could be legitimate launch or artificial. Very risky. |
| 50-200 | Early | Token gaining some distribution. Still risky. |
| 200-1000 | Growing | Meaningful community forming. Moderate risk. |
| 1000-10000 | Established | Well-distributed. Lower concentration risk. |
| > 10000 | Mature | Large community. Hard to rug pull via selling alone. |

### Dimension 4: Liquidity Health (0-5 points)

The depth and safety of the DEX liquidity pool(s) backing the token.

**Key fields:**
- `liquidity` (number): Total USD value locked in DEX pools. This determines how much you can trade without massive slippage.
- `lpLocked` (boolean): Whether the liquidity provider tokens are locked in a timelock contract.
- `lpLockedPercent` (number): What percentage of LP tokens are locked (0-100).

**Liquidity depth guide:**
| Liquidity | Tradability | Slippage on $1K trade |
|---|---|---|
| < $1,000 | Untradeable | 50%+ — don't even try |
| $1K - $10K | Micro | 10-50% — only tiny amounts |
| $10K - $50K | Thin | 2-10% — small trades only |
| $50K - $100K | Moderate | 1-2% — reasonable for retail |
| $100K - $500K | Healthy | <1% — good for most trades |
| > $500K | Deep | Minimal slippage — trade freely |

**LP lock guide:**
- `lpLocked == true` + `lpLockedPercent > 90%`: Good. Liquidity can't be pulled.
- `lpLocked == true` + `lpLockedPercent < 50%`: Partial protection. Significant LP still free.
- `lpLocked == false`: No protection. Anyone holding LP tokens can pull liquidity and crash the price instantly. This is one of the most common rug pull methods.

---

## Common Scam Patterns

### 1. Classic Rug Pull
Creator launches token → promotes it → price rises → creator removes all liquidity → price crashes to zero. **Detection:** Check `lpLocked`. If false, this is possible at any time.

### 2. Honeypot
Token appears to have active trading → victims buy → selling is blocked or taxed to near-100%. **Detection:** `isHoneypot == true` or `sellTax > 25%`.

### 3. Slow Rug
Creator holds large supply → gradually sells over days/weeks → price slowly bleeds. **Detection:** `creatorHoldingPercent > 10%` combined with whale sell activity.

### 4. Mint and Dump
Creator mints new tokens → floods the market → all holders diluted. **Detection:** `hasMintFunction == true` combined with `renounced == false`.

### 5. Tax Increase
Token launches with 0% tax → owner increases sell tax to 50-99% after people buy. **Detection:** `renounced == false` + current `sellTax` is low but `maxTaxPercent` is high.

### 6. Whale Coordination
Multiple wallets (same owner) accumulate → coordinate sell at peak. **Detection:** `top10Percent > 60%` + multiple top holders are fresh wallets.

---

## Interpreting Whale Data

### Whale Activity (get_whale_activity)
- `netFlow24h > 0`: More whale buys than sells in 24h. Bullish signal — smart money is accumulating.
- `netFlow24h < 0`: More whale sells than buys. Bearish signal — smart money is exiting.
- `netFlow24h == 0`: Balanced or no whale activity. Neutral.
- Large single transaction (>$100K): Check if buy or sell. A single large sell can crater a thin market.

### Whale Holders (get_whale_holders)
- Check `tag` field: "DEX" and "Burn" addresses are not real holders (don't count toward concentration).
- Check `isLocked`: Locked tokens can't be sold. Reduces effective concentration risk.
- Check `isContract`: Contract addresses might be vesting schedules, LP, or DeFi protocols — not individual holders.
