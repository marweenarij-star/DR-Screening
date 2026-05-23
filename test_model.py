import requests

# API URL
url = "http://localhost:8000/predict"

# Path to the image to test
image_path = "C:/Users/DELL/Pictures/Screenshots/a.png"  # Replace with your image path

# Load the image
with open(image_path, "rb") as image_file:
    files = {"file": image_file}
    response = requests.post(url, files=files)

# Check the response
if response.status_code == 200:
    print("API Response:")
    result = response.json()
    grade = result.get("grade", "Unknown")
    confidence = result.get("confidence", "Unknown")
    heatmap_url = result.get("heatmap_url", "No URL provided")

    print(f"Grade: {grade}")
    print(f"Confidence: {confidence}%")
    print(f"Heatmap URL: {heatmap_url}")
else:
    print(f"Error: {response.status_code}")
    print(response.text)