<div align='center' className='w-full'>
    <br/>
    <br/>
    <br/>
    <h1>eyecrest</h1>
    <p>simple and fast full text search API. works on markdown files. does automatic chunking and scoring</p>
    <br/>
    <br/>
</div>

## Regional Distribution

Eyecrest now supports regional distribution of datasets across Cloudflare's Durable Object regions for optimized performance. Each dataset is assigned to a primary region based on either:

1. **Automatic region selection** - Based on the request's geographic location (continent, latitude, longitude)
2. **Explicit region selection** - By providing a `primaryRegion` parameter when upserting files

### Durable Object ID Format

The Durable Object ID format is: `{region}.{index}.{datasetId}`

- `region`: The Cloudflare DO region code (e.g., `wnam`, `enam`, `weur`, `apac`)
- `index`: Shard index for future scaling (currently always `0`)
- `datasetId`: Your unique dataset identifier

Example: `wnam.0.my-docs-dataset`

### Available Regions

- **North America**
  - `wnam` - Western North America (Pacific coast, Rockies, Alaska)
  - `enam` - Eastern North America (East of Rockies, down to Florida)
- **South America**
  - `sam` - South America
- **Europe**
  - `weur` - Western Europe (Ireland, UK, France, Spain, Benelux)
  - `eeur` - Eastern Europe (Germany eastward, Poland, Balkans)
- **Asia**
  - `me` - Middle East (30°E-60°E & 10°N-48°N)
  - `apac` - Asia-Pacific (East, South, SE Asia)
- **Other**
  - `oc` - Oceania (Australia, NZ, Pacific Islands)
  - `afr` - Africa

### API Usage

When you first upload files to a dataset, the region is automatically determined based on the request's geographic location. This region assignment is permanent for the dataset and stored in Cloudflare KV, ensuring all subsequent operations are routed to the same regional Durable Object.

The region assignment happens automatically on first access - you don't need to specify it in the API calls.
