---
title: replace
---

# replace

[MODES: framework, data]

## Summary

[Reference Documentation ↗](https://api.reactrouter.com/v7/functions/react_router.replace.html)

A redirect response that will perform a `history.replaceState` instead of a
`history.pushState` for client-side navigation redirects.
Sets the status code and the `Location` header.
Defaults to "302 Found".

## Signature

```tsx
replace(url, init): Response
```

## Params

### url

[modes: framework, data]

_No documentation_

### init

[modes: framework, data]

_No documentation_

## Example

A `replace` redirect is useful in situations where you want to prevent the user from navigating back to the page they were redirected from. For example, after a user logs in, you wouldn't want them to be able to click "back" and return to the login form.

Here is an example of an `action` that processes a login form. Upon a successful login, it uses `replace` to redirect to the dashboard:

```tsx
import { replace } from "react-router-dom";
import { login } from "./auth";

export async function action({ request }) {
  const formData = await request.formData();
  const user = await login(formData);

  if (user) {
    // If login is successful, redirect to the dashboard
    // by replacing the current `/login` entry in the
    // history stack. This prevents the user from
    // clicking the back button and returning to the
    // login page.
    return replace("/dashboard");
  }

  // Handle login error
  return { error: "Invalid credentials" };
}
```
