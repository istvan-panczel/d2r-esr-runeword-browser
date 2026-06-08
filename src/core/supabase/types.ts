// Hand-written types for the Supabase schema (supabase/migrations/001_initial_schema.sql).
//
// We don't run `supabase gen types` (no CLI / project linking in this repo), so these
// are maintained by hand alongside the migrations. Keep them in sync when the schema changes.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          discriminator: number;
          avatar_url: string | null;
          privacy_policy_accepted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name: string;
          discriminator?: number;
          avatar_url?: string | null;
          privacy_policy_accepted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          display_name?: string;
          discriminator?: number;
          avatar_url?: string | null;
          privacy_policy_accepted_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      builds: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          class: string;
          // Typed item-reference structure refined in the builds feature (BuildData);
          // kept as Json at the DB-type layer.
          build_data: Json;
          esr_version: string | null;
          esr_version_updated: string | null;
          likes_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          class: string;
          build_data?: Json;
          esr_version?: string | null;
          esr_version_updated?: string | null;
          likes_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          class?: string;
          build_data?: Json;
          esr_version?: string | null;
          esr_version_updated?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      likes: {
        Row: {
          build_id: string;
          user_id: string;
        };
        Insert: {
          build_id: string;
          user_id: string;
        };
        Update: {
          build_id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

export type Build = Database['public']['Tables']['builds']['Row'];
export type BuildInsert = Database['public']['Tables']['builds']['Insert'];
export type BuildUpdate = Database['public']['Tables']['builds']['Update'];

export type Like = Database['public']['Tables']['likes']['Row'];
