#!/usr/bin/env python3
"""
Backend API Testing Script for Enhanced AI Chef Recipe API
Tests the enhanced AI Chef endpoint at https://fitness-command-7.preview.emergentagent.com
"""

import requests
import json
import subprocess
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://fitness-command-7.preview.emergentagent.com/api"
session_token = None
user_id = None

def print_test_result(test_name, success, details=""):
    """Print formatted test result."""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} {test_name}")
    if details:
        print(f"    {details}")
    print()

def make_request(method, endpoint, data=None, headers=None):
    """Make HTTP request with proper error handling."""
    url = f"{BASE_URL}{endpoint}"
    
    if headers is None:
        headers = {}
    
    if session_token:
        headers["Authorization"] = f"Bearer {session_token}"
    
    try:
        if method.upper() == "GET":
            response = requests.get(url, headers=headers, timeout=30)
        elif method.upper() == "POST":
            response = requests.post(url, json=data, headers=headers, timeout=30)
        elif method.upper() == "PUT":
            response = requests.put(url, json=data, headers=headers, timeout=30)
        elif method.upper() == "DELETE":
            response = requests.delete(url, headers=headers, timeout=30)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        return response
    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {e}")
        return None

def test_user_goals_endpoints():
    """Test all user goals endpoints."""
    print("=== TESTING USER GOALS ENDPOINTS ===\n")
    
    # Test 1: Update user goals
    print("1. Testing PUT /api/users/goals")
    goals_data = {
        "goal_calories": 2500,
        "goal_protein": 180,
        "goal_carbs": 280,
        "goal_fats": 80
    }
    
    response = make_request("PUT", "/users/goals", goals_data)
    if response and response.status_code == 200:
        data = response.json()
        if data.get("goal_calories") == 2500:
            print_test_result("Update user goals", True, f"Goals updated successfully: {data.get('goal_calories')} calories")
        else:
            print_test_result("Update user goals", False, f"Goals not updated correctly: {data}")
    else:
        print_test_result("Update user goals", False, f"Status: {response.status_code if response else 'No response'}")
    
    # Test 2: Calculate TDEE
    print("2. Testing POST /api/users/calculate-tdee")
    tdee_data = {
        "weight": 75.0,
        "height": 175.0,
        "age": 28,
        "gender": "male",
        "activity_level": "moderate"
    }
    
    response = make_request("POST", "/users/calculate-tdee", tdee_data)
    if response and response.status_code == 200:
        data = response.json()
        if "tdee" in data and "presets" in data:
            print_test_result("Calculate TDEE", True, f"TDEE: {data['tdee']}, Presets available: {list(data['presets'].keys())}")
        else:
            print_test_result("Calculate TDEE", False, f"Missing expected fields: {data}")
    else:
        print_test_result("Calculate TDEE", False, f"Status: {response.status_code if response else 'No response'}")
    
    # Test 3: Apply cutting preset
    print("3. Testing POST /api/users/apply-preset/cutting")
    response = make_request("POST", "/users/apply-preset/cutting")
    if response and response.status_code == 200:
        data = response.json()
        if "goals" in data and data["goals"].get("goal_type") == "cutting":
            print_test_result("Apply cutting preset", True, f"Cutting preset applied: {data['goals']['goal_calories']} calories")
        else:
            print_test_result("Apply cutting preset", False, f"Preset not applied correctly: {data}")
    else:
        print_test_result("Apply cutting preset", False, f"Status: {response.status_code if response else 'No response'}")
    
    # Test 4: Apply maintenance preset
    print("4. Testing POST /api/users/apply-preset/maintenance")
    response = make_request("POST", "/users/apply-preset/maintenance")
    if response and response.status_code == 200:
        data = response.json()
        if "goals" in data and data["goals"].get("goal_type") == "maintenance":
            print_test_result("Apply maintenance preset", True, f"Maintenance preset applied: {data['goals']['goal_calories']} calories")
        else:
            print_test_result("Apply maintenance preset", False, f"Preset not applied correctly: {data}")
    else:
        print_test_result("Apply maintenance preset", False, f"Status: {response.status_code if response else 'No response'}")
    
    # Test 5: Apply bulking preset
    print("5. Testing POST /api/users/apply-preset/bulking")
    response = make_request("POST", "/users/apply-preset/bulking")
    if response and response.status_code == 200:
        data = response.json()
        if "goals" in data and data["goals"].get("goal_type") == "bulking":
            print_test_result("Apply bulking preset", True, f"Bulking preset applied: {data['goals']['goal_calories']} calories")
        else:
            print_test_result("Apply bulking preset", False, f"Preset not applied correctly: {data}")
    else:
        print_test_result("Apply bulking preset", False, f"Status: {response.status_code if response else 'No response'}")

