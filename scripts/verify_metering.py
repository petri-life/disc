"""End-to-end metering assertions against a locally-booted agar-oss.

Driven by verify-metering.sh (which sets BASE, MINT_SECRET and boots the server
with a real OpenRouter key + the curated personas). Each check states the real
failure it catches; a constant return value cannot satisfy them.

Exit 0 = all passed; non-zero = first failure printed.
"""
from __future__ import annotations

import os
import sys
import time

import httpx

BASE = os.environ["BASE"]
SECRET = os.environ["MINT_SECRET"]
TOPUP_CENTS = 800  # ~$8 fake "pack" — comfortably over a single round's cost
# Real observation: a 36-agent Gemini round takes ~3.5 min wall-clock (sequential
# per-agent calls dominate). 480s gives 2× headroom for slower network days.
ROUND_TIMEOUT_S = 480

# A topic over the 200-char minimum the API enforces.
TOPIC = (
    "We are launching FocusFlow, a task manager that shows exactly one task at a "
    "time with an AI auto-prioritize mode and a $6/mo Pro tier that caps the free "
    "tier history to 7 days. Tell us what you actually think about this direction "
    "and whether the paywall choice is sound."
)

client = httpx.Client(base_url=BASE, timeout=30.0)
failures: list[str] = []


def check(name: str, ok: bool, detail: str = "") -> bool:
    mark = "PASS" if ok else "FAIL"
    print(f"  [{mark}] {name}" + (f" — {detail}" if detail else ""))
    if not ok:
        failures.append(name)
    return ok


# 1. Mint WITHOUT the secret → must be rejected (gate closed on hosted).
r = client.post("/tokens")
check("mint without X-Mint-Secret is rejected (401)", r.status_code == 401,
      f"got {r.status_code}")

# 2. Mint WITH the secret → token issued, starts at 0¢.
r = client.post("/tokens", headers={"X-Mint-Secret": SECRET})
if not check("mint with X-Mint-Secret succeeds (201)", r.status_code == 201, f"got {r.status_code}"):
    print("cannot continue without a token")
    sys.exit(1)
tok = r.json()
token = tok["token"]
check("new token starts at 0¢", tok.get("credit_cents") == 0, f"credit_cents={tok.get('credit_cents')}")

auth = {"X-API-Key": token}

# 3. Running with 0 balance → blocked by the estimate gate (402).
r = client.post("/conversations", headers=auth, json={"topic": TOPIC, "persona_mix": 0.5})
check("zero-balance round is blocked (402)", r.status_code == 402, f"got {r.status_code}")

# 4. Fake payment WITHOUT secret → rejected (top-up is privileged).
r = client.post("/credits/add", json={"token": token, "cents": TOPUP_CENTS})
check("credits/add without secret is rejected (401)", r.status_code == 401, f"got {r.status_code}")

# 5. Fake payment WITH secret → balance goes up by exactly TOPUP_CENTS.
r = client.post("/credits/add", headers={"X-Mint-Secret": SECRET},
                json={"token": token, "cents": TOPUP_CENTS})
ok = r.status_code == 200 and r.json().get("balance_cents") == TOPUP_CENTS
check(f"fake payment credits exactly {TOPUP_CENTS}¢", ok,
      f"status={r.status_code} balance={r.json().get('balance_cents') if r.status_code==200 else '?'}")
balance_before = TOPUP_CENTS

# 6. Run a real round. createConversation runs round 1 then pauses.
r = client.post("/conversations", headers=auth, json={"topic": TOPIC, "persona_mix": 0.5})
if not check("funded round accepted (202)", r.status_code == 202, f"got {r.status_code}"):
    print("\nRESULT: FAIL"); sys.exit(1)
conv_id = r.json()["conversation_id"]
# Gate reserves nothing yet — balance only moves on reconcile. Confirm the
# response echoes the pre-round balance (no upfront charge).
check("no upfront charge at round start", r.json().get("balance_cents") == balance_before,
      f"balance_cents={r.json().get('balance_cents')}")

# Poll until the round completes (status 'paused') or fails.
print(f"  ... running a real Gemini round (conv {conv_id}), up to {ROUND_TIMEOUT_S}s")
deadline = time.time() + ROUND_TIMEOUT_S
status = None
detail = {}
while time.time() < deadline:
    d = client.get(f"/conversations/{conv_id}", headers=auth)
    detail = d.json()
    status = detail["status"]
    if status in ("paused", "done", "converged", "failed"):
        break
    time.sleep(3)

if not check("round reached 'paused' (completed one round)", status == "paused",
             f"status={status} error={detail.get('error')}"):
    print("\nRESULT: FAIL"); sys.exit(1)

# 7. THE core assertion: real cost was reconciled and billed.
cost = detail.get("last_round_cost_cents", 0)
check("real round cost was reconciled (> 0¢)", isinstance(cost, int) and cost > 0,
      f"last_round_cost_cents={cost}")

# 8. Balance dropped by exactly that reconciled cost — billing math is honest.
#    There is no GET-balance endpoint; balance is only echoed by mutations. So
#    apply a known PROBE top-up and read the balance it returns. After the round
#    the balance is (start − cost); the probe makes it (start − cost + probe).
PROBE = 100
r = client.post("/credits/add", headers={"X-Mint-Secret": SECRET},
                json={"token": token, "cents": PROBE})
balance_after_probe = r.json().get("balance_cents")
expected = balance_before - cost + PROBE
check("balance == start − reconciled cost", balance_after_probe == expected,
      f"after_probe={balance_after_probe}, expected {balance_before}−{cost}+{PROBE}={expected}")

print()
if failures:
    print(f"RESULT: FAIL ({len(failures)} check(s): {', '.join(failures)})")
    sys.exit(1)
print(f"RESULT: PASS — metered a real round at {cost}¢, balance reconciled exactly.")
