# Receipt Processing API

This API allows you to upload receipt images and automatically extract transaction data using two different methodologies: **OCR + AI** and **Pure AI Vision**.

## Processing Methodologies

### **1. OCR + AI (Default)**
- **Process**: Image → OCR (Tesseract) → AI Analysis (GPT-3.5)
- **Speed**: 0.8-1.5 seconds
- **Best for**: Clear, high-quality receipt images
- **Advantages**: Fast, cost-effective, good for simple receipts

### **2. Pure AI Vision**
- **Process**: Image → Direct AI Analysis (GPT-4 Vision)
- **Speed**: 1.0-2.5 seconds  
- **Best for**: Poor quality images, handwritten receipts, complex layouts
- **Advantages**: Higher accuracy, understands visual context, no OCR errors

## Features

- **Dual Processing Methods**: Choose between OCR+AI or Pure AI Vision
- **Fast Processing**: Optimized for sub-2-second response times
- **High Accuracy**: AI understands receipt context and structure  
- **Confidence Scoring**: Provides detailed confidence scores for each extracted field
- **Dynamic Categories**: Uses your space's actual expense categories
- **Auto-categorization**: Automatically suggests transaction categories based on merchant
- **Transaction Creation**: Optionally creates transactions directly from receipt data

## Technology Stack

### OCR + AI Method
- **OCR Engine**: Tesseract with RTesseract gem
- **Image Processing**: MiniMagick for image optimization
- **AI Processing**: OpenAI GPT-3.5-turbo for data extraction
- **Pattern Enhancement**: AI-powered text analysis

### Pure AI Vision Method (plug-and-play)
- **Default (new, cheaper)**: OpenRouter + Gemini 2.0 Flash (`google/gemini-2.0-flash-001`) when `OPENROUTER_API_KEY` is set. Lower cost, strong document/receipt extraction.
- **Legacy**: OpenAI GPT-4 Vision (gpt-4o) when only `OPENAI_API_KEY` is set or `AI_VISION_PROVIDER=openai`.
- **Direct Analysis**: No separate OCR step; same request/response shape for both providers.
- **Override model**: Set `AI_VISION_MODEL` (e.g. `openai/gpt-4o` or `google/gemini-2.5-pro`) to override the default for the chosen provider.

## API Endpoints

### POST `/api/v1/receipts`

Process a receipt image and extract transaction data.

**Parameters:**
- `image` (file, required): Receipt image file (JPG, PNG, BMP, TIFF)
- `auto_create_transaction` (boolean, optional): Whether to automatically create a transaction (default: false)
- `processing_method` (string, optional): Processing methodology to use
  - `"ocr_ai"` (default): OCR + AI processing
  - `"pure_ai"`: Pure AI Vision processing

**Headers:**
- `X-Space-Code`: Required space identifier
- `Authorization`: Bearer token

**Example Request (OCR + AI):**
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Space-Code: your-space-code" \
  -F "image=@receipt.jpg" \
  -F "processing_method=ocr_ai" \
  -F "auto_create_transaction=true" \
  https://your-api.com/api/v1/receipts
```

**Example Request (Pure AI Vision):**
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Space-Code: your-space-code" \
  -F "image=@receipt.jpg" \
  -F "processing_method=pure_ai" \
  -F "auto_create_transaction=false" \
  https://your-api.com/api/v1/receipts
```

**Example Response (OCR + AI):**
```json
{
  "success": true,
  "message": "Receipt processed successfully",
  "data": {
    "extractedData": {
      "totalAmount": {
        "value": "87.43",
        "confidenceScore": 0.85,
        "reliability": "high",
        "extractionMethod": "ai_gpt_extraction"
      },
      "category": {
        "value": "Family",
        "confidenceScore": 0.8,
        "reliability": "high",
        "extractionMethod": "ai_gpt_categorization"
      }
    },
    "confidenceSummary": {
      "overallScore": 0.82,
      "overallLevel": "high",
      "shouldReview": false,
      "processingMethod": "ocr_ai"
    },
    "rawData": {
      "ocrText": "WHOLE FOODS MARKET...",
      "processingMethod": "ocr_ai"
    },
    "processingMetadata": {
      "processingEngine": "tesseract_gpt35",
      "totalProcessingTime": 1.234
    }
  }
}
```

**Example Response (Pure AI Vision):**
```json
{
  "success": true,
  "message": "Receipt processed successfully", 
  "data": {
    "extractedData": {
      "totalAmount": {
        "value": "87.43",
        "confidenceScore": 0.90,
        "reliability": "high",
        "extractionMethod": "ai_vision_extraction"
      },
      "category": {
        "value": "Family",
        "confidenceScore": 0.88,
        "reliability": "high", 
        "extractionMethod": "ai_vision_categorization"
      },
      "merchant": {
        "value": "Whole Foods Market",
        "confidenceScore": 0.92,
        "extractionMethod": "ai_vision_merchant_detection"
      }
    },
    "confidenceSummary": {
      "overallScore": 0.90,
      "overallLevel": "high",
      "shouldReview": false,
      "processingMethod": "pure_ai"
    },
    "rawData": {
      "imageAnalysis": "Direct AI vision analysis",
      "processingMethod": "pure_ai"
    },
    "processingMetadata": {
      "processingEngine": "gpt-4o",
      "totalProcessingTime": 1.856
    }
  }
}
```