def test_nutrition_endpoints():
    """Test all nutrition endpoints."""
    print("=== TESTING NUTRITION ENDPOINTS ===\n")
    
    # Test 1: Get today's nutrition (should be empty initially)
    print("1. Testing GET /api/nutrition/today (initial)")
    response = make_request("GET", "/nutrition/today")
    if response and response.status_code == 200:
        data = response.json()
        if "consumed" in data and "goals" in data:
            print_test_result("Get today's nutrition (initial)", True, f"Consumed: {data['consumed']['calories']} calories, Goals: {data['goals']['calories']} calories")
        else:
            print_test_result("Get today's nutrition (initial)", False, f"Missing expected fields: {data}")
    else:
        print_test_result("Get today's nutrition (initial)", False, f"Status: {response.status_code if response else 'No response'}")
    
    # Test 2: Get meals for today (should be empty initially)
    print("2. Testing GET /api/nutrition/meals (initial)")
    response = make_request("GET", "/nutrition/meals")
    if response and response.status_code == 200:
        data = response.json()
        if "meals" in data and "date" in data:
            print_test_result("Get meals (initial)", True, f"Found {len(data['meals'])} meals for {data['date']}")
        else:
            print_test_result("Get meals (initial)", False, f"Missing expected fields: {data}")
    else:
        print_test_result("Get meals (initial)", False, f"Status: {response.status_code if response else 'No response'}")
    
    # Test 3: Log a new meal
    print("3. Testing POST /api/nutrition/meals")
    meal_data = {
        "meal_type": "lunch",
        "items": [
            {
                "name": "Chicken Breast",
                "calories": 165,
                "protein": 31,
                "carbs": 0,
                "fats": 3.6,
                "quantity": 1,
                "unit": "serving"
            },
            {
                "name": "Rice",
                "calories": 200,
                "protein": 4,
                "carbs": 45,
                "fats": 0.5,
                "quantity": 1,
                "unit": "cup"
            }
        ]
    }
    
    response = make_request("POST", "/nutrition/meals", meal_data)
    meal_id = None
    if response and response.status_code == 200:
        data = response.json()
        meal_id = data.get("meal_id")
        if meal_id and data.get("total_calories") == 365:
            print_test_result("Log new meal", True, f"Meal logged: {data['total_calories']} calories, ID: {meal_id}")
        else:
            print_test_result("Log new meal", False, f"Meal not logged correctly: {data}")
    else:
        print_test_result("Log new meal", False, f"Status: {response.status_code if response else 'No response'}")
    
    # Test 4: Get today's nutrition (should show the logged meal)
    print("4. Testing GET /api/nutrition/today (after logging meal)")
    response = make_request("GET", "/nutrition/today")
    if response and response.status_code == 200:
        data = response.json()
        if data.get("consumed", {}).get("calories") == 365:
            print_test_result("Get today's nutrition (after meal)", True, f"Consumed: {data['consumed']['calories']} calories, {len(data.get('meals', []))} meals")
        else:
            print_test_result("Get today's nutrition (after meal)", False, f"Calories not updated correctly: {data.get('consumed', {})}")
    else:
        print_test_result("Get today's nutrition (after meal)", False, f"Status: {response.status_code if response else 'No response'}")
    
    # Test 5: Delete the logged meal
    if meal_id:
        print("5. Testing DELETE /api/nutrition/meals/{meal_id}")
        response = make_request("DELETE", f"/nutrition/meals/{meal_id}")
        if response and response.status_code == 200:
            data = response.json()
            if "message" in data:
                print_test_result("Delete meal", True, f"Meal deleted: {data['message']}")
            else:
                print_test_result("Delete meal", False, f"Unexpected response: {data}")
        else:
            print_test_result("Delete meal", False, f"Status: {response.status_code if response else 'No response'}")
        
        # Test 6: Verify meal is deleted
        print("6. Testing GET /api/nutrition/today (after deletion)")
        response = make_request("GET", "/nutrition/today")
        if response and response.status_code == 200:
            data = response.json()
            if data.get("consumed", {}).get("calories") == 0:
                print_test_result("Verify meal deletion", True, f"Consumed calories back to 0: {data['consumed']['calories']}")
            else:
                print_test_result("Verify meal deletion", False, f"Calories not reset: {data.get('consumed', {})}")
        else:
            print_test_result("Verify meal deletion", False, f"Status: {response.status_code if response else 'No response'}")
    else:
        print_test_result("Delete meal", False, "No meal_id available from previous test")

