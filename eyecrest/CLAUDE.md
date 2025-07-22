- this is a cloudflare worker and durable objects that exposes an api to upsert and search on markdown files. it also automatically chunks them into sections. search is powered by FT5 and sqlite in durable objects sqlite storage

- never write sqlite migrations. let's instead just create always new datasets in the tests

- tests that upsert files should delete them at the end to not accumulate garbage

- authentication is implemented via asymmetric jwts. the jwt includes a orgId that identifies who owns the dataset. the jwt is generated in another service. this service is stateless on that respect.
