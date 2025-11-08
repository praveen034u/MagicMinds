-- Create parent profiles table
CREATE TABLE public.parent_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  auth0_user_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create children profiles table  
CREATE TABLE public.children_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_id UUID NOT NULL REFERENCES public.parent_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  age_group TEXT NOT NULL,
  avatar TEXT,
  voice_clone_enabled BOOLEAN DEFAULT FALSE,
  voice_clone_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create voice clone subscriptions table
CREATE TABLE public.voice_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_id UUID NOT NULL REFERENCES public.parent_profiles(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  status TEXT NOT NULL DEFAULT 'inactive',
  plan_type TEXT NOT NULL DEFAULT 'basic',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create generated stories table
CREATE TABLE public.generated_stories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  child_id UUID NOT NULL REFERENCES public.children_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  audio_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.parent_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.children_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_stories ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for parent_profiles
CREATE POLICY "Parents can view their own profile" 
ON public.parent_profiles 
FOR SELECT 
USING (auth0_user_id = current_setting('app.current_auth0_user_id', true));

CREATE POLICY "Parents can update their own profile" 
ON public.parent_profiles 
FOR UPDATE 
USING (auth0_user_id = current_setting('app.current_auth0_user_id', true));

CREATE POLICY "Parents can insert their own profile" 
ON public.parent_profiles 
FOR INSERT 
WITH CHECK (auth0_user_id = current_setting('app.current_auth0_user_id', true));

-- Create RLS policies for children_profiles
CREATE POLICY "Parents can view their children profiles" 
ON public.children_profiles 
FOR SELECT 
USING (parent_id IN (
  SELECT id FROM public.parent_profiles 
  WHERE auth0_user_id = current_setting('app.current_auth0_user_id', true)
));

CREATE POLICY "Parents can create children profiles" 
ON public.children_profiles 
FOR INSERT 
WITH CHECK (parent_id IN (
  SELECT id FROM public.parent_profiles 
  WHERE auth0_user_id = current_setting('app.current_auth0_user_id', true)
));

CREATE POLICY "Parents can update their children profiles" 
ON public.children_profiles 
FOR UPDATE 
USING (parent_id IN (
  SELECT id FROM public.parent_profiles 
  WHERE auth0_user_id = current_setting('app.current_auth0_user_id', true)
));

CREATE POLICY "Parents can delete their children profiles" 
ON public.children_profiles 
FOR DELETE 
USING (parent_id IN (
  SELECT id FROM public.parent_profiles 
  WHERE auth0_user_id = current_setting('app.current_auth0_user_id', true)
));

-- Create RLS policies for voice_subscriptions
CREATE POLICY "Parents can view their subscription" 
ON public.voice_subscriptions 
FOR SELECT 
USING (parent_id IN (
  SELECT id FROM public.parent_profiles 
  WHERE auth0_user_id = current_setting('app.current_auth0_user_id', true)
));

CREATE POLICY "Parents can manage their subscription" 
ON public.voice_subscriptions 
FOR ALL 
USING (parent_id IN (
  SELECT id FROM public.parent_profiles 
  WHERE auth0_user_id = current_setting('app.current_auth0_user_id', true)
));

-- Create RLS policies for generated_stories
CREATE POLICY "Parents can view stories for their children" 
ON public.generated_stories 
FOR SELECT 
USING (child_id IN (
  SELECT c.id FROM public.children_profiles c
  JOIN public.parent_profiles p ON c.parent_id = p.id
  WHERE p.auth0_user_id = current_setting('app.current_auth0_user_id', true)
));

CREATE POLICY "Parents can create stories for their children" 
ON public.generated_stories 
FOR INSERT 
WITH CHECK (child_id IN (
  SELECT c.id FROM public.children_profiles c
  JOIN public.parent_profiles p ON c.parent_id = p.id
  WHERE p.auth0_user_id = current_setting('app.current_auth0_user_id', true)
));

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_parent_profiles_updated_at
BEFORE UPDATE ON public.parent_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_children_profiles_updated_at
BEFORE UPDATE ON public.children_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_voice_subscriptions_updated_at
BEFORE UPDATE ON public.voice_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();