def test_pantry_endpoints():
    """Test Smart Pantry CRUD endpoints."""
    print("=" * 60)
    print("🥫 TESTING SMART PANTRY ENDPOINTS")
    print("=" * 60)
    
    created_item_id = None
    
    # Test 1: GET /api/pantry - Should return empty array initially
    print("1. Testing GET /api/pantry (empty pantry)")
    response = make_request("GET", "/pantry")
    if response and response.status_code == 200:
        data = response.json()
        if "items" in data and isinstance(data["items"], list):
            print_test_result("GET /api/pantry (empty)", True, 
                            f"Status: {response.status_code}, Items count: {len(data['items'])}")
        else:
            print_test_result("GET /api/pantry (empty)", False, 
                            f"Unexpected response format: {data}")
    else:
        print_test_result("GET /api/pantry (empty)", False, 
                        f"Status: {response.status_code if response else 'No response'}")
    
    # Test 2: POST /api/pantry - Add a pantry item
    print("2. Testing POST /api/pantry (add item)")
    item_data = {
        "item_name": "Chicken Breast",
        "quantity": 500,
        "unit": "g",
        "calories_per_unit": 165,
        "protein": 31,
        "carbs": 0,
        "fats": 3.6,
        "brand": "Tyson",
        "serving_size": "100g"
    }
    
    response = make_request("POST", "/pantry", item_data)
    if response and response.status_code == 200:
        data = response.json()
        if "item_id" in data and data["item_name"] == "Chicken Breast":
            created_item_id = data["item_id"]
            print_test_result("POST /api/pantry", True, 
                            f"Status: {response.status_code}, Item ID: {created_item_id}")
        else:
            print_test_result("POST /api/pantry", False, 
                            f"Unexpected response format: {data}")
    else:
        print_test_result("POST /api/pantry", False, 
                        f"Status: {response.status_code if response else 'No response'}")
    
    # Test 3: GET /api/pantry - Verify item appears in list
    print("3. Testing GET /api/pantry (with items)")
    response = make_request("GET", "/pantry")
    if response and response.status_code == 200:
        data = response.json()
        if "items" in data and len(data["items"]) > 0:
            found_item = any(item["item_name"] == "Chicken Breast" for item in data["items"])
            if found_item:
                print_test_result("GET /api/pantry (with items)", True, 
                                f"Status: {response.status_code}, Items count: {len(data['items'])}")
            else:
                print_test_result("GET /api/pantry (with items)", False, 
                                "Created item not found in pantry list")
        else:
            print_test_result("GET /api/pantry (with items)", False, 
                            "No items found in pantry after creation")
    else:
        print_test_result("GET /api/pantry (with items)", False, 
                        f"Status: {response.status_code if response else 'No response'}")
    
    # Test 4: GET /api/pantry/{item_id} - Get specific item
    if created_item_id:
        print("4. Testing GET /api/pantry/{item_id}")
        response = make_request("GET", f"/pantry/{created_item_id}")
        if response and response.status_code == 200:
            data = response.json()
            if data["item_id"] == created_item_id and data["item_name"] == "Chicken Breast":
                print_test_result("GET /api/pantry/{item_id}", True, 
                                f"Status: {response.status_code}, Item: {data['item_name']}")
            else:
                print_test_result("GET /api/pantry/{item_id}", False, 
                                f"Item data mismatch: {data}")
        else:
            print_test_result("GET /api/pantry/{item_id}", False, 
                            f"Status: {response.status_code if response else 'No response'}")
    
    # Test 5: PUT /api/pantry/{item_id} - Update item quantity to 400
    if created_item_id:
        print("5. Testing PUT /api/pantry/{item_id}")
        update_data = {"quantity": 400}
        response = make_request("PUT", f"/pantry/{created_item_id}", update_data)
        if response and response.status_code == 200:
            data = response.json()
            if data["quantity"] == 400:
                print_test_result("PUT /api/pantry/{item_id}", True, 
                                f"Status: {response.status_code}, New quantity: {data['quantity']}")
            else:
                print_test_result("PUT /api/pantry/{item_id}", False, 
                                f"Quantity not updated correctly: {data['quantity']}")
        else:
            print_test_result("PUT /api/pantry/{item_id}", False, 
                            f"Status: {response.status_code if response else 'No response'}")
    
    # Test 6: POST /api/pantry/{item_id}/use - Use 100g from item
    if created_item_id:
        print("6. Testing POST /api/pantry/{item_id}/use")
        use_data = {"quantity": 100}
        response = make_request("POST", f"/pantry/{created_item_id}/use", use_data)
        if response and response.status_code == 200:
            data = response.json()
            if "remaining" in data and data["remaining"] == 300:
                print_test_result("POST /api/pantry/{item_id}/use", True, 
                                f"Status: {response.status_code}, Remaining: {data['remaining']}")
            else:
                print_test_result("POST /api/pantry/{item_id}/use", False, 
                                f"Unexpected remaining quantity: {data}")
        else:
            print_test_result("POST /api/pantry/{item_id}/use", False, 
                            f"Status: {response.status_code if response else 'No response'}")
    
    # Test 7: POST /api/pantry/scan-barcode - Test barcode lookup
    print("7. Testing POST /api/pantry/scan-barcode")
    barcode_data = {"barcode": "0070470496528"}  # Cheerios barcode
    response = make_request("POST", "/pantry/scan-barcode", barcode_data)
    if response and response.status_code == 200:
        data = response.json()
        if data.get("found") == True and "item" in data:
            print_test_result("POST /api/pantry/scan-barcode", True, 
                            f"Status: {response.status_code}, Product: {data['item'].get('item_name', 'Unknown')}")
        else:
            print_test_result("POST /api/pantry/scan-barcode", True, 
                            f"Status: {response.status_code}, Product not found (expected for some barcodes)")
    else:
        print_test_result("POST /api/pantry/scan-barcode", False, 
                        f"Status: {response.status_code if response else 'No response'}")
    
    # Test 8: GET /api/pantry?search=chicken - Test search functionality
    print("8. Testing GET /api/pantry?search=chicken")
    response = make_request("GET", "/pantry?search=chicken")
    if response and response.status_code == 200:
        data = response.json()
        if "items" in data:
            chicken_items = [item for item in data["items"] if "chicken" in item["item_name"].lower()]
            if len(chicken_items) > 0:
                print_test_result("GET /api/pantry?search=chicken", True, 
                                f"Status: {response.status_code}, Found {len(chicken_items)} chicken items")
            else:
                print_test_result("GET /api/pantry?search=chicken", False, 
                                "No chicken items found in search results")
        else:
            print_test_result("GET /api/pantry?search=chicken", False, 
                            f"Unexpected response format: {data}")
    else:
        print_test_result("GET /api/pantry?search=chicken", False, 
                        f"Status: {response.status_code if response else 'No response'}")
    
    # Test 9: DELETE /api/pantry/{item_id} - Delete the item
    if created_item_id:
        print("9. Testing DELETE /api/pantry/{item_id}")
        response = make_request("DELETE", f"/pantry/{created_item_id}")
        if response and response.status_code == 200:
            data = response.json()
            if "message" in data and "deleted" in data["message"].lower():
                print_test_result("DELETE /api/pantry/{item_id}", True, 
                                f"Status: {response.status_code}, Message: {data['message']}")
            else:
                print_test_result("DELETE /api/pantry/{item_id}", False, 
                                f"Unexpected response: {data}")
        else:
            print_test_result("DELETE /api/pantry/{item_id}", False, 
                            f"Status: {response.status_code if response else 'No response'}")
    
    # Test 10: Verify item is deleted - GET /api/pantry should be empty again
    print("10. Testing GET /api/pantry (after delete)")
    response = make_request("GET", "/pantry")
    if response and response.status_code == 200:
        data = response.json()
        if "items" in data and len(data["items"]) == 0:
            print_test_result("GET /api/pantry (after delete)", True, 
                            f"Status: {response.status_code}, Items count: {len(data['items'])}")
        else:
            print_test_result("GET /api/pantry (after delete)", False, 
                            f"Items still present after deletion: {len(data['items'])}")
    else:
        print_test_result("GET /api/pantry (after delete)", False, 
                        f"Status: {response.status_code if response else 'No response'}")

