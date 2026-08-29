import asyncio
from playwright.async_api import async_playwright
import json
import base64

def make_jwt(sub):
    header = base64.urlsafe_b64encode(b'{"alg":"HS256","typ":"JWT"}').decode().rstrip("=")
    payload = base64.urlsafe_b64encode(json.dumps({"sub": sub, "exp": 2999999999}).encode()).decode().rstrip("=")
    return f"{header}.{payload}.sig"

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        print("[TEST] Navigating to http://localhost:3000/")
        await page.goto("http://localhost:3000/")
        
        # Inject fake session
        token = make_jwt("test_user_123")
        session_data = {
            "access_token": token,
            "token_type": "bearer",
            "expires_in": 3600,
            "refresh_token": "fake",
            "user": {"id": "test_user_123", "email": "test@example.com"}
        }
        # Next.js Supabase client uses a specific key. We can intercept /api/analyze to just set the header, 
        # but fetchEventSource uses supabase.auth.getSession(). 
        # Easiest way: intercept supabase calls to return this session!
        
        await page.route("**/auth/v1/user", lambda route: route.fulfill(json=session_data["user"]))
        
        # Actually, let's just intercept the /api/analyze and /api/jobs/*/stream calls to verify they happen.
        sse_requests = []
        
        async def handle_route(route):
            req = route.request
            if "/api/jobs/" in req.url and "/stream" in req.url:
                sse_requests.append(req)
                print(f"[TEST] SSE Stream Requested: {req.url} with Auth: {req.headers.get('authorization', 'NONE')}")
            await route.continue_()

        await page.route("**/*", handle_route)

        # To avoid fighting Supabase client, we can just execute the api.ts functions directly in browser context!
        # Because we exported them, we can't easily access them from window unless attached.
        # But we can type in the textarea and click "Analyze"!
        
        print("[TEST] Filling analyze form")
        await page.fill('textarea[placeholder*="Paste your resume"]', "My name is Test User and I am a Software Engineer.")
        await page.fill('textarea[placeholder*="Paste the job description"]', "Looking for a Software Engineer.")
        
        # We need to mock Supabase Auth so it thinks we are logged in.
        await page.evaluate(f"""
            window.localStorage.setItem('supabase.auth.token', JSON.stringify({json.dumps(session_data)}));
            // Just overriding the global fetch might be easier, but let's see if we can click the button.
        """)
        
        print("[TEST] Clicking Analyze Resume button")
        # Find the analyze button. The button text might be "Analyze Resume" or something.
        # Wait, the page requires user to be logged in to click analyze? Usually yes.
        # Let's bypass UI and evaluate fetch directly to our API.
        
        result = await page.evaluate(f"""
            async () => {{
                // Mock Supabase globally for the API client if it uses it
                const token = "{token}";
                const res = await fetch("http://localhost:8000/api/analyze", {{
                    method: "POST",
                    headers: {{
                        "Content-Type": "application/json",
                        "Authorization": "Bearer " + token
                    }},
                    body: JSON.stringify({{
                        resume_text: "test resume",
                        job_description: "test job"
                    }})
                }});
                const data = await res.json();
                
                // Now let's test fetchEventSource directly
                return new Promise((resolve, reject) => {{
                    const sseUrl = "http://localhost:8000/api/jobs/" + data.job_id + "/stream";
                    let events = [];
                    const es = new EventSource(sseUrl); // Wait, our API uses fetchEventSource, but I can't access it globally.
                    resolve(data.job_id);
                }});
            }}
        """)
        
        print(f"[TEST] Job ID created: {result}")
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
