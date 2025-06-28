# Nested Starter Kit

Click on `Use this template` to copy the Nested starter kit. The starter kit contains examples including

- Guide pages
- Navigation
- Customizations
- API Reference pages
- Use of popular components

### Development

Install the [Nested CLI](https://www.npmjs.com/package/nested) to preview the documentation changes locally. To install, use the following command

```
npm i -g nested
```

Run the following command at the root of your documentation (where docs.json is)

```
nested dev
```

### Publishing Changes

Install our Github App to auto propagate changes from your repo to your deployment. Changes will be deployed to production automatically after pushing to the default branch. Find the link to install on your dashboard.

#### Troubleshooting

- Nested dev isn't running - Run `nested install` it'll re-install dependencies.
- Page loads as a 404 - Make sure you are running in a folder with `docs.json`
