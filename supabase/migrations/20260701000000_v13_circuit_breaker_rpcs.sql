-- Migration: 20260701000000_v13_circuit_breaker_rpcs.sql

-- 1. Add missing columns to llm_circuit_breakers
ALTER TABLE public.llm_circuit_breakers
  ADD COLUMN IF NOT EXISTS circuit_key TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS cooldown_until TIMESTAMPTZ;

-- 2. Rename rr_counters columns to match Python expectations
ALTER TABLE public.rr_counters RENAME COLUMN id TO name;
ALTER TABLE public.rr_counters RENAME COLUMN current_index TO counter;

-- 3. trip_circuit_breaker RPC
CREATE OR REPLACE FUNCTION public.trip_circuit_breaker(
  p_circuit_key TEXT,
  p_cooldown_seconds INT
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.llm_circuit_breakers (model_name, circuit_key, cooldown_until, status, updated_at)
  VALUES (
    p_circuit_key,       -- model_name = circuit_key (new-format rows)
    p_circuit_key,
    NOW() + (p_cooldown_seconds || ' seconds')::INTERVAL,
    'tripped',
    NOW()
  )
  ON CONFLICT (circuit_key) DO UPDATE
    SET cooldown_until = NOW() + (p_cooldown_seconds || ' seconds')::INTERVAL,
        status = 'tripped',
        updated_at = NOW();
END;
$$;

-- 4. get_tripped_circuits RPC
CREATE OR REPLACE FUNCTION public.get_tripped_circuits()
RETURNS TABLE(circuit_key TEXT) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT lcb.circuit_key
  FROM public.llm_circuit_breakers lcb
  WHERE lcb.cooldown_until > NOW()
    AND lcb.status = 'tripped'
    AND lcb.circuit_key IS NOT NULL;
END;
$$;

-- 5. Seed rr_counters rows as a safety guard
INSERT INTO public.rr_counters (name, counter)
VALUES ('pool_1_global', 0), ('pool_2_global', 0)
ON CONFLICT (name) DO NOTHING;
