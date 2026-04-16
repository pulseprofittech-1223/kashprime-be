const { supabaseAdmin } = require('../services/supabase.service');

// Cache for settings to avoid frequent database queries
let settingsCache = {};
let cacheExpiry = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const getSettings = async () => {
  try {
    // Return cached settings if still valid
    if (Date.now() < cacheExpiry && Object.keys(settingsCache).length > 0) {
      return settingsCache;
    }

    // Fetch fresh settings from database
    const { data: settings, error } = await supabaseAdmin
      .from('platform_settings')
      .select('setting_key, setting_value');

    if (error) throw error;

    // Convert to object for easy access
    settingsCache = {};
    settings.forEach(setting => {
      settingsCache[setting.setting_key] = setting.setting_value;
    });

    // Set cache expiry
    cacheExpiry = Date.now() + CACHE_DURATION;

    return settingsCache;
  } catch (error) {
    console.error('Get settings error:', error);
    return settingsCache; // Return cached settings on error
  }
};

const getSetting = async (key) => {
  const settings = await getSettings();
  return settings[key];
};

const isFeatureEnabled = async (featureKey) => {
  const value = await getSetting(featureKey);
  return value === 'true' || value === true;
};

const clearCache = () => {
  settingsCache = {};
  cacheExpiry = 0;
};

module.exports = {
  getSettings,
  getSetting,
  isFeatureEnabled,
  clearCache
};