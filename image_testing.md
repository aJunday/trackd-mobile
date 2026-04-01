# Image Integration Testing Playbook

## Image Handling Rules
- Always use base64-encoded images for all tests and requests
- Accepted formats: JPEG, PNG, WEBP only
- Do not use SVG, BMP, HEIC, or other formats
- Do not upload blank, solid-color, or uniform-variance images
- Every image must contain real visual features — such as objects, edges, textures, or shadows
- If the image is not PNG/JPEG/WEBP, transcode it to PNG or JPEG before upload
- If the image is animated (e.g., GIF, APNG, WEBP animation), extract the first frame only
- Resize large images to reasonable bounds (avoid oversized payloads)

## Testing GPT-4o Vision for Nutrition Label OCR

### Test 1: Basic OCR Test
```bash
# Create a test image with nutrition data
curl -X POST "https://fitness-command-7.preview.emergentagent.com/api/pantry/scan-label" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {session_token}" \
  -d '{
    "image_base64": "{base64_encoded_nutrition_label_image}"
  }'
```

Expected response:
```json
{
  "success": true,
  "item": {
    "name": "Product Name",
    "serving_size": "1 cup (240ml)",
    "calories_per_unit": 150,
    "protein": 5,
    "carbs": 20,
    "fats": 7
  }
}
```

### Test 2: Barcode Lookup
```bash
curl -X POST "https://fitness-command-7.preview.emergentagent.com/api/pantry/scan-barcode" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {session_token}" \
  -d '{
    "barcode": "0012345678905"
  }'
```

### Test 3: Pantry CRUD Operations
```bash
# Add item
curl -X POST "https://fitness-command-7.preview.emergentagent.com/api/pantry" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {session_token}" \
  -d '{
    "item_name": "Chicken Breast",
    "quantity": 500,
    "unit": "g",
    "calories_per_unit": 165,
    "protein": 31,
    "carbs": 0,
    "fats": 3.6
  }'

# Get all items
curl -X GET "https://fitness-command-7.preview.emergentagent.com/api/pantry" \
  -H "Authorization: Bearer {session_token}"

# Use item (subtract quantity)
curl -X POST "https://fitness-command-7.preview.emergentagent.com/api/pantry/{item_id}/use" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {session_token}" \
  -d '{"quantity": 100}'

# Delete item
curl -X DELETE "https://fitness-command-7.preview.emergentagent.com/api/pantry/{item_id}" \
  -H "Authorization: Bearer {session_token}"
```
