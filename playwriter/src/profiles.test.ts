import { describe, test, expect, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
    getChromeUserDataDir,
    readLocalState,
    getProfileEmailMap,
    getProfilePathByEmail,
    getAllProfiles,
} from './profiles'

// Mock the modules
vi.mock('node:fs')
vi.mock('node:os')

describe('Chrome Profile Detection', () => {
    test('getChromeUserDataDir returns correct path for each OS', () => {
        const homedir = '/home/user'
        vi.mocked(os.homedir).mockReturnValue(homedir)
        
        // Test macOS
        vi.mocked(os.platform).mockReturnValue('darwin' as any)
        expect(getChromeUserDataDir()).toMatchInlineSnapshot(`"/home/user/Library/Application Support/Google/Chrome"`)
        
        // Test Windows
        vi.mocked(os.platform).mockReturnValue('win32' as any)
        process.env.LOCALAPPDATA = 'C:\\Users\\user\\AppData\\Local'
        expect(getChromeUserDataDir()).toMatchInlineSnapshot(`"C:\\Users\\user\\AppData\\Local/Google/Chrome/User Data"`)
        
        // Test Linux
        vi.mocked(os.platform).mockReturnValue('linux' as any)
        expect(getChromeUserDataDir()).toMatchInlineSnapshot(`"/home/user/.config/google-chrome"`)
    })
    
    test('readLocalState handles missing file gracefully', () => {
        vi.mocked(os.platform).mockReturnValue('darwin' as any)
        vi.mocked(os.homedir).mockReturnValue('/home/user')
        vi.mocked(fs.existsSync).mockReturnValue(false)
        
        const result = readLocalState()
        expect(result).toMatchInlineSnapshot(`{}`)
    })
    
    test('readLocalState parses valid JSON', () => {
        vi.mocked(os.platform).mockReturnValue('darwin' as any)
        vi.mocked(os.homedir).mockReturnValue('/home/user')
        vi.mocked(fs.existsSync).mockReturnValue(true)
        
        const mockLocalState = {
            profile: {
                info_cache: {
                    'Default': {
                        user_name: 'user@example.com',
                    },
                    'Profile 1': {
                        user_name: 'work@company.com',
                    },
                    'Profile 2': {
                        // No user_name
                    },
                },
            },
        }
        
        vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockLocalState))
        
        const result = readLocalState()
        expect(result).toMatchInlineSnapshot(`
          {
            "profile": {
              "info_cache": {
                "Default": {
                  "user_name": "user@example.com",
                },
                "Profile 1": {
                  "user_name": "work@company.com",
                },
                "Profile 2": {},
              },
            },
          }
        `)
    })
    
    test('getProfileEmailMap returns map of profiles to emails', () => {
        vi.mocked(os.platform).mockReturnValue('darwin' as any)
        vi.mocked(os.homedir).mockReturnValue('/home/user')
        vi.mocked(fs.existsSync).mockReturnValue(true)
        
        const mockLocalState = {
            profile: {
                info_cache: {
                    'Default': {
                        user_name: 'user@example.com',
                    },
                    'Profile 1': {
                        user_name: 'work@company.com',
                    },
                    'Profile 2': {
                        // No user_name
                    },
                },
            },
        }
        
        vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockLocalState))
        
        const emailMap = getProfileEmailMap()
        expect(Array.from(emailMap.entries())).toMatchInlineSnapshot(`
          [
            [
              "Default",
              "user@example.com",
            ],
            [
              "Profile 1",
              "work@company.com",
            ],
            [
              "Profile 2",
              "",
            ],
          ]
        `)
    })
    
    test('getProfilePathByEmail finds profile by email', () => {
        vi.mocked(os.platform).mockReturnValue('darwin' as any)
        vi.mocked(os.homedir).mockReturnValue('/home/user')
        vi.mocked(fs.existsSync).mockReturnValue(true)
        
        const mockLocalState = {
            profile: {
                info_cache: {
                    'Default': {
                        user_name: 'user@example.com',
                    },
                    'Profile 1': {
                        user_name: 'work@company.com',
                    },
                },
            },
        }
        
        vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockLocalState))
        
        // Test case-insensitive email matching
        expect(getProfilePathByEmail('work@company.com')).toMatchInlineSnapshot(`"/home/user/Library/Application Support/Google/Chrome/Profile 1"`)
        expect(getProfilePathByEmail('WORK@COMPANY.COM')).toMatchInlineSnapshot(`"/home/user/Library/Application Support/Google/Chrome/Profile 1"`)
        expect(getProfilePathByEmail('nonexistent@example.com')).toMatchInlineSnapshot(`null`)
    })
    
    test('getAllProfiles returns all available profiles', () => {
        vi.mocked(os.platform).mockReturnValue('darwin' as any)
        vi.mocked(os.homedir).mockReturnValue('/home/user')
        vi.mocked(fs.existsSync).mockReturnValue(true)
        
        const mockLocalState = {
            profile: {
                info_cache: {
                    'Profile 1': {
                        user_name: 'work@company.com',
                    },
                    'Profile 2': {
                        // No user_name
                    },
                },
            },
        }
        
        vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockLocalState))
        
        const profiles = getAllProfiles()
        expect(profiles).toMatchInlineSnapshot(`
          [
            {
              "displayName": "Default (no email)",
              "email": "",
              "folder": "Default",
              "path": "/home/user/Library/Application Support/Google/Chrome/Default",
            },
            {
              "displayName": "work@company.com",
              "email": "work@company.com",
              "folder": "Profile 1",
              "path": "/home/user/Library/Application Support/Google/Chrome/Profile 1",
            },
            {
              "displayName": "Profile 2 (no email)",
              "email": "",
              "folder": "Profile 2",
              "path": "/home/user/Library/Application Support/Google/Chrome/Profile 2",
            },
          ]
        `)
    })
})