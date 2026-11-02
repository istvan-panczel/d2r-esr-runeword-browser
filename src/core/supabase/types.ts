// Hand-written types for the Supabase schema (supabase/migrations/*.sql: tables from
// 001_initial_schema + 002_favorites + 005_loot_filters, client write access as narrowed
// by the column-scoped grants in 003_harden_write_access and 005).
//
// We don't run `supabase gen types` (no CLI / project linking in this repo), so these
// are maintained by hand alongside the migrations. Keep them in sync when the schema changes.
// `Insert` / `Update` list only the columns the `authenticated` role may write.

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
        // Shape only: clients have no INSERT grant, rows come from the handle_new_user() trigger.
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
          privacy_policy_accepted_at?: string | null;
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
          user_id: string;
          name: string;
          description?: string | null;
          class: string;
          build_data?: Json;
          esr_version?: string | null;
          esr_version_updated?: string | null;
        };
        Update: {
          name?: string;
          description?: string | null;
          class?: string;
          build_data?: Json;
          esr_version_updated?: string | null;
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
      favorites: {
        Row: {
          user_id: string;
          // Stable client-built item id, e.g. 'runeword:Spirit:1' / 'htmUnique:Nagelring:rin'.
          item_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          item_id: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          item_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      favorite_counts: {
        Row: {
          item_id: string;
          count: number;
        };
        Insert: {
          item_id: string;
          count?: number;
        };
        Update: {
          item_id?: string;
          count?: number;
        };
        Relationships: [];
      };
      loot_filters: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          // The filter file as saved (JSON, possibly with comments); up to 512 KB.
          content: string;
          is_private: boolean;
          title: string | null;
          author: string | null;
          file_version: string | null;
          rule_count: number;
          // The file's filterLevels ([{ id, name }]), or null when it has none.
          levels: Json | null;
          esr_version: string | null;
          plugin_version: string | null;
          esr_version_updated: string | null;
          plugin_version_updated: string | null;
          change_note: string | null;
          based_on_id: string | null;
          based_on_revision: number | null;
          based_on_template: string | null;
          based_on_version: string | null;
          based_on_label: string | null;
          // Bumped by the loot_filters_before_update trigger when content changes.
          revision: number;
          likes_count: number;
          download_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          name: string;
          description?: string | null;
          content: string;
          is_private?: boolean;
          title?: string | null;
          author?: string | null;
          file_version?: string | null;
          rule_count?: number;
          levels?: Json | null;
          esr_version?: string | null;
          plugin_version?: string | null;
          esr_version_updated?: string | null;
          plugin_version_updated?: string | null;
          change_note?: string | null;
          based_on_id?: string | null;
          based_on_revision?: number | null;
          based_on_template?: string | null;
          based_on_version?: string | null;
          based_on_label?: string | null;
        };
        Update: {
          name?: string;
          description?: string | null;
          content?: string;
          is_private?: boolean;
          title?: string | null;
          author?: string | null;
          file_version?: string | null;
          rule_count?: number;
          levels?: Json | null;
          esr_version_updated?: string | null;
          plugin_version_updated?: string | null;
          change_note?: string | null;
          based_on_revision?: number | null;
          based_on_version?: string | null;
          based_on_label?: string | null;
        };
        Relationships: [];
      };
      loot_filter_likes: {
        Row: {
          filter_id: string;
          user_id: string;
        };
        Insert: {
          filter_id: string;
          user_id: string;
        };
        Update: {
          filter_id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Functions: {
      increment_loot_filter_download: {
        Args: { filter_id: string };
        Returns: undefined;
      };
    };
    // The schema defines none of these; the empty object type is what supabase-js expects.
    /* eslint-disable @typescript-eslint/no-generated-empty-object-type */
    Views: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
    /* eslint-enable @typescript-eslint/no-generated-empty-object-type */
  };
}

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

export type Build = Database['public']['Tables']['builds']['Row'];
export type BuildInsert = Database['public']['Tables']['builds']['Insert'];
export type BuildUpdate = Database['public']['Tables']['builds']['Update'];

export type Like = Database['public']['Tables']['likes']['Row'];

export type Favorite = Database['public']['Tables']['favorites']['Row'];
export type FavoriteInsert = Database['public']['Tables']['favorites']['Insert'];
export type FavoriteCount = Database['public']['Tables']['favorite_counts']['Row'];

export type LootFilterRow = Database['public']['Tables']['loot_filters']['Row'];
export type LootFilterInsert = Database['public']['Tables']['loot_filters']['Insert'];
export type LootFilterUpdate = Database['public']['Tables']['loot_filters']['Update'];
export type LootFilterLike = Database['public']['Tables']['loot_filter_likes']['Row'];
