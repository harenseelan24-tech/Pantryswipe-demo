export interface SupabaseProfile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  diet_preferences: string[] | null;
  allergies: string[] | null;
  protein_preferences: string[] | null;
  skill_level: string | null;
  household_size: number | null;
  cuisine_preferences: string[] | null;
  goal: string | null;
  weekly_budget: number | null;
  onboarding_complete: boolean;
  streak: number;
  xp: number;
  level: number;
  money_saved: number;
  created_at: string;
  updated_at: string;
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: SupabaseProfile;
        Insert: Partial<SupabaseProfile> & { id: string };
        Update: Partial<SupabaseProfile>;
      };
    };
  };
};
