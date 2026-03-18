import { getSupabaseClient } from "../lib/supabase.js";

export type SourceType = 'web_chat' | 'whatsapp' | 'form' | 'backoffice';

export interface AuthUser {
  id: string;
  email?: string;
  tenant_id: string | null;
  role: string | null;
  is_admin: boolean;
  source_type?: SourceType;
}

export interface UserProfile {
  tenant_id: string | null;
  role: string | null;
  is_admin: boolean;
}

export async function getAuthUser(token: string): Promise<AuthUser> {
  const supabase = getSupabaseClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    throw new Error("Invalid token");
  }

  const userId = user.id;

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('tenant_id, role, is_admin')
    .eq('user_id', userId)
    .single();

  if (profileError || !profile) {
    throw new Error("No profile found");
  }

  if (!profile.is_admin && !profile.tenant_id) {
    throw new Error("No tenant assigned");
  }

  return {
    id: user.id,
    email: user.email,
    tenant_id: profile.tenant_id,
    role: profile.role,
    is_admin: profile.is_admin,
  };
}

export async function getProfileByUserId(userId: string): Promise<UserProfile> {
  const supabase = getSupabaseClient();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("tenant_id, role, is_admin")
    .eq("user_id", userId)
    .single();

  if (profileError || !profile) {
    throw new Error("No profile found");
  }

  return {
    tenant_id: profile.tenant_id,
    role: profile.role,
    is_admin: profile.is_admin,
  };
}
