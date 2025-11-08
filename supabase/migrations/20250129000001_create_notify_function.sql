-- Create a function to reload PostgREST schema cache
CREATE OR REPLACE FUNCTION notify_reload_schema()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Send notification to PostgREST to reload schema cache
  PERFORM pg_notify('pgrst', 'reload schema');
END;
$$;