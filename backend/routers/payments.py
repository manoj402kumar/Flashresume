from fastapi import APIRouter, HTTPException, Request, Header
import asyncio
import hmac
from pydantic import BaseModel
import razorpay
import os
import random
import httpx
from dotenv import load_dotenv
import json
import supabase_client as sc
from supabase_client import sb
from datetime import datetime, timedelta, timezone

load_dotenv(override=True)

if not os.getenv("RAZORPAY_WEBHOOK_SECRET"):
    raise RuntimeError("RAZORPAY_WEBHOOK_SECRET is not set. Refusing to start.")

router = APIRouter()
from rate_limiter import limiter

# Initialize Razorpay client
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "rzp_test_xxxxxxxxxxxxxxx")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "xxxxxxxxxxxxxxxxxxxxxxxx")
client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))

class OrderRequest(BaseModel):
    amount: int | None = None  # Deprecated: client amounts are ignored
    plan_type: str
    user_id: str
    email: str = None

@router.post("/payments/create-order")
@limiter.limit("10/minute")
async def create_order(request: Request, body: OrderRequest, authorization: str = Header(None)):
    PRICES = {
        "pay_per_use": 2900,
        "bulk_offer": 59900,
        "student": 9900
    }
    amount_in_paise = PRICES.get(body.plan_type)
    if not amount_in_paise:
        raise HTTPException(status_code=400, detail="Invalid plan type")
    
    # Ensure user exists in public.users to prevent foreign key constraint violations
    if sc.supabase and body.email:
        try:
            # Check if user exists
            user_check = await sb(lambda: sc.supabase.table("users").select("id").eq("id", body.user_id).execute())
            if not user_check.data:
                # Insert missing user record
                await sb(lambda: sc.supabase.table("users").insert({
                    "id": body.user_id,
                    "email": body.email
                }).execute())
        except Exception as e:
            print(f"Failed to ensure user exists in public.users: {e}")
            # Continue anyway, let it fail at payments insert if it must
            
    try:
        order = await asyncio.to_thread(
            lambda: client.order.create({
                "amount": amount_in_paise,
                "currency": "INR",
                "payment_capture": 1
            })
        )
        
        razorpay_order_id = order["id"]
        
        # Insert pending payment into Supabase
        if sc.supabase:
            await sb(lambda: sc.supabase.table("payments").insert({
                "user_id": body.user_id,
                "razorpay_order_id": razorpay_order_id,
                "amount": amount_in_paise,
                "plan_type": body.plan_type,
                "status": "pending"
            }).execute())
        
        return {
            "razorpay_order_id": razorpay_order_id,
            "amount": amount_in_paise,
            "currency": "INR"
        }
    except Exception as e:
        print(f"Razorpay Order Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

class VerifyRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    user_id: str | None = None  # Deprecated: backend uses DB user_id
    plan_type: str | None = None # Deprecated: backend uses DB plan_type
    amount: int | None = None   # Deprecated
    session_id: str | None = None

@router.post("/payments/verify")
async def verify_payment(body: VerifyRequest, authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    
    try:
        token = authorization.split(" ")[1]
        user_res = await asyncio.to_thread(sc.supabase.auth.get_user, token)
        if not user_res or not user_res.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        auth_user_id = user_res.user.id
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    try:
        # Verify the payment signature
        client.utility.verify_payment_signature({
            'razorpay_order_id': body.razorpay_order_id,
            'razorpay_payment_id': body.razorpay_payment_id,
            'razorpay_signature': body.razorpay_signature
        })
        
        if sc.supabase:
            # 1. Fetch payment record to verify ownership and get plan details
            payment_res = await sb(
                lambda: sc.supabase.table("payments").select("user_id, plan_type")
                .eq("razorpay_order_id", body.razorpay_order_id)
                .execute()
            )
            
            if not payment_res.data:
                raise HTTPException(status_code=404, detail="Order not found")
                
            actual_user_id = payment_res.data[0]["user_id"]
            actual_plan_type = payment_res.data[0]["plan_type"]

            if auth_user_id != actual_user_id:
                raise HTTPException(status_code=403, detail="Not authorized to verify this payment")
            
            # 2. Process the successful payment in a single Postgres transaction
            PLAN_CREDITS = {
                "pay_per_use": 10,
                "regular": 300,   # legacy – keep for old orders
                "bulk_offer": 3000,
                "student": 300,
            }
            credits_to_add = PLAN_CREDITS.get(actual_plan_type, 0)
            validity_days = 180 if actual_plan_type == "bulk_offer" else 60 if actual_plan_type == "regular" else 60 if actual_plan_type == "student" else 10
            
            rpc_res = await sb(lambda: sc.supabase.rpc("process_successful_payment", {
                "p_order_id": body.razorpay_order_id,
                "p_payment_id": body.razorpay_payment_id,
                "p_signature": body.razorpay_signature,
                "p_user_id": actual_user_id,
                "p_plan_type": actual_plan_type,
                "p_credits_to_add": credits_to_add,
                "p_validity_days": validity_days
            }).execute())
            
            if hasattr(rpc_res, 'error') and rpc_res.error:
                print(f"CRITICAL: process_successful_payment RPC failed: {rpc_res.error}")
                raise HTTPException(status_code=500, detail="Payment processing failed")
                
            if isinstance(rpc_res.data, dict) and rpc_res.data.get("status") == "already_processed":
                return {"status": "already_processed", "message": "Payment already verified"}

            # 3. Award Referral Bonus if the buyer was referred
            try:
                ref_check = await sb(lambda: sc.supabase.table("users").select("referred_by").eq("id", actual_user_id).execute())
                referrer_id = ref_check.data[0].get("referred_by") if ref_check.data else None
                if referrer_id:
                    await sb(lambda: sc.supabase.rpc("add_credit_bucket", {
                        "p_user_id": referrer_id,
                        "p_plan_type": "referral",
                        "p_amount": 20,
                        "p_validity_days": None,
                        "p_payment_id": f"ref_{body.razorpay_payment_id}"
                    }).execute())
                    print(f"Referral bonus awarded: referrer={referrer_id}, buyer={actual_user_id}")
            except Exception as ref_err:
                # Never block payment success for referral errors
                print(f"Referral bonus error (non-critical): {ref_err}")

            # 4. Link session_id to the user (only if session_id is still anonymous)
            if body.session_id:
                await sb(lambda: sc.supabase.table("resume_sessions").update({
                    "user_id": actual_user_id,
                    "payment_id": body.razorpay_payment_id
                }).eq("id", body.session_id).is_("user_id", None).execute())

        return {"status": "ok"}
    except razorpay.errors.SignatureVerificationError:
        print("Razorpay Verification Error: Signature Verification Failed")
        if sc.supabase:
            await sb(lambda: sc.supabase.table("payments").update({
                "status": "failed",
                "razorpay_payment_id": body.razorpay_payment_id,
                "failure_source": "signature_verification",
                "failed_at": datetime.now(timezone.utc).isoformat()
            }).eq("razorpay_order_id", body.razorpay_order_id).execute())
        raise HTTPException(status_code=400, detail="Payment verification failed")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Unexpected Verification Error: {str(e)}")
        if sc.supabase and hasattr(body, 'razorpay_order_id'):
            await sb(lambda: sc.supabase.table("payments").update({
                "status": "failed",
                "failure_source": "verify_exception",
                "failure_reason": str(e),
                "failed_at": datetime.now(timezone.utc).isoformat()
            }).eq("razorpay_order_id", body.razorpay_order_id).execute())
        raise HTTPException(status_code=500, detail="Internal server error")

class UpdateStatusRequest(BaseModel):
    razorpay_order_id: str
    status: str
    failure_source: str | None = None
    failure_reason: str | None = None

@router.patch("/payments/update-status")
async def update_payment_status(body: UpdateStatusRequest, authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    try:
        token = authorization.split(" ")[1]
        user_res = await asyncio.to_thread(sc.supabase.auth.get_user, token)
        if not user_res or not user_res.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        auth_user_id = user_res.user.id
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    if not sc.supabase:
        return {"status": "ignored"}
        
    if body.status not in {"abandoned", "failed"}:
        raise HTTPException(status_code=400, detail="Invalid status value")

    # Ownership check
    payment_res = await sb(
        lambda: sc.supabase.table("payments").select("user_id")
        .eq("razorpay_order_id", body.razorpay_order_id)
        .execute()
    )
    if not payment_res.data:
        raise HTTPException(status_code=404, detail="Order not found")
    if payment_res.data[0]["user_id"] != auth_user_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    update_data = {
        "status": body.status
    }
    if body.status in ("failed", "abandoned"):
        update_data["failed_at"] = datetime.now(timezone.utc).isoformat()
        if body.failure_source:
            update_data["failure_source"] = body.failure_source
        if body.failure_reason:
            update_data["failure_reason"] = body.failure_reason

    await sb(
        lambda: sc.supabase.table("payments").update(update_data)
        .eq("razorpay_order_id", body.razorpay_order_id)
        .execute()
    )
    return {"status": "ok"}

class DeductRequest(BaseModel):
    user_id: str
    session_id: str | None = None

@router.post("/payments/deduct-credit")
async def deduct_credit(body: DeductRequest, authorization: str = Header(None)):
    if not sc.supabase:
        raise HTTPException(status_code=500, detail="Database not configured")
        
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    
    try:
        token = authorization.split(" ")[1]
        user_res = await asyncio.to_thread(sc.supabase.auth.get_user, token)
        if not user_res or not user_res.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        if user_res.user.id != body.user_id:
            raise HTTPException(status_code=403, detail="Not authorized for this user")
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid token")
        
    try:
        result = await sb(lambda: sc.supabase.rpc("deduct_credits_v2", {
            "p_user_id": body.user_id,
            "p_amount": 10
        }).execute())
        
        if result.data:
            # Robustly link the session to the user in Python
            if body.session_id:
                try:
                    await sb(lambda: sc.supabase.table("resume_sessions").update({
                        "user_id": body.user_id
                    }).eq("id", body.session_id).execute())
                except Exception as ex:
                    print(f"Failed to link session {body.session_id} to user {body.user_id}: {ex}")
            return {"status": "success", "new_balance": result.data[0]["new_balance"]}
        else:
            raise HTTPException(status_code=402, detail="Insufficient credits")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



# ── OTP Routes ──────────────────────────────────────────────
# NOTE: We use Brevo's HTTP API (not SMTP) because Render free tier
# blocks all outbound SMTP ports (25, 465, 587). HTTP API uses port 443.

BREVO_API_KEY = os.getenv("BREVO_API_KEY")        # Brevo API key (not SMTP key)
BREVO_FROM_EMAIL = os.getenv("BREVO_FROM_EMAIL", "support@flashresume.in")
BREVO_FROM_NAME = os.getenv("BREVO_FROM_NAME", "Flashresume")

class SendOtpRequest(BaseModel):
    email: str

@router.post("/payments/send-otp")
@limiter.limit("3/minute")
async def send_otp(request: Request, body: SendOtpRequest):
    if not sc.supabase:
        raise HTTPException(status_code=500, detail="Database not configured")
    if not BREVO_API_KEY:
        raise HTTPException(status_code=500, detail="Email service not configured")

    email = body.email.strip().lower()
    otp_code = str(random.randint(100000, 999999))
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()

    # Upsert OTP — reset failed_attempts so previously locked users can retry
    try:
        await sb(lambda: sc.supabase.table("otp_verifications").upsert({
            "email": email,
            "otp": otp_code,
            "expires_at": expires_at,
            "verified": False,
            "failed_attempts": 0
        }, on_conflict="email").execute())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB error: {str(e)}")

    # Send email via Brevo HTTP API (port 443 — works on Render free tier)
    html_body = f"""
    <div style="font-family: Inter, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
      <h2 style="color: #006859; font-size: 24px; margin-bottom: 8px;">Your Verification Code</h2>
      <p style="color: #595c5d; font-size: 14px;">Use this code to unlock the Student Plan on Flashresume:</p>
      <div style="background: #f5f6f7; border-radius: 16px; padding: 32px; text-align: center; margin: 24px 0;">
        <span style="font-size: 40px; font-weight: 900; letter-spacing: 12px; color: #006859;">{otp_code}</span>
      </div>
      <p style="color: #595c5d; font-size: 12px;">This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
      <hr style="border: none; border-top: 1px solid #eff1f2; margin: 24px 0;" />
      <p style="color: #595c5d; font-size: 11px;">Flashresume &mdash; AI-Powered Resume Optimization</p>
    </div>
    """
    payload = {
        "sender": {"name": BREVO_FROM_NAME, "email": BREVO_FROM_EMAIL},
        "to": [{"email": email}],
        "subject": "Your Flashresume Verification Code",
        "htmlContent": html_body
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                "https://api.brevo.com/v3/smtp/email",
                json=payload,
                headers={
                    "api-key": BREVO_API_KEY,
                    "Content-Type": "application/json"
                }
            )
        if resp.status_code not in (200, 201):
            raise HTTPException(status_code=500, detail=f"Email API error: {resp.text}")
    except httpx.TimeoutException:
        raise HTTPException(status_code=500, detail="Email service timed out. Please try again.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")

    return {"status": "ok", "message": "OTP sent"}


class VerifyOtpRequest(BaseModel):
    email: str
    otp: str



@router.post("/payments/verify-otp")
@limiter.limit("5/minute")
async def verify_otp(request: Request, body: VerifyOtpRequest):
    if not sc.supabase:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    email = body.email.strip().lower()
    
    record_res = await sb(lambda: sc.supabase.table("otp_verifications") \
        .select("otp, expires_at, failed_attempts") \
        .eq("email", email).single().execute())

    if not record_res.data:
        raise HTTPException(404, "No OTP found for this email. Please request a new one.")

    record = record_res.data
    
    if record.get("failed_attempts", 0) >= 5:
        raise HTTPException(429, "Too many failed attempts. Request a new OTP.")

    if datetime.fromisoformat(record["expires_at"]) < datetime.now(timezone.utc):
        raise HTTPException(400, "OTP expired")

    if not hmac.compare_digest(str(record["otp"]).strip(), str(body.otp).strip()):
        # Increment failed counter
        await sb(lambda: sc.supabase.table("otp_verifications") \
            .update({"failed_attempts": record.get("failed_attempts", 0) + 1}) \
            .eq("email", email).execute())
        raise HTTPException(400, "Invalid OTP")

    # Success — clean up
    await sb(lambda: sc.supabase.table("otp_verifications").delete().eq("email", email).execute())
    return {"status": "ok", "verified": True}

@router.post("/payments/webhook")
async def razorpay_webhook(request: Request):
    """
    Server-to-Server webhook for Razorpay.
    Crucial for UPI payments where the frontend might be backgrounded/suspended.
    """
    body = await request.body()
    signature = request.headers.get("x-razorpay-signature")
    
    # In Razorpay dashboard, when creating the webhook, set this secret
    WEBHOOK_SECRET = os.getenv("RAZORPAY_WEBHOOK_SECRET")
    if not WEBHOOK_SECRET:
        raise HTTPException(status_code=500, detail="Webhook secret not configured")
    
    if not signature:
        raise HTTPException(status_code=400, detail="Missing signature")
        
    try:
        # Verify the signature
        client.utility.verify_webhook_signature(body.decode("utf-8"), signature, WEBHOOK_SECRET)
        
        payload = json.loads(body)
        event = payload.get("event")
        
        if event == "order.paid" or event == "payment.captured":
            payment_entity = payload.get('payload', {}).get('payment', {}).get('entity', {})
            order_id = payment_entity.get('order_id')
            payment_id = payment_entity.get('id')
            
            if not order_id or not sc.supabase:
                return {"status": "ignored"}
                
            # Find the payment record regardless of status to handle retries properly
            payment_res = await sb(
                lambda: sc.supabase.table("payments").select("user_id, plan_type")
                .eq("razorpay_order_id", order_id)
                .execute()
            )
            
            if not payment_res.data:
                # Not found
                return {"status": "ignored"}
                
            payment_record = payment_res.data[0]
            user_id = payment_record["user_id"]
            plan_type = payment_record["plan_type"]
            
            PLAN_CREDITS = {
                "pay_per_use": 10,
                "regular": 300,   # legacy – keep for old orders
                "bulk_offer": 3000,
                "student": 300,
            }
            credits_to_add = PLAN_CREDITS.get(plan_type, 0)
            validity_days = 180 if plan_type == "bulk_offer" else 60 if plan_type == "regular" else 60 if plan_type == "student" else 10

            rpc_res = await sb(lambda: sc.supabase.rpc("process_successful_payment", {
                "p_order_id": order_id,
                "p_payment_id": payment_id,
                "p_signature": "webhook_verified",
                "p_user_id": user_id,
                "p_plan_type": plan_type,
                "p_credits_to_add": credits_to_add,
                "p_validity_days": validity_days
            }).execute())

            if hasattr(rpc_res, 'error') and rpc_res.error:
                print(f"CRITICAL: webhook process_successful_payment RPC failed: {rpc_res.error}")
                raise Exception(f"Payment processing failed: {rpc_res.error}")

            # Award Referral Bonus if the buyer was referred
            try:
                ref_check = await sb(lambda: sc.supabase.table("users").select("referred_by").eq("id", user_id).execute())
                referrer_id = ref_check.data[0].get("referred_by") if ref_check.data else None
                if referrer_id:
                    await sb(lambda: sc.supabase.rpc("add_credit_bucket", {
                        "p_user_id": referrer_id,
                        "p_plan_type": "referral",
                        "p_amount": 20,
                        "p_validity_days": None,
                        "p_payment_id": f"ref_{payment_id}"
                    }).execute())
                    print(f"Referral bonus awarded: referrer={referrer_id}, buyer={user_id}")
            except Exception as ref_err:
                # Never block payment success for referral errors
                print(f"Referral bonus error (non-critical): {ref_err}")
        elif event == "payment.failed":
            payment_entity = payload.get('payload', {}).get('payment', {}).get('entity', {})
            order_id = payment_entity.get('order_id')
            payment_id = payment_entity.get('id')
            error_code = payment_entity.get('error_code')
            error_description = payment_entity.get('error_description')
            
            if not order_id or not sc.supabase:
                return {"status": "ignored"}
                
            await sb(
                lambda: sc.supabase.table("payments").update({
                    "status": "failed",
                    "razorpay_payment_id": payment_id,
                    "failure_code": error_code,
                    "failure_reason": error_description,
                    "failure_source": "webhook",
                    "failed_at": datetime.now(timezone.utc).isoformat()
                })
                .eq("razorpay_order_id", order_id)
                .execute()
            )
            
        return {"status": "ok"}
    except razorpay.errors.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid webhook signature")
    except Exception as e:
        print(f"Webhook error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/payments/reconcile")
async def reconcile_payments(authorization: str = Header(None)):
    CRON_SECRET = os.getenv("CRON_SECRET")
    if not CRON_SECRET:
        raise HTTPException(status_code=500, detail="CRON_SECRET not configured")
        
    if not authorization or authorization != f"Bearer {CRON_SECRET}":
        raise HTTPException(status_code=401, detail="Unauthorized")

    if not sc.supabase:
        raise HTTPException(status_code=500, detail="Database not configured")

    try:
        # Fetch up to 50 pending payments older than 30 minutes
        cutoff_time = (datetime.now(timezone.utc) - timedelta(minutes=30)).isoformat()
        pending_res = await sb(
            lambda: sc.supabase.table("payments").select("razorpay_order_id, user_id, plan_type")
            .eq("status", "pending")
            .lt("created_at", cutoff_time)
            .limit(50)
            .execute()
        )
        
        pending_payments = pending_res.data
        if not pending_payments:
            return {"status": "ok", "processed": 0, "remaining": 0, "message": "No pending payments found"}
            
        # We need a total count for "remaining"
        count_res = await sb(
            lambda: sc.supabase.table("payments").select("id", count="exact")
            .eq("status", "pending")
            .lt("created_at", cutoff_time)
            .execute()
        )
        total_pending = count_res.count if hasattr(count_res, 'count') and count_res.count is not None else len(pending_payments)

        processed_count = 0
        
        for payment in pending_payments:
            order_id = payment["razorpay_order_id"]
            user_id = payment["user_id"]
            plan_type = payment["plan_type"]
            
            try:
                # 1. Fetch order from Razorpay
                order = await asyncio.to_thread(lambda oid=order_id: client.order.fetch(oid))
                
                if order.get("status") == "paid":
                    # 2. Fetch payments for this order to get the payment_id
                    order_payments = await asyncio.to_thread(lambda oid=order_id: client.order.payments(oid))
                    
                    if order_payments and order_payments.get("items") and len(order_payments["items"]) > 0:
                        # Find captured payment if multiple exist
                        payment_item = next((p for p in order_payments["items"] if p.get("status") == "captured"), order_payments["items"][0])
                        payment_id = payment_item.get("id")
                        
                        if payment_id:
                            # 3. Process the payment
                            PLAN_CREDITS = {
                                "pay_per_use": 10,
                                "regular": 300,   # legacy – keep for old orders
                                "bulk_offer": 3000,
                                "student": 300,
                            }
                            credits_to_add = PLAN_CREDITS.get(plan_type, 0)
                            validity_days = 180 if plan_type == "bulk_offer" else 60 if plan_type == "regular" else 60 if plan_type == "student" else 10

                            await sb(lambda oid=order_id, pid=payment_id, uid=user_id, pt=plan_type, c=credits_to_add, v=validity_days: sc.supabase.rpc("process_successful_payment", {
                                "p_order_id": oid,
                                "p_payment_id": pid,
                                "p_signature": "reconciled_by_cron",
                                "p_user_id": uid,
                                "p_plan_type": pt,
                                "p_credits_to_add": c,
                                "p_validity_days": v
                            }).execute())
                            
                            processed_count += 1
                else:
                    # If order is created or attempted but not paid after 30 mins, mark it as abandoned
                    await sb(lambda: sc.supabase.table("payments").update({
                        "status": "abandoned"
                    }).eq("razorpay_order_id", order_id).execute())
            except Exception as e:
                error_msg = str(e).lower()
                print(f"Reconciliation error for order {order_id}: {e}")
                if "does not exist" in error_msg or "not found" in error_msg:
                    # Mark ghost/deleted Razorpay orders as abandoned to stop infinite retry loop
                    await sb(lambda oid=order_id: sc.supabase.table("payments").update({
                        "status": "abandoned"
                    }).eq("razorpay_order_id", oid).execute())
                
        remaining = max(0, total_pending - len(pending_payments))
        return {
            "status": "ok", 
            "processed": processed_count, 
            "total_fetched": len(pending_payments),
            "remaining": remaining
        }

    except Exception as e:
        print(f"Reconciliation loop error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
