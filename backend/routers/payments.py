from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import razorpay
import os
import random
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv
from supabase import create_client, Client
from datetime import datetime, timedelta, timezone

load_dotenv()

router = APIRouter()

# Initialize Razorpay client
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "rzp_test_xxxxxxxxxxxxxxx")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "xxxxxxxxxxxxxxxxxxxxxxxx")
client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))

# Initialize Supabase client
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://your-project.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
except Exception as e:
    print(f"Supabase client initialization failed: {e}")
    supabase = None

class OrderRequest(BaseModel):
    amount: int
    plan_type: str
    user_id: str
    email: str = None

@router.post("/payments/create-order")
async def create_order(body: OrderRequest):
    amount_in_paise = body.amount * 100
    
    # Ensure user exists in public.users to prevent foreign key constraint violations
    if supabase and body.email:
        try:
            # Check if user exists
            user_check = supabase.table("users").select("id").eq("id", body.user_id).execute()
            if not user_check.data:
                # Insert missing user record
                supabase.table("users").insert({
                    "id": body.user_id,
                    "email": body.email
                }).execute()
        except Exception as e:
            print(f"Failed to ensure user exists in public.users: {e}")
            # Continue anyway, let it fail at payments insert if it must
            
    try:
        order = client.order.create({
            "amount": amount_in_paise,
            "currency": "INR",
            "payment_capture": 1
        })
        
        razorpay_order_id = order["id"]
        
        # Insert pending payment into Supabase
        if supabase:
            supabase.table("payments").insert({
                "user_id": body.user_id,
                "razorpay_order_id": razorpay_order_id,
                "amount": amount_in_paise,
                "plan_type": body.plan_type,
                "status": "pending"
            }).execute()
        
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
    user_id: str
    plan_type: str
    amount: int
    session_id: str | None = None

