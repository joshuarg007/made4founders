-- Migration: Add SEO columns to web_presence table
-- Run this on production database

-- Keywords
ALTER TABLE web_presence ADD COLUMN primary_keywords TEXT;
ALTER TABLE web_presence ADD COLUMN secondary_keywords TEXT;

-- Meta Information
ALTER TABLE web_presence ADD COLUMN meta_title_template VARCHAR(70);
ALTER TABLE web_presence ADD COLUMN meta_description VARCHAR(160);
ALTER TABLE web_presence ADD COLUMN brand_name VARCHAR(100);
ALTER TABLE web_presence ADD COLUMN tagline VARCHAR(200);

-- Technical SEO
ALTER TABLE web_presence ADD COLUMN canonical_url VARCHAR(500);
ALTER TABLE web_presence ADD COLUMN robots_directives VARCHAR(100);
ALTER TABLE web_presence ADD COLUMN sitemap_url VARCHAR(500);
ALTER TABLE web_presence ADD COLUMN google_search_console_id VARCHAR(100);
ALTER TABLE web_presence ADD COLUMN google_analytics_id VARCHAR(50);
ALTER TABLE web_presence ADD COLUMN bing_webmaster_id VARCHAR(100);

-- Open Graph / Social SEO
ALTER TABLE web_presence ADD COLUMN og_image_url VARCHAR(500);
ALTER TABLE web_presence ADD COLUMN og_type VARCHAR(50);
ALTER TABLE web_presence ADD COLUMN twitter_card_type VARCHAR(50);
ALTER TABLE web_presence ADD COLUMN twitter_handle VARCHAR(50);

-- Local SEO
ALTER TABLE web_presence ADD COLUMN business_name VARCHAR(200);
ALTER TABLE web_presence ADD COLUMN business_address TEXT;
ALTER TABLE web_presence ADD COLUMN business_phone VARCHAR(50);
ALTER TABLE web_presence ADD COLUMN service_areas TEXT;

-- Content Strategy
ALTER TABLE web_presence ADD COLUMN content_pillars TEXT;
ALTER TABLE web_presence ADD COLUMN target_audience TEXT;

-- Competitor Tracking
ALTER TABLE web_presence ADD COLUMN competitors TEXT;

-- SEO Checklist Progress
ALTER TABLE web_presence ADD COLUMN seo_checklist_progress TEXT;
