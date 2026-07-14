DROP FUNCTION IF EXISTS public.get_download_analytics(timestamp with time zone, timestamp with time zone, text, text, text[]);

CREATE OR REPLACE FUNCTION public.get_download_analytics(
    p_start_ts timestamp with time zone,
    p_end_ts timestamp with time zone,
    p_time_filter text,
    p_plan_filter text,
    p_exclude_user_ids uuid[] DEFAULT '{}'::uuid[]
)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
DECLARE
    v_result JSONB;
BEGIN
    WITH

    -- ── STEP 1: Resolve each user's plan from their MOST RECENT
    --   successful payment. This is the single source of truth.
    --   Doing it ONCE here with DISTINCT ON is far faster than
    --   the old Python loop that re-queried per user.
    user_plans AS (
        SELECT DISTINCT ON (user_id)
            user_id,
            plan_type
        FROM   payments
        WHERE  status = 'success'
        ORDER  BY user_id, created_at DESC
    ),

    -- ── STEP 2: Pull downloads in the time window, join plan,
    --   and pre-filter dev accounts + optional plan filter.
    filtered_downloads AS (
        SELECT
            d.id,
            d.user_id,
            d.session_id,
            d.downloaded_at,
            d.device_type,
            COALESCE(up.plan_type, 'free') AS user_plan
        FROM   resume_downloads d
        LEFT   JOIN user_plans up ON up.user_id = d.user_id
        WHERE  d.downloaded_at BETWEEN p_start_ts AND p_end_ts
          AND  (cardinality(p_exclude_user_ids) = 0
                OR d.user_id <> ALL(p_exclude_user_ids))
          AND  (
                p_plan_filter = 'all'
                OR COALESCE(up.plan_type, 'free') = p_plan_filter
               )
    ),

    -- ── STEP 3: Resolve each session's category.
    --   Uses _category field first; falls back to ats_score_after
    --   logic for legacy sessions that pre-date _category.
    session_cats AS (
        SELECT
            s.id AS session_id,
            CASE
                WHEN s.generated_output->>'_category' IS NOT NULL
                     AND s.generated_output->>'_category' <> ''
                THEN s.generated_output->>'_category'
                -- Legacy fallback: ats_score_after > 0 → JD was used
                WHEN COALESCE((s.generated_output->>'ats_score_after')::INT, 0) > 0
                THEN 'jd_optimized'
                ELSE 'no_jd'
            END AS category
        FROM  resume_sessions s
        WHERE s.id IN (SELECT DISTINCT session_id FROM filtered_downloads WHERE session_id IS NOT NULL)
    ),

    -- ── STEP 4: Enrich downloads with category.
    enriched AS (
        SELECT
            fd.*,
            COALESCE(sc.category, 'no_jd') AS category
        FROM  filtered_downloads fd
        LEFT  JOIN session_cats sc ON sc.session_id = fd.session_id
    ),

    -- ── STEP 5: Aggregations (all 5 charts in one pass)

    totals AS (
        SELECT
            COUNT(*)                                              AS total_downloads,
            COUNT(DISTINCT user_id)                              AS unique_users
        FROM enriched
    ),

    by_plan AS (
        SELECT
            user_plan AS plan,
            COUNT(*)  AS cnt
        FROM  enriched
        GROUP BY user_plan
    ),

    by_category AS (
        SELECT
            category AS cat,
            COUNT(*) AS cnt
        FROM  enriched
        GROUP BY category
    ),

    by_device AS (
        SELECT
            COALESCE(device_type, 'desktop') AS device,
            COUNT(*) AS cnt
        FROM  enriched
        GROUP BY COALESCE(device_type, 'desktop')
    ),

    -- ── STEP 6: Trend chart — timezone-aware bucketing (IST = UTC+5:30)
    --   Bucket granularity mirrors the Python build_trend_data logic:
    --     today  → hourly  (IST hours)
    --     week   → daily
    --     month  → daily
    --     all    → monthly
    --     custom → daily when ≤60 days, else monthly
    trend_raw AS (
        SELECT
            CASE p_time_filter
                WHEN 'today' THEN
                    TO_CHAR(
                        (downloaded_at AT TIME ZONE 'Asia/Kolkata'),
                        'HH24:"00"'
                    )
                WHEN 'week' THEN
                    TO_CHAR(
                        (downloaded_at AT TIME ZONE 'Asia/Kolkata'),
                        'Dy'
                    )
                WHEN 'month' THEN
                    TO_CHAR(
                        (downloaded_at AT TIME ZONE 'Asia/Kolkata'),
                        'DD Mon'
                    )
                ELSE  -- 'all' and 'custom' (monthly buckets)
                    TO_CHAR(
                        (downloaded_at AT TIME ZONE 'Asia/Kolkata'),
                        'Mon YY'
                    )
            END AS bucket_label,
            COUNT(*) AS cnt
        FROM  enriched
        GROUP BY 1
        ORDER BY
            MIN(downloaded_at)
    )

    SELECT jsonb_build_object(
        'total_downloads',       COALESCE((SELECT total_downloads  FROM totals), 0),
        'unique_users',          COALESCE((SELECT unique_users     FROM totals), 0),
        'downloads_by_plan',     COALESCE((
            SELECT jsonb_object_agg(plan, cnt)
            FROM   by_plan
        ), '{}'::jsonb),
        'downloads_by_category', COALESCE((
            SELECT jsonb_object_agg(cat, cnt)
            FROM   by_category
        ), '{}'::jsonb),
        'downloads_by_device',   COALESCE((
            SELECT jsonb_object_agg(device, cnt)
            FROM   by_device
        ), '{}'::jsonb),
        'trend', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('label', bucket_label, 'value', cnt))
            FROM   trend_raw
        ), '[]'::jsonb)
    )
    INTO v_result;

    RETURN v_result;
END;
$function$;
