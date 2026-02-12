// functions/api/public-config.js
import { jsonResponse } from '../_middleware';

/**
 * @summary Get public configuration settings
 * @route GET /api/public-config
 * @returns {Response} JSON response with public settings
 */
export async function onRequestGet({ env }) {
  // Check the environment variable. Convert to string to handle both boolean `true` from toml and string 'true' from secrets
  const submissionEnabled = String(env.ENABLE_PUBLIC_SUBMISSION) === 'true';

  // Get AI request delay, default to 1500ms if not set or invalid
  const aiRequestDelay = parseInt(env.AI_REQUEST_DELAY, 10);
  const validAiRequestDelay = !isNaN(aiRequestDelay) && aiRequestDelay > 0 ? aiRequestDelay : 1500;

  // Fetch dynamic settings from DB
  let layoutSettings = {
    layout_hide_desc: false,
    layout_hide_links: false,
    layout_hide_category: false,
    layout_hide_title: false,
    home_title_size: '',
    home_title_color: '',
    layout_hide_subtitle: false,
    home_subtitle_size: '',
    home_subtitle_color: '',
    home_hide_stats: false,
    home_stats_size: '',
    home_stats_color: '',
    layout_grid_cols: '4',
    layout_custom_wallpaper: '',
    layout_menu_layout: 'horizontal',
    layout_enable_frosted_glass: false,
    layout_frosted_glass_intensity: '15',
    layout_enable_bg_blur: false,
    layout_bg_blur_intensity: '0',
    layout_card_scale: '100'
  };

  try {
    const keys = [
      'layout_hide_desc', 'layout_hide_links', 'layout_hide_category', 'layout_hide_title', 'layout_hide_subtitle',
      'layout_grid_cols', 'layout_custom_wallpaper', 'layout_menu_layout',
      'layout_enable_frosted_glass', 'layout_frosted_glass_intensity',
      'layout_enable_bg_blur', 'layout_bg_blur_intensity',
      'home_title_size', 'home_title_color',
      'home_subtitle_size', 'home_subtitle_color',
      'home_hide_stats', 'home_stats_size', 'home_stats_color',
      'layout_card_scale',
      'home_default_category'
    ];
    // Use dynamic placeholders
    const placeholders = keys.map(() => '?').join(',');
    const { results } = await env.NAV_DB.prepare(`SELECT key, value FROM settings WHERE key IN (${placeholders})`).bind(...keys).all();

    if (results) {
      results.forEach(row => {
        // Explicitly handle booleans
        const boolKeys = ['layout_hide_desc', 'layout_hide_links', 'layout_hide_category', 'layout_hide_title', 'layout_hide_subtitle', 'layout_enable_frosted_glass', 'layout_enable_bg_blur', 'home_hide_stats'];
        if (boolKeys.includes(row.key)) {
             layoutSettings[row.key] = row.value === 'true';
        } else {
             layoutSettings[row.key] = row.value;
        }
      });
    }
  } catch (e) {
    // Ignore error (e.g. table not exists), use defaults
  }

  return jsonResponse({
    submissionEnabled: submissionEnabled,
    aiRequestDelay: validAiRequestDelay,
    ...layoutSettings
  });
}
