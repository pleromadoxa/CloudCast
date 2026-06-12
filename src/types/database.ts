/**
 * Auto-generated Supabase types for CloudCast project.
 * Regenerate via: supabase gen types typescript --project-id ixjydnkpnyxnckhkqhue
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      mixer_sessions: {
        Row: {
          access_code: string;
          created_at: string;
          expires_at: string | null;
          id: string;
          is_active: boolean;
          max_devices: number;
          updated_at: string;
        };
      };
      paired_devices: {
        Row: {
          battery_level: number | null;
          device_id: string;
          id: string;
          label: string;
          last_seen_at: string;
          network_type: string | null;
          paired_at: string;
          platform: string;
          session_id: string;
          slot_number: number;
          status: string;
          stream_id: string | null;
          updated_at: string;
          whep_url: string | null;
          whip_url: string | null;
        };
      };
    };
    Functions: {
      create_mixer_session: { Args: { p_max_devices?: number }; Returns: Json };
      get_mixer_session: { Args: { p_access_code: string }; Returns: Json };
      get_mixer_session_by_id: {
        Args: { p_access_code: string; p_session_id: string };
        Returns: Json;
      };
      pair_device: {
        Args: {
          p_access_code: string;
          p_device_id: string;
          p_label?: string;
          p_platform?: string;
        };
        Returns: Json;
      };
      update_paired_device: {
        Args: {
          p_access_code: string;
          p_battery_level?: number;
          p_device_id: string;
          p_label?: string;
          p_network_type?: string;
          p_status?: string;
          p_stream_id?: string;
          p_whep_url?: string;
          p_whip_url?: string;
        };
        Returns: Json;
      };
      unpair_device: { Args: { p_access_code: string; p_device_id: string }; Returns: undefined };
      regenerate_access_code: {
        Args: { p_current_access_code: string; p_session_id: string };
        Returns: Json;
      };
      list_paired_devices: { Args: { p_access_code: string }; Returns: Json };
      list_paired_devices_by_session: {
        Args: { p_access_code: string; p_session_id: string };
        Returns: Json;
      };
      cloudcast_heartbeat: {
        Args: { p_source?: string };
        Returns: Json;
      };
    };
  };
};
