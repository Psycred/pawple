ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS notification_enabled BOOLEAN DEFAULT false;

-- Update existing rows
UPDATE profiles SET notification_enabled = false WHERE notification_enabled IS NULL;
