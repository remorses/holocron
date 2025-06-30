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
            "products.0.name": "// Product name",
            "products.0.price": "// Product price",
            "products.1": "// Books category",
            "products.1.author": "// Book author",
            "products.1.title": "// Book title",
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

describe('applyJsonCComments - Edge Cases', () => {
    test('handles comments for non-existent fields gracefully', () => {
        const obj = {
            name: 'John',
            age: 30
        }
        
        const comments = {
            'name': '// User name',
            'nonExistentField': '// This field does not exist',
            'deep.nested.field': '// This path does not exist'
        }
        
        const result = applyJsonCComments(obj, comments, 2)
        expect(result).toMatchInlineSnapshot(`
          "{
            // User name
            "name": "John",
            "age": 30
          }"
        `)
    })
    
    test('handles type mismatches - treating object as array', () => {
        const obj = {
            user: {
                name: 'John',
                age: 30
            }
        }
        
        const comments = {
            'user': '// User object',
            'user.0': '// Trying to access object as array',
            'user.1': '// Another array-style access on object',
            'user.name': '// Valid property access'
        }
        
        const result = applyJsonCComments(obj, comments, 2)
        expect(result).toMatchInlineSnapshot(`
          "{
            // User object
            "user": {
              // Valid property access
              "name": "John",
              "age": 30
            }
          }"
        `)
    })
    
    test('handles type mismatches - treating array as object', () => {
        const obj = {
            colors: ['red', 'blue', 'green']
        }
        
        const comments = {
            'colors': '// Color array',
            'colors.0': '// Valid array index access',
            'colors.name': '// Trying to access array as object property',
            'colors.length': '// Another object-style access on array'
        }
        
        const result = applyJsonCComments(obj, comments, 2)
        expect(result).toMatchInlineSnapshot(`
          "{
            // Color array
            "colors": [
              // Valid array index access
              "red",
              "blue",
              "green"
            ]
          }"
        `)
    })
    
    test('handles accessing properties on primitive values', () => {
        const obj = {
            name: 'John',
            age: 30,
            isActive: true
        }
        
        const comments = {
            'name': '// Valid string comment',
            'name.length': '// Trying to access property on string',
            'name.0': '// Trying to access string as array',
            'age': '// Valid number comment',
            'age.toString': '// Trying to access method on number',
            'isActive': '// Valid boolean comment',
            'isActive.valueOf': '// Trying to access method on boolean'
        }
        
        const result = applyJsonCComments(obj, comments, 2)
        expect(result).toMatchInlineSnapshot(`
          "{
            // Valid string comment
            "name": "John",
            // Valid number comment
            "age": 30,
            // Valid boolean comment
            "isActive": true
          }"
        `)
    })
    
    test('handles deeply nested non-existent paths', () => {
        const obj = {
            level1: {
                level2: {
                    level3: 'deep value'
                }
            }
        }
        
        const comments = {
            'level1': '// Level 1 exists',
            'level1.level2': '// Level 2 exists',
            'level1.level2.level3': '// Level 3 exists',
            'level1.level2.level3.level4': '// Level 4 does not exist',
            'level1.level2.nonExistent': '// Non-existent at level 3',
            'level1.nonExistent.anything': '// Breaks at level 2'
        }
        
        const result = applyJsonCComments(obj, comments, 2)
        expect(result).toMatchInlineSnapshot(`
          "{
            // Level 1 exists
            "level1": {
              // Level 2 exists
              "level2": {
                // Level 3 exists
                "level3": "deep value"
              }
            }
          }"
        `)
    })
    
    test('handles mixed valid and invalid paths in arrays', () => {
        const obj = {
            items: [
                { name: 'item1', id: 1 },
                { name: 'item2', id: 2 },
                'stringItem'
            ]
        }
        
        const comments = {
            'items': '// Items array',
            'items.0': '// First item object',
            'items.0.name': '// First item name',
            'items.1.id': '// Second item id',
            'items.2': '// String item',
            'items.2.length': '// Accessing property on string in array',
            'items.3': '// Out of bounds index',
            'items.3.name': '// Property on non-existent item'
        }
        
        const result = applyJsonCComments(obj, comments, 2)
        expect(result).toMatchInlineSnapshot(`
          "{
            // Items array
            "items": [
              // First item object
              {
                "name": "item1",
                "id": 1
              },
              {
                "name": "item2",
                "id": 2
              },
              // String item
              "stringItem"
            ]
          }"
        `)
    })
    
    test('handles empty object and array edge cases', () => {
        const obj = {
            emptyObject: {},
            emptyArray: [],
            nullValue: null
        }
        
        const comments = {
            'emptyObject': '// Empty object',
            'emptyObject.someField': '// Field in empty object',
            'emptyArray': '// Empty array',
            'emptyArray.0': '// First element of empty array',
            'nullValue': '// Null value',
            'nullValue.property': '// Property on null'
        }
        
        const result = applyJsonCComments(obj, comments, 2)
        expect(result).toMatchInlineSnapshot(`
          "{
            // Empty object
            "emptyObject": {},
            // Empty array
            "emptyArray": [],
            // Null value
            "nullValue": null
          }"
        `)
    })
})