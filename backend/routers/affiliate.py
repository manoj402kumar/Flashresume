import asyncio
import random
import string
from fastapi import APIRouter, HTTPException, Header, Request
from pydantic import BaseModel
from typing import Optional
import supabase_client as sc
from supabase_client import sb

router = APIRouter()

# ─── helpers ───────────────────────────────────────────────────────────────

def _generate_code(length: int = 8) -> str:
    """Generate a short random alphanumeric affiliate code."""
    chars = string.ascii_lowercase + string.digits
    return ''.join(random.choices(chars, k=length))

async def _get_auth_user(authorization: str | None):
    """Decode Supabase JWT and return user object. Raises 401 on failure."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization.split(" ", 1)[1]
    try:
        user_res = await asyncio.to_thread(sc.supabase.auth.get_user, token)
        if not user_res or not user_res.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user_res.user
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

# ─── request models ────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    name: str
    email: str
    avatar_url: Optional[str] = None

class UpdateUpiRequest(BaseModel):
    upi_id: str

class PayoutRequest(BaseModel):
    pass   # amount is derived from current balance

class ProcessPayoutRequest(BaseModel):
    payout_id: str
    admin_note: Optional[str] = None

# ─── endpoints ─────────────────────────────────────────────────────────────

@router.get("/affiliate/public-list")
async def get_public_affiliates():
    """Return all active affiliates for the public wall (no auth required)."""
    if not sc.supabase:
        return []
    try:
        res = await sb(
            lambda: sc.supabase.table("affiliates")
            .select("name, email, avatar_url, affiliate_code, total_earned, created_at")
            .eq("status", "active")
            .order("total_earned", desc=True)
            .execute()
        )
        return res.data or []
    except Exception as e:
        print(f"[affiliate/public-list] error: {e}")
        return []


@router.post("/affiliate/register")
async def register_affiliate(body: RegisterRequest, authorization: str = Header(None)):
    """Register the authenticated user as an affiliate. Idempotent."""
    user = await _get_auth_user(authorization)

    if not sc.supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    # Check if already registered
    existing = await sb(
        lambda: sc.supabase.table("affiliates")
        .select("id, affiliate_code, status")
        .eq("user_id", str(user.id))
        .execute()
    )
    if existing.data:
        return existing.data[0]

    # Ensure user row exists in public.users (Google OAuth users may not have it yet)
    user_check = await sb(
        lambda: sc.supabase.table("users")
        .select("id")
        .eq("id", str(user.id))
        .execute()
    )
    if not user_check.data:
        await sb(
            lambda: sc.supabase.table("users")
            .insert({"id": str(user.id), "email": body.email})
            .execute()
        )

    # Generate a unique code (retry up to 5 times on collision)
    code = None
    for _ in range(5):
        candidate = _generate_code()
        check = await sb(
            lambda: sc.supabase.table("affiliates")
            .select("id")
            .eq("affiliate_code", candidate)
            .execute()
        )
        if not check.data:
            code = candidate
            break

    if not code:
        raise HTTPException(status_code=500, detail="Could not generate unique code. Try again.")

    res = await sb(
        lambda: sc.supabase.table("affiliates")
        .insert({
            "user_id": str(user.id),
            "name": body.name[:100],
            "email": body.email[:200],
            "avatar_url": body.avatar_url,
            "affiliate_code": code,
            "status": "active",
        })
        .select()
        .execute()
    )

    return res.data[0] if res.data else {"affiliate_code": code}


@router.get("/affiliate/me")
async def get_my_affiliate_data(authorization: str = Header(None)):
    """Return the authenticated affiliate's dashboard data."""
    user = await _get_auth_user(authorization)

    if not sc.supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    # Fetch affiliate record
    aff_res = await sb(
        lambda: sc.supabase.table("affiliates")
        .select("*")
        .eq("user_id", str(user.id))
        .execute()
    )
    if not aff_res.data:
        raise HTTPException(status_code=404, detail="Not registered as affiliate")

    affiliate = aff_res.data[0]
    aff_id = affiliate["id"]

    # Fetch last 50 conversions
    conv_res = await sb(
        lambda: sc.supabase.table("affiliate_conversions")
        .select("plan_type, plan_amount, commission_amount, status, created_at")
        .eq("affiliate_id", aff_id)
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )

    # Fetch last 20 payouts
    payout_res = await sb(
        lambda: sc.supabase.table("affiliate_payouts")
        .select("amount, upi_id, status, requested_at, processed_at")
        .eq("affiliate_id", aff_id)
        .order("requested_at", desc=True)
        .limit(20)
        .execute()
    )

    return {
        **affiliate,
        "conversions": conv_res.data or [],
        "payouts": payout_res.data or [],
    }


