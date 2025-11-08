-- Create set_config function for RLS policies
CREATE OR REPLACE FUNCTION public.set_config(setting text, value text)
RETURNS text AS $$
BEGIN
  PERFORM set_config(setting, value, false);
  RETURN value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;