def main():
    """Main test execution."""
    global session_token, user_id
    
    print("🧪 SMART PANTRY API TESTING")
    print("=" * 60)
    print(f"Backend URL: {BASE_URL}")
    print(f"Test started at: {datetime.now()}")
    print()
    
    # Create test user and session using mongosh for pantry testing
    print("Creating test user and session for pantry testing...")
    user_id = f"test-user-pantry-{int(datetime.now().timestamp())}"
    session_token = f"test_session_pantry_{int(datetime.now().timestamp())}"
    
    # MongoDB commands to create test user and session
    mongo_commands = f"""
use('test_database');
var userId = '{user_id}';
var sessionToken = '{session_token}';
db.users.insertOne({{
  user_id: userId,
  email: 'pantry@example.com',
  name: 'Pantry Test User',
  picture: '',
  weight: 75,
  height: 175,
  age: 28,
  gender: 'male',
  activity_level: 'moderate',
  goal_type: 'maintenance',
  goal_calories: 2200,
  goal_protein: 150,
  goal_carbs: 250,
  goal_fats: 70,
  created_at: new Date()
}});
db.user_sessions.insertOne({{
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
}});
print('Session token: ' + sessionToken);
print('User ID: ' + userId);
"""
    
    # Execute MongoDB commands
    import subprocess
    try:
        result = subprocess.run(
            ["mongosh", "--eval", mongo_commands],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            print(f"✅ Test user created successfully")
            print(f"User ID: {user_id}")
            print(f"Session Token: {session_token}")
        else:
            print(f"❌ Failed to create test user: {result.stderr}")
            print("❌ Cannot proceed without authentication")
            return
            
    except Exception as e:
        print(f"❌ Error creating test user: {e}")
        print("❌ Cannot proceed without authentication")
        return
    
    print()
    
    # Test authentication first
    print("=== TESTING AUTHENTICATION ===\n")
    response = make_request("GET", "/auth/me")
    if response and response.status_code == 200:
        user_data = response.json()
        user_id = user_data.get("user_id")
        print_test_result("Authentication", True, f"Authenticated as: {user_data.get('email')} (ID: {user_id})")
    else:
        print_test_result("Authentication", False, f"Status: {response.status_code if response else 'No response'}")
        print("❌ Cannot proceed without authentication")
        return
    
    # Run pantry tests
    test_pantry_endpoints()
    
    # Run AI Chef tests
    test_ai_chef_endpoints()
    
    print("=" * 60)
    print("🏁 TESTING COMPLETED")
    print(f"Test finished at: {datetime.now()}")

def test_ai_chef_endpoints():
    """Test AI Chef meal suggestion endpoints."""
    print("\n" + "=" * 60)
    print("🤖 TESTING AI CHEF ENDPOINTS")
    print("=" * 60)
    
    # First, ensure we have pantry items for the AI Chef to work with
    setup_ai_chef_test_data()
    
    # Test 1: AI Chef meal suggestions without auth
    print("🔒 Testing AI Chef endpoint without authentication...")
    response = make_request("POST", "/pantry/ai-chef/suggest", {"count": 2}, headers={})
    if response and response.status_code == 401:
        print_test_result("AI Chef - No Auth", True, "Correctly returns 401 without authentication")
    else:
        print_test_result("AI Chef - No Auth", False, f"Expected 401, got {response.status_code if response else 'No response'}")
    
    # Test 2: AI Chef meal suggestions with auth
    print("🤖 Testing AI Chef meal suggestions...")
    response = make_request("POST", "/pantry/ai-chef/suggest", {"count": 2})
    
    if response and response.status_code == 200:
        data = response.json()
        print(f"📥 Response: {json.dumps(data, indent=2)}")
        
        # Validate response structure
        required_fields = ['success', 'meals', 'remaining', 'pantry_items_used']
        missing_fields = [field for field in required_fields if field not in data]
        
        if missing_fields:
            print_test_result("AI Chef - Response Structure", False, f"Missing fields: {missing_fields}")
            return
        
        if not data.get('success'):
            print_test_result("AI Chef - Success Flag", False, f"API returned success=false: {data.get('message', 'No message')}")
            return
        
        # Validate meals structure
        meals = data.get('meals', [])
        if not isinstance(meals, list) or len(meals) == 0:
            print_test_result("AI Chef - Meals Array", False, f"Expected non-empty array, got: {type(meals)} with {len(meals) if isinstance(meals, list) else 'N/A'} items")
            return
        
        # Validate each meal structure
        meal_validation_passed = True
        for i, meal in enumerate(meals):
            required_meal_fields = ['name', 'ingredients', 'instructions', 'macros']
            missing_meal_fields = [field for field in required_meal_fields if field not in meal]
            
            if missing_meal_fields:
                print_test_result("AI Chef - Meal Structure", False, f"Meal {i+1} missing fields: {missing_meal_fields}")
                meal_validation_passed = False
                break
            
            # Validate macros structure
            macros = meal.get('macros', {})
            required_macro_fields = ['calories', 'protein', 'carbs', 'fats']
            missing_macro_fields = [field for field in required_macro_fields if field not in macros]
            
            if missing_macro_fields:
                print_test_result("AI Chef - Macros Structure", False, f"Meal {i+1} macros missing fields: {missing_macro_fields}")
                meal_validation_passed = False
                break
        
        if not meal_validation_passed:
            return
        
        # Validate remaining structure
        remaining = data.get('remaining', {})
        required_remaining_fields = ['calories', 'protein', 'carbs', 'fats']
        missing_remaining_fields = [field for field in required_remaining_fields if field not in remaining]
        
        if missing_remaining_fields:
            print_test_result("AI Chef - Remaining Structure", False, f"Missing remaining fields: {missing_remaining_fields}")
            return
        
        # Validate pantry_items_used
        pantry_items_used = data.get('pantry_items_used')
        if not isinstance(pantry_items_used, int) or pantry_items_used <= 0:
            print_test_result("AI Chef - Pantry Items Used", False, f"Expected positive integer, got: {pantry_items_used}")
            return
        
        print_test_result("AI Chef - Meal Suggestions", True, f"Generated {len(meals)} meals using {pantry_items_used} pantry items")
        
        # Print meal details for verification
        for i, meal in enumerate(meals, 1):
            print(f"   Meal {i}: {meal['name']}")
            print(f"     Ingredients: {', '.join(meal['ingredients'])}")
            print(f"     Instructions: {meal['instructions'][:100]}{'...' if len(meal['instructions']) > 100 else ''}")
            print(f"     Macros: {meal['macros']['calories']}kcal, {meal['macros']['protein']}g P, {meal['macros']['carbs']}g C, {meal['macros']['fats']}g F")
        
        print(f"   Remaining: {remaining['calories']}kcal, {remaining['protein']}g P, {remaining['carbs']}g C, {remaining['fats']}g F")
        
    else:
        error_msg = f"Status: {response.status_code if response else 'No response'}"
        if response:
            try:
                error_data = response.json()
                error_msg += f", Error: {error_data}"
            except:
                error_msg += f", Raw: {response.text}"
        print_test_result("AI Chef - Meal Suggestions", False, error_msg)

def setup_ai_chef_test_data():
    """Ensure we have pantry items for AI Chef testing."""
    print("🛒 Setting up AI Chef test data...")
    
    # Check if we already have pantry items
    response = make_request("GET", "/pantry")
    if response and response.status_code == 200:
        data = response.json()
        items = data.get('items', [])
        
        if len(items) >= 4:
            print(f"✅ Found {len(items)} existing pantry items")
            return
    
    # Add test pantry items
    test_items = [
        {
            "item_name": "Chicken Breast",
            "quantity": 500,
            "unit": "g",
            "calories_per_unit": 165,
            "protein": 31,
            "carbs": 0,
            "fats": 3.6
        },
        {
            "item_name": "Brown Rice",
            "quantity": 400,
            "unit": "g",
            "calories_per_unit": 111,
            "protein": 2.6,
            "carbs": 23,
            "fats": 0.9
        },
        {
            "item_name": "Eggs",
            "quantity": 12,
            "unit": "piece",
            "calories_per_unit": 78,
            "protein": 6,
            "carbs": 0.6,
            "fats": 5
        },
        {
            "item_name": "Broccoli",
            "quantity": 300,
            "unit": "g",
            "calories_per_unit": 34,
            "protein": 2.8,
            "carbs": 7,
            "fats": 0.4
        }
    ]
    
    added_count = 0
    for item in test_items:
        response = make_request("POST", "/pantry", item)
        if response and response.status_code == 200:
            added_count += 1
    
    print(f"✅ Added {added_count}/{len(test_items)} pantry items for AI Chef testing")

if __name__ == "__main__":
    main()