@router.put("/affiliate/update-upi")
async def update_upi(body: UpdateUpiRequest, authorization: str = Header(None)):
    """Save or update the affiliate's UPI ID."""
    user = await _get_auth_user(authorization)

    if not sc.supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    # Basic UPI format check: something@something
    if "@" not in body.upi_id or len(body.upi_id) < 5:
        raise HTTPException(status_code=400, detail="Invalid UPI ID format")

    await sb(
        lambda: sc.supabase.table("affiliates")
        .update({"upi_id": body.upi_id.strip()})
        .eq("user_id", str(user.id))
        .execute()
    )
    return {"status": "ok"}


@router.post("/affiliate/request-payout")
async def request_payout(authorization: str = Header(None)):
    """Create a payout request for the affiliate's pending balance (min ₹300)."""
    user = await _get_auth_user(authorization)

    if not sc.supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    aff_res = await sb(
        lambda: sc.supabase.table("affiliates")
        .select("id, earnings_balance, upi_id")
        .eq("user_id", str(user.id))
        .execute()
    )
    if not aff_res.data:
        raise HTTPException(status_code=404, detail="Not registered as affiliate")

    affiliate = aff_res.data[0]
    balance = float(affiliate["earnings_balance"] or 0)
    upi_id = affiliate.get("upi_id")

    if not upi_id:
        raise HTTPException(status_code=400, detail="Please save your UPI ID before requesting a payout")

    if balance < 300:
        raise HTTPException(
            status_code=400,
            detail=f"Minimum payout is ₹300. Your current balance is ₹{balance:.0f}"
        )

    # Check for a pending payout that hasn't been processed yet
    pending_check = await sb(
        lambda: sc.supabase.table("affiliate_payouts")
        .select("id")
        .eq("affiliate_id", affiliate["id"])
        .eq("status", "pending")
        .execute()
    )
    if pending_check.data:
        raise HTTPException(status_code=400, detail="You already have a pending payout request")

    # Create the payout row
    payout_amount = balance
    await sb(
        lambda: sc.supabase.table("affiliate_payouts")
        .insert({
            "affiliate_id": affiliate["id"],
            "amount": payout_amount,
            "upi_id": upi_id,
            "status": "pending",
        })
        .execute()
    )

    # Deduct balance immediately so it "feels" instant
    await sb(
        lambda: sc.supabase.table("affiliates")
        .update({"earnings_balance": 0})
        .eq("id", affiliate["id"])
        .execute()
    )

    return {
        "status": "ok",
        "amount": payout_amount,
        "upi_id": upi_id,
        "message": f"₹{payout_amount:.0f} transfer initiated to {upi_id}. Funds will reflect within 24 hours."
    }


# ─── Admin-only endpoints ──────────────────────────────────────────────────

@router.get("/affiliate/admin/payouts")
async def admin_get_payouts():
    """Return all pending + recent payout requests for admin dashboard."""
    if not sc.supabase:
        return []
    try:
        res = await sb(
            lambda: sc.supabase.table("affiliate_payouts")
            .select("*, affiliates(name, email, affiliate_code)")
            .order("requested_at", desc=True)
            .limit(100)
            .execute()
        )
        return res.data or []
    except Exception as e:
        print(f"[affiliate/admin/payouts] error: {e}")
        return []


@router.post("/affiliate/admin/mark-processed")
async def admin_mark_processed(body: ProcessPayoutRequest):
    """Mark a payout as processed (called from admin dashboard)."""
    if not sc.supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    from datetime import datetime, timezone
    await sb(
        lambda: sc.supabase.table("affiliate_payouts")
        .update({
            "status": "processed",
            "processed_at": datetime.now(timezone.utc).isoformat(),
            "admin_note": body.admin_note,
        })
        .eq("id", body.payout_id)
        .execute()
    )

    # Also mark conversions as paid_out for this affiliate
    payout_res = await sb(
        lambda: sc.supabase.table("affiliate_payouts")
        .select("affiliate_id")
        .eq("id", body.payout_id)
        .execute()
    )
    if payout_res.data:
        aff_id = payout_res.data[0]["affiliate_id"]
        await sb(
            lambda: sc.supabase.table("affiliate_conversions")
            .update({"status": "paid_out"})
            .eq("affiliate_id", aff_id)
            .eq("status", "credited")
            .execute()
        )

    return {"status": "ok"}
