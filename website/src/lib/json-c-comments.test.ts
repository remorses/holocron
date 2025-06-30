import { describe, test, expect } from 'vitest'
import { extractJsonCComments, applyJsonCComments } from './json-c-comments'

describe('extractJsonCComments', () => {
    test('extracts simple comments above keys', () => {
        const jsonC = `{
    // This is a comment for name
    "name": "John",
    // This is a comment for age
    "age": 30
}`
        
        const result = extractJsonCComments(jsonC)
        expect(result.comments).toMatchInlineSnapshot(`
          {
            "age": "// This is a comment for age",
            "name": "// This is a comment for name",
          }
        `)
    })

    test('extracts nested object comments', () => {
        const jsonC = `{
    // User information
    "user": {
        // Full name of the user
        "name": "John Doe",
        // User age in years
        "age": 25
    },
    // Application settings
    "settings": {
        // UI theme preference
        "theme": "dark",
        // Notification preferences
        "notifications": {
            // Email notification setting
            "email": true,
            // Push notification setting
            "push": false
        }
    }
}`
        
        const result = extractJsonCComments(jsonC)
        expect(result.comments).toMatchInlineSnapshot(`
          {
            "settings": "// Application settings",
            "settings.notifications": "// Notification preferences",
            "settings.notifications.email": "// Email notification setting",
            "settings.notifications.push": "// Push notification setting",
            "settings.theme": "// UI theme preference",
            "user": "// User information",
            "user.age": "// User age in years",
            "user.name": "// Full name of the user",
          }
        `)
    })

    test('handles empty input', () => {
        const result = extractJsonCComments('')
        expect(result.comments).toMatchInlineSnapshot(`{}`)
        expect(result.data).toBeUndefined()
    })

    test('handles JSON without comments', () => {
        const jsonC = `{
    "name": "John",
    "age": 30,
    "settings": {
        "theme": "dark"
    }
}`
        
        const result = extractJsonCComments(jsonC)
        expect(result.comments).toMatchInlineSnapshot(`{}`)
    })

    test('handles multiple comment lines before single key', () => {
        const jsonC = `{
    // First comment line
    // Second comment line
    "name": "John"
}`
        
        const result = extractJsonCComments(jsonC)
        expect(result.comments).toMatchInlineSnapshot(`
          {
            "name": "// First comment line
          // Second comment line",
          }
        `)
    })

    test('extracts array comments', () => {
        const jsonC = `{
    // List of user names
    "users": [
        // First user
        "John",
        // Second user
        "Jane",
        // Third user
        "Bob"
    ]
}`
        
        const result = extractJsonCComments(jsonC)
        expect(result.comments).toMatchInlineSnapshot(`
          {
            "users": "// List of user names",
            "users.0": "// First user",
            "users.1": "// Second user",
            "users.2": "// Third user",
          }
        `)
    })

    test('extracts nested array with objects', () => {
        const jsonC = `{
    // Product catalog
    "products": [
        // Electronics category
        {
            // Product name
            "name": "Laptop",
            // Product price
            "price": 999
        },
        // Books category
        {
            // Book title
            "title": "JavaScript Guide",
            // Book author
            "author": "John Doe"
        }
    ]
}`
        
        const result = extractJsonCComments(jsonC)
        expect(result.comments).toMatchInlineSnapshot(`
          {
            "products": "// Product catalog",
            "products.0": "// Electronics category",
            "products.1": "// Books category",
            "products.author": "// Book author",
            "products.name": "// Product name",
            "products.price": "// Product price",
            "products.title": "// Book title",
          }
        `)
    })

    test('extracts comments for arrays inside nested objects', () => {
        const jsonC = `{
    // User configuration
    "config": {
        // Allowed permissions
        "permissions": [
            // Read permission
            "read",
            // Write permission
            "write"
        ],
        // User preferences
        "preferences": {
            // Notification types
            "notifications": [
                // Email notifications
                "email",
                // SMS notifications
                "sms"
            ]
        }
    }
}`
        
        const result = extractJsonCComments(jsonC)
        expect(result.comments).toMatchInlineSnapshot(`
          {
            "config": "// User configuration",
            "config.permissions": "// Allowed permissions",
            "config.permissions.0": "// Read permission",
            "config.permissions.1": "// Write permission",
            "config.preferences": "// User preferences",
            "config.preferences.notifications": "// Notification types",
            "config.preferences.notifications.0": "// Email notifications",
            "config.preferences.notifications.1": "// SMS notifications",
          }
        `)
    })
})

describe('applyJsonCComments', () => {
    test('applies comments to simple object', () => {
        const obj = {
            name: 'John',
            age: 30
        }
        
        const comments = {
            'name': '// User name',
            'age': '// User age in years'
        }
        
        const result = applyJsonCComments(obj, comments, 2)
        expect(result).toMatchInlineSnapshot(`
          "{
            // User name
            "name": "John",
            // User age in years
            "age": 30
          }"
        `)
    })
    
    test('applies comments to nested object', () => {
        const obj = {
            user: {
                name: 'John Doe',
                age: 25
            },
            settings: {
                theme: 'dark'
            }
        }
        
        const comments = {
            'user': '// User information',
            'user.name': '// Full name',
            'settings': '// App settings'
        }
        
        const result = applyJsonCComments(obj, comments, 2)
        expect(result).toMatchInlineSnapshot(`
          "{
            // User information
            "user": {
              // Full name
              "name": "John Doe",
              "age": 25
            },
            // App settings
            "settings": {
              "theme": "dark"
            }
          }"
        `)
    })
    
    test('applies comments to arrays', () => {
        const obj = {
            users: ['John', 'Jane', 'Bob']
        }
        
        const comments = {
            'users': '// List of users',
            'users.0': '// First user',
            'users.1': '// Second user'
        }
        
        const result = applyJsonCComments(obj, comments, 2)
        expect(result).toMatchInlineSnapshot(`
          "{
            // List of users
            "users": [
              // First user
              "John",
              // Second user
              "Jane",
              "Bob"
            ]
          }"
        `)
    })
    
    test('applies multiline comments', () => {
        const obj = {
            config: {
                important: true
            }
        }
        
        const comments = {
            'config': '// Configuration object\n// Contains important settings',
            'config.important': '// This is very important\n// Do not change without permission'
        }
        
        const result = applyJsonCComments(obj, comments, 2)
        expect(result).toMatchInlineSnapshot(`
          "{
            // Configuration object
            // Contains important settings
            "config": {
              // This is very important
              // Do not change without permission
              "important": true
            }
          }"
        `)
    })
    
    test('round-trip: extract and apply comments', () => {
        const originalJsonC = `{
    // User data
    "user": {
        // Username
        "name": "John",
        // User age
        "age": 30
    },
    // Application settings
    "settings": {
        // Theme preference
        "theme": "dark"
    }
}`
        
        // Extract comments and data
        const { comments: extractedComments, data: obj } = extractJsonCComments(originalJsonC)
        
        // Apply comments back
        const result = applyJsonCComments(obj, extractedComments, 4)
        
        // The result should have the same comments
        const { comments: resultComments } = extractJsonCComments(result)
        expect(resultComments).toEqual(extractedComments)
    })
    
    test('extracts data correctly', () => {
        const jsonC = `{
    // Product info
    "name": "Laptop",
    // Price in USD
    "price": 999,
    // Available colors
    "colors": ["black", "silver"]
}`
        
        const { data } = extractJsonCComments(jsonC)
        expect(data).toEqual({
            name: "Laptop",
            price: 999,
            colors: ["black", "silver"]
        })
    })
})