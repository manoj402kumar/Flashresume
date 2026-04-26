from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import razorpay
import os
from dotenv import load_dotenv
from supabase import create_client, Client
from datetime import datetime, timedelta

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
            
            # 2. Insert or Update Subscription
            expires_at = None
            if body.plan_type == "regular":
                expires_at = (datetime.utcnow() + timedelta(days=30)).isoformat()
            elif body.plan_type == "student":
                expires_at = (datetime.utcnow() + timedelta(days=180)).isoformat()
            
            supabase.table("subscriptions").update({"is_active": False}).eq("user_id", body.user_id).execute()
            
            sub_data = {
                "user_id": body.user_id,
                "plan_type": body.plan_type,
                "is_active": True,
            }
            if expires_at:
                sub_data["expires_at"] = expires_at
            if body.plan_type == "student":
                sub_data["student_claimed"] = True
                
            supabase.table("subscriptions").insert(sub_data).execute()

            # 3. Link session_id to the user
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

@router.post("/payments/deduct-credit")
async def deduct_credit(body: DeductRequest):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")
        
    try:
        # Find active one_time subscription
        response = supabase.table("subscriptions")\
            .select("id")\
            .eq("user_id", body.user_id)\
            .eq("plan_type", "one_time")\
            .eq("is_active", True)\
            .order("created_at", desc=True)\
            .limit(1)\
            .execute()
            
        if response.data and len(response.data) > 0:
            sub_id = response.data[0]["id"]
            # Set to inactive
            supabase.table("subscriptions").update({"is_active": False}).eq("id", sub_id).execute()
            return {"status": "success", "message": "Credit deducted"}
        else:
            return {"status": "error", "message": "No active one_time credit found"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
