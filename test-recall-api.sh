#!/bin/bash

echo "Testing recall check API with Extail model type..."

curl -X POST http://localhost:3000/api/recall/check \
  -H "Content-Type: application/json" \
  -d '{
    "searchMethod": "model",
    "modelName": "エクストレイル",
    "modelType": "5AA-T33"
  }' | jq .
