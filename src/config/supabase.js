import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pexurgcfkxkouthuhlnb.supabase.co'; // Replace later
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBleHVyZ2Nma3hrb3V0aHVobG5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5NDYyMzUsImV4cCI6MjA5MjUyMjIzNX0.4bQNTHSdYtW5rOOpZXXoNG3gJq2kaMd-cPHmkB8-_Go'; // Replace later

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