## Method Comparison

| Feature | OCR + AI | Pure AI Vision |
|---------|----------|----------------|
| **Speed** | 0.8-1.5s | 1.0-2.5s |
| **Accuracy** | 85-90% | 90-95% |
| **Cost** | Lower | Higher |
| **Handwriting** | Limited | Excellent |
| **Poor Quality** | Struggles | Handles Well |
| **Visual Context** | Limited | Excellent |
| **Complex Layouts** | May Miss | Understands |

## When to Use Each Method

### **Use OCR + AI when:**
- Processing high-quality, clear receipt images
- Cost optimization is important
- Processing large volumes of standard receipts
- Images have good contrast and readable text

### **Use Pure AI Vision when:**
- Processing handwritten receipts
- Dealing with poor quality or blurry images
- Complex receipt layouts with visual elements
- Maximum accuracy is required
- Processing receipts with logos, stamps, or visual branding

## Dynamic Categories

Both methods automatically use your space's expense categories:

```javascript
// Your space categories (excludes "Transfer Fee" automatically)
const spaceCategories = [
  "Family", "Food", "Transport", "Utilities", 
  "Shopping", "Health", "Entertainment"
];

// AI will only suggest from these categories
```

## Performance

**Expected Processing Times:**

### OCR + AI Method:
- Simple receipts: 0.8-1.2 seconds
- Complex receipts: 1.2-1.5 seconds
- Large images: 1.5-2.0 seconds

### Pure AI Vision Method:  
- Simple receipts: 1.0-1.8 seconds
- Complex receipts: 1.8-2.2 seconds
- Handwritten receipts: 2.0-2.5 seconds

## Error Handling

**Common Error Responses:**

```json
{
  "success": false,
  "error": {
    "message": "Processing method must be one of: ocr_ai, pure_ai",
    "details": {}
  }
}
```

**Error Codes:**
- `400 Bad Request`: Invalid processing method, missing image, file too large
- `401 Unauthorized`: Invalid or missing authentication  
- `500 Internal Server Error`: OCR/AI processing failure, system error

## Installation & Setup

**1. Install System Dependencies:**
```bash
# Ubuntu/Debian (for OCR + AI method)
sudo apt-get install tesseract-ocr imagemagick

# macOS (for OCR + AI method)  
brew install tesseract imagemagick
```

**2. Add Gems to Gemfile:**
```ruby
gem "rtesseract", "~> 3.1"      # For OCR + AI method
gem "mini_magick", "~> 4.12"    # For image processing
gem "ruby-openai", "~> 7.0"     # For both methods
```

**3. Configure OpenAI API:**
```bash
# Set environment variable
export OPENAI_API_KEY="your-openai-api-key"

# OR add to Rails credentials
rails credentials:edit
# Add: openai_api_key: "your-openai-api-key"
```

**4. Vision provider (plug-and-play)**

Receipt vision uses a single client that switches by env:

- **OpenRouter (new, cheaper and effective)**  
  Set `OPENROUTER_API_KEY`. Optional: `AI_VISION_PROVIDER=openrouter`. Default model: `google/gemini-2.0-flash-001`. Override with `AI_VISION_MODEL` if needed.

- **OpenAI (old way)**  
  Set `OPENAI_API_KEY` and either leave `OPENROUTER_API_KEY` unset or set `AI_VISION_PROVIDER=openai`. Model: `gpt-4o` unless `AI_VISION_MODEL` is set.

**5. Run Bundle Install:**
```bash
bundle install
```

## Architecture

### OCR + AI Flow:
```
ProcessReceipt (Main Operation)
├── OptimizeImage (Image preprocessing)
├── ExtractText (Tesseract OCR)
├── ExtractReceiptDataOcrAi (GPT-3.5 analysis)
├── CalculateConfidenceAi (Confidence scoring)
└── FormatResult (Response formatting)
```

### Pure AI Vision Flow:
```
ProcessReceipt (Main Operation)  
├── ExtractReceiptDataVision (GPT-4 Vision direct analysis)
├── CalculateConfidenceAi (Confidence scoring)
└── FormatResult (Response formatting)
```

## Costs

**Approximate costs per receipt:**

### OCR + AI Method:
- **Tesseract**: Free (local processing)
- **GPT-3.5-turbo**: ~$0.001-0.002 per receipt
- **Total**: ~$0.001-0.002 per receipt

### Pure AI Vision Method:
- **GPT-4 Vision**: ~$0.01-0.03 per receipt  
- **Total**: ~$0.01-0.03 per receipt

## Best Practices

### **For OCR + AI:**
- Use well-lit, high-contrast images
- Ensure text is clearly readable
- Keep images between 800-2000px width
- Avoid excessive compression

### **For Pure AI Vision:**
- Works with any image quality
- Handles handwritten receipts well
- Better for receipts with visual branding
- Ideal for complex layouts

## Troubleshooting

**OCR + AI Issues:**
- Verify Tesseract installation: `tesseract --version`
- Check image quality and lighting
- Ensure proper text contrast

**Pure AI Vision Issues:**
- Verify OpenAI API key is valid
- Check internet connectivity for API calls
- Ensure image file size is under 10MB

**Both Methods:**
- Verify your space has expense categories configured
- Check that processing_method parameter is valid
- Ensure proper authentication headers 
