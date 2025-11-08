-- Fix the search path for security compliance
DROP FUNCTION IF EXISTS public.set_config(text, text);

CREATE OR REPLACE FUNCTION public.set_config(setting text, value text)
RETURNS text 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  PERFORM set_config(setting, value, false);
  RETURN value;
END;
$$;