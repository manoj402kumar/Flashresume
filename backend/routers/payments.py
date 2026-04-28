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
            
            # 2. Add Credits and Subscription Record
            PLAN_CREDITS = {
                "pay_per_use": 30,
                "regular": 300,
                "student": 300,
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
            if body.plan_type in ["regular", "student"]:
                expires_at = (datetime.utcnow() + timedelta(days=60)).isoformat()
            
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
            return {"status": "success", "new_balance": result.data[0]["new_balance"]}
        else:
            raise HTTPException(status_code=402, detail="Insufficient credits")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
