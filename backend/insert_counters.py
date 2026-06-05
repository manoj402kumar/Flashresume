import asyncio
from supabase_client import supabase

async def main():
    try:
        # Insert pool_1_global and pool_2_global if they don't exist
        for name in ["pool_1_global", "pool_2_global"]:
            res = supabase.table("rr_counters").upsert({"name": name, "counter": 0}).execute()
            print(f"Upserted {name}:", res)
        print("SUCCESS")
    except Exception as e:
        print("ERROR:", e)

if __name__ == "__main__":
    asyncio.run(main())
