import os
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from models.request_models import GenerateRequest
from services.resume_generator import generate_resume
from services.ats_scorer import score_resume
from supabase import create_client, Client

router = APIRouter()

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://your-project.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")

try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
except Exception as e:
    print(f"Supabase init error in generate.py: {e}")
    supabase = None

def flatten_resume_to_text(resume: dict) -> str:
    """
    Converts the structured TemplateV1 JSON dict into plain readable text
    so the ATS scorer LLM can meaningfully compare it against the JD.
    """
    lines = []

    # Heading
    h = resume.get("heading", {})
    if h.get("name"): lines.append(h["name"])
    if h.get("email"): lines.append(h["email"])

    # Summary
    if resume.get("summary"):
        lines.append(resume["summary"])

    # Education
    for edu in resume.get("education", []):
        lines.append(f"{edu.get('degree', '')} | {edu.get('institution', '')} | {edu.get('cgpa', '')}")

    # Work Experience
    for exp in resume.get("experience", []):
        lines.append(f"{exp.get('job_title', '')} at {exp.get('company', '')}")
        for bullet in exp.get("bullets", []):
            lines.append(bullet)

    # Projects
    for proj in resume.get("projects", []):
        lines.append(f"Project: {proj.get('title', '')} | {proj.get('tech_stack', '')}")
        for bullet in proj.get("bullets", []):
            lines.append(bullet)

    # Technical Skills — flatten all categories into one readable block
    skills = resume.get("technical_skills", {})
    for category, skill_list in skills.items():
        if skill_list:
            lines.append(f"{category}: {', '.join(skill_list)}")

    # Certifications & Achievements
    for cert in resume.get("certifications_and_achievements", []):
        lines.append(cert)

    return "\n".join(lines)


@router.post("/generate")
def generate_resume_endpoint(request: GenerateRequest):
    # Step 1: Generate the rewritten resume with Template v1 validation
    try:
        generated, model_used = generate_resume(
            request.resume_text,
            request.job_description,
            request.ats_score_before,
            request.approved_project,
            missing_keywords=request.missing_keywords,
        )
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Step 2: Re-score the generated resume against the JD to get a real ATS score
    # Skip if no JD provided (no-JD mode — ATS scoring is not applicable)
    if request.job_description and request.job_description.strip():
        # Convert structured dict → readable text before scoring
        generated_text = flatten_resume_to_text(generated)
        try:
            after_analysis = score_resume(generated_text, request.job_description)
            ats_after = after_analysis.get("ats_score", 0)
        except Exception:
            ats_after = 0   # Non-fatal — don't fail the whole request
    else:
        ats_after = 0  # No JD mode — ATS scoring not applicable

    # Step 3: Inject real ATS score and model info into the response
    generated["ats_score_after"] = ats_after
    generated["_model_used"] = model_used

    # Step 4: Save to resume_sessions database table
    if supabase:
        try:
            res = supabase.table("resume_sessions").insert({
                "resume_text": request.resume_text,
                "generated_output": generated
            }).execute()
            
            if res.data:
                generated["session_id"] = res.data[0]["id"]
        except Exception as e:
            print(f"Failed to save resume_session: {e}")

    # Return Template v1 JSON directly (no wrapper)
    return JSONResponse(content=generated)