@router.post("/payments/verify")
async def verify_payment(body: VerifyRequest):
    try:
        # Verify the payment signature
        client.utility.verify_payment_signature({
            'razorpay_order_id': body.razorpay_order_id,
            'razorpay_payment_id': body.razorpay_payment_id,
            'razorpay_signature': body.razorpay_signature
        })
        
        if supabase:
            # 1. Update payment status to success
            supabase.table("payments").update({
                "status": "success",
                "razorpay_payment_id": body.razorpay_payment_id
            }).eq("razorpay_order_id", body.razorpay_order_id).execute()
            
            # 2. Add Credits and Subscription Record
            PLAN_CREDITS = {
                "pay_per_use": 20,
                "regular": 300,
                "student": 400,
            }
            credits_to_add = PLAN_CREDITS.get(body.plan_type, 0)
            
            # Atomically add credits
            supabase.rpc("add_credits", {
                "p_user_id": body.user_id,
                "p_amount": credits_to_add,
                "p_plan_type": body.plan_type,
                "p_payment_id": body.razorpay_payment_id
            }).execute()

            expires_at = None
            if body.plan_type == "regular":
                expires_at = (datetime.utcnow() + timedelta(days=60)).isoformat()
            elif body.plan_type == "student":
                expires_at = (datetime.utcnow() + timedelta(days=90)).isoformat()
            supabase.table("subscriptions").update({"is_active": False}).eq("user_id", body.user_id).execute()
            
            sub_data = {
                "user_id": body.user_id,
                "plan_type": body.plan_type,
                "is_active": True,
                "credits_granted": credits_to_add
            }
            if expires_at:
                sub_data["expires_at"] = expires_at
            if body.plan_type == "student":
                sub_data["student_claimed"] = True
                
            supabase.table("subscriptions").insert(sub_data).execute()

            # 3. Award Referral Bonus if the buyer was referred
            try:
                ref_check = supabase.table("users").select("referred_by").eq("id", body.user_id).execute()
                referrer_id = ref_check.data[0].get("referred_by") if ref_check.data else None
                if referrer_id:
                    supabase.rpc("award_referral_bonus", {
                        "p_referrer_uuid": referrer_id,
                        "p_referred_uuid": body.user_id,
                        "p_amount": 20,
                        "p_pay_id": body.razorpay_payment_id
                    }).execute()
                    print(f"Referral bonus awarded: referrer={referrer_id}, buyer={body.user_id}")
            except Exception as ref_err:
                # Never block payment success for referral errors
                print(f"Referral bonus error (non-critical): {ref_err}")

            # 4. Link session_id to the user
            if body.session_id:
                supabase.table("resume_sessions").update({
                    "user_id": body.user_id,
                    "payment_id": body.razorpay_payment_id
                }).eq("id", body.session_id).execute()

        return {"status": "ok"}
    except razorpay.errors.SignatureVerificationError:
        print("Razorpay Verification Error: Signature Verification Failed")
        if supabase:
            supabase.table("payments").update({
                "status": "failed",
                "razorpay_payment_id": body.razorpay_payment_id
            }).eq("razorpay_order_id", body.razorpay_order_id).execute()
        raise HTTPException(status_code=400, detail="Payment verification failed")
    except Exception as e:
        print(f"Unexpected Verification Error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

class DeductRequest(BaseModel):
    user_id: str
    session_id: str | None = None

@router.post("/payments/deduct-credit")
async def deduct_credit(body: DeductRequest):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")
        
    try:
        result = supabase.rpc("deduct_credits", {
            "p_user_id": body.user_id,
            "p_amount": 10,
            "p_session_id": body.session_id
        }).execute()
        
        if result.data and len(result.data) > 0 and result.data[0]["success"]:
            # Robustly link the session to the user in Python
            if body.session_id:
                try:
                    supabase.table("resume_sessions").update({
                        "user_id": body.user_id
                    }).eq("id", body.session_id).execute()
                except Exception as ex:
                    print(f"Failed to link session {body.session_id} to user {body.user_id}: {ex}")
            return {"status": "success", "new_balance": result.data[0]["new_balance"]}
        else:
            raise HTTPException(status_code=402, detail="Insufficient credits")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class StudentVerifyRequest(BaseModel):
    email: str

@router.post("/payments/verify-student")
async def verify_student(body: StudentVerifyRequest):
    # Open to all emails - OTP flow is the real verification gate
    return {"status": "success", "verified": True}

# ── OTP Routes ──────────────────────────────────────────────

BREVO_SMTP_HOST = "smtp-relay.brevo.com"
BREVO_SMTP_PORT = 587
BREVO_SMTP_USER = os.getenv("BREVO_SMTP_USER")   # e.g. 980780001@smtp-brevo.com
BREVO_SMTP_PASS = os.getenv("BREVO_SMTP_PASS")   # The SMTP key value from Brevo
BREVO_FROM_EMAIL = os.getenv("BREVO_FROM_EMAIL", "support@flashresume.in")
BREVO_FROM_NAME = os.getenv("BREVO_FROM_NAME", "Flashresume")

class SendOtpRequest(BaseModel):
    email: str

@router.post("/payments/send-otp")
async def send_otp(body: SendOtpRequest):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")
    if not BREVO_SMTP_USER or not BREVO_SMTP_PASS:
        raise HTTPException(status_code=500, detail="SMTP not configured")
    
    email = body.email.strip().lower()
    otp_code = str(random.randint(100000, 999999))
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
    
    # Upsert OTP into a simple table (create this in Supabase if it doesn't exist)
    try:
        supabase.table("otp_verifications").upsert({
            "email": email,
            "otp": otp_code,
            "expires_at": expires_at,
            "verified": False
        }, on_conflict="email").execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB error: {str(e)}")
    
    # Send email via Brevo SMTP
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Your Flashresume Verification Code"
        msg["From"] = f"{BREVO_FROM_NAME} <{BREVO_FROM_EMAIL}>"
        msg["To"] = email
        
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
        msg.attach(MIMEText(html_body, "html"))
        
        with smtplib.SMTP(BREVO_SMTP_HOST, BREVO_SMTP_PORT) as server:
            server.starttls()
            server.login(BREVO_SMTP_USER, BREVO_SMTP_PASS)
            server.sendmail(BREVO_FROM_EMAIL, email, msg.as_string())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")
    
    return {"status": "ok", "message": "OTP sent"}


class VerifyOtpRequest(BaseModel):
    email: str
    otp: str

@router.post("/payments/verify-otp")
async def verify_otp(body: VerifyOtpRequest):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    email = body.email.strip().lower()
    now = datetime.now(timezone.utc).isoformat()
    
    try:
        result = supabase.table("otp_verifications") \
            .select("otp, expires_at, verified") \
            .eq("email", email).single().execute()
    except Exception:
        raise HTTPException(status_code=400, detail="No OTP found for this email. Please request a new one.")
    
    record = result.data
    if not record:
        raise HTTPException(status_code=400, detail="No OTP found. Please request a new one.")
    if record["verified"]:
        raise HTTPException(status_code=400, detail="OTP already used. Please request a new one.")
    if record["expires_at"] < now:
        raise HTTPException(status_code=400, detail="OTP expired. Please request a new one.")
    if record["otp"] != body.otp.strip():
        raise HTTPException(status_code=400, detail="Incorrect OTP. Please try again.")
    
    # Mark as verified
    supabase.table("otp_verifications").update({"verified": True}).eq("email", email).execute()
    
    return {"status": "ok", "verified": True}
