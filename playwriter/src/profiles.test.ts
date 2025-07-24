import { describe, test, expect } from 'vitest'
import os from 'node:os'
import fs from 'node:fs'
import {
    getChromeUserDataDir,
    readLocalState,
    getProfileEmailMap,
    getProfilePathByEmail,
    getAllProfiles,
} from './profiles.js'

describe('Chrome Profile Detection (Real System)', () => {
    test('getChromeUserDataDir returns correct path for current OS', () => {
        const chromeDir = getChromeUserDataDir()
        expect(chromeDir).toMatchInlineSnapshot(`"/Users/morse/Library/Application Support/Google/Chrome"`)
    })
    
    test('readLocalState reads actual Chrome local state', () => {
        const localState = readLocalState()
        // Check if we have a valid object (might be empty if Chrome not installed)
        expect(typeof localState).toMatchInlineSnapshot(`"object"`)
        
        // If Chrome is installed, we should have some properties
        if (Object.keys(localState).length > 0) {
            expect(Object.keys(localState).sort()).toMatchInlineSnapshot(`
              [
                "accessibility",
                "app_shims",
                "autofill",
                "background_tracing",
                "breadcrumbs",
                "browser",
                "hardware_acceleration_mode_previous",
                "invalidation",
                "legacy",
                "local",
                "management",
                "network_time",
                "optimization_guide",
                "password_manager",
                "performance_intervention",
                "performance_tuning",
                "policy",
                "privacy_budget",
                "profile",
                "profile_network_context_service",
                "profiles",
                "segmentation_platform",
                "session_id_generator_last_value",
                "signin",
                "subresource_filter",
                "tab_stats",
                "tpcd",
                "ukm",
                "uninstall_metrics",
                "updateclientdata",
                "updateclientlastupdatecheckerror",
                "updateclientlastupdatecheckerrorcategory",
                "updateclientlastupdatecheckerrorextracode1",
                "user_experience_metrics",
                "variations_compressed_seed",
                "variations_country",
                "variations_crash_streak",
                "variations_failed_to_fetch_seed_streak",
                "variations_google_groups",
                "variations_last_fetch_time",
                "variations_limited_entropy_synthetic_trial_seed",
                "variations_limited_entropy_synthetic_trial_seed_v2",
                "variations_permanent_consistency_country",
                "variations_safe_compressed_seed",
                "variations_safe_seed_date",
                "variations_safe_seed_fetch_time",
                "variations_safe_seed_locale",
                "variations_safe_seed_milestone",
                "variations_safe_seed_permanent_consistency_country",
                "variations_safe_seed_session_consistency_country",
                "variations_safe_seed_signature",
                "variations_seed_date",
                "variations_seed_milestone",
                "variations_seed_signature",
                "was",
              ]
            `)
        }
    })
    
    test('getProfileEmailMap returns actual Chrome profiles', () => {
        const emailMap = getProfileEmailMap()
        
        // Convert to array for snapshot
        const profiles = Array.from(emailMap.entries()).map(([folder, email]) => ({
            folder,
            hasEmail: email.length > 0,
        }))
        
        expect(profiles).toMatchInlineSnapshot(`
          [
            {
              "folder": "Default",
              "hasEmail": true,
            },
            {
              "folder": "Profile 0",
              "hasEmail": false,
            },
            {
              "folder": "Profile 2",
              "hasEmail": true,
            },
            {
              "folder": "Profile 3",
              "hasEmail": true,
            },
          ]
        `)
    })
    
    test('getProfilePathByEmail works with real profiles', () => {
        const emailMap = getProfileEmailMap()
        
        // Test with first email found (if any)
        const firstEmail = Array.from(emailMap.values()).find(email => email.length > 0)
        
        if (firstEmail) {
            const profilePath = getProfilePathByEmail(firstEmail)
            expect(profilePath).toBeTruthy()
            expect(fs.existsSync(profilePath!)).toMatchInlineSnapshot(`true`)
        } else {
            // No emails found
            expect(getProfilePathByEmail('test@example.com')).toMatchInlineSnapshot()
        }
    })
    
    test('getAllProfiles returns all actual Chrome profiles', () => {
        const profiles = getAllProfiles()
        
        // Sanitize paths for snapshot (replace home directory)
        const home = os.homedir()
        const sanitizedProfiles = profiles.map(profile => ({
            folder: profile.folder,
            hasEmail: profile.email.length > 0,
            displayName: profile.displayName,
            pathExists: fs.existsSync(profile.path),
            relativePath: profile.path.replace(home, '~'),
        }))
        
        expect(sanitizedProfiles).toMatchInlineSnapshot(`
          [
            {
              "displayName": "t.de.rossi.01@gmail.com",
              "folder": "Default",
              "hasEmail": true,
              "pathExists": true,
              "relativePath": "~/Library/Application Support/Google/Chrome/Default",
            },
            {
              "displayName": "Profile 0 (no email)",
              "folder": "Profile 0",
              "hasEmail": false,
              "pathExists": true,
              "relativePath": "~/Library/Application Support/Google/Chrome/Profile 0",
            },
            {
              "displayName": "daer.tommy@gmail.com",
              "folder": "Profile 2",
              "hasEmail": true,
              "pathExists": true,
              "relativePath": "~/Library/Application Support/Google/Chrome/Profile 2",
            },
            {
              "displayName": "tommy@holocron.so",
              "folder": "Profile 3",
              "hasEmail": true,
              "pathExists": true,
              "relativePath": "~/Library/Application Support/Google/Chrome/Profile 3",
            },
          ]
        `)
    })
    
    test('Chrome user data directory exists on system', () => {
        const chromeDir = getChromeUserDataDir()
        const exists = fs.existsSync(chromeDir)
        expect(exists).toMatchInlineSnapshot(`true`)
    